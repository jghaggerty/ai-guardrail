/**
 * Error Handling Utilities
 *
 * Utilities for categorizing and handling different types of errors
 * in evidence collection operations.
 */

import { EvidenceCollectorError, EvidenceStorageType } from './types.ts';

// ============================================================================
// ERROR CATEGORIES
// ============================================================================

/**
 * Categories of errors that can occur during evidence collection.
 */
export enum ErrorCategory {
  /** Network connectivity issues */
  NETWORK = 'network',
  /** Rate limiting / throttling */
  RATE_LIMIT = 'rate_limit',
  /** Authentication / authorization failures */
  AUTHENTICATION = 'authentication',
  /** Permission / access denied errors */
  PERMISSION = 'permission',
  /** Validation / bad request errors */
  VALIDATION = 'validation',
  /** Server errors (5xx) */
  SERVER_ERROR = 'server_error',
  /** Resource not found errors */
  NOT_FOUND = 'not_found',
  /** Unknown or unclassified errors */
  UNKNOWN = 'unknown',
}

/**
 * Categorize an error based on its properties.
 * @param error The error to categorize
 * @returns Error category
 */
export function categorizeError(error: unknown): ErrorCategory {
  if (!(error instanceof Error)) {
    return ErrorCategory.UNKNOWN;
  }

  const message = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Check for status code if available
  let statusCode: number | undefined;
  if (error instanceof EvidenceCollectorError) {
    statusCode = error.statusCode;
  } else if (error && typeof error === 'object' && 'status' in error) {
    statusCode = error.status as number;
  } else if (error && typeof error === 'object' && 'statusCode' in error) {
    statusCode = error.statusCode as number;
  }

  // Categorize by status code first (most reliable)
  if (statusCode !== undefined) {
    if (statusCode === 401) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (statusCode === 403) {
      return ErrorCategory.PERMISSION;
    }
    if (statusCode === 404) {
      return ErrorCategory.NOT_FOUND;
    }
    if (statusCode === 429) {
      return ErrorCategory.RATE_LIMIT;
    }
    if (statusCode >= 500) {
      return ErrorCategory.SERVER_ERROR;
    }
    if (statusCode >= 400 && statusCode < 500) {
      return ErrorCategory.VALIDATION;
    }
  }

  // Categorize by error message patterns
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429') ||
    message.includes('throttl') ||
    message.includes('quota')
  ) {
    return ErrorCategory.RATE_LIMIT;
  }

  if (
    message.includes('401') ||
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('invalid credentials') ||
    message.includes('invalid token') ||
    message.includes('invalid api key')
  ) {
    return ErrorCategory.AUTHENTICATION;
  }

  if (
    message.includes('403') ||
    message.includes('forbidden') ||
    message.includes('access denied') ||
    message.includes('permission denied') ||
    message.includes('insufficient permissions')
  ) {
    return ErrorCategory.PERMISSION;
  }

  if (
    errorName.includes('network') ||
    errorName.includes('timeout') ||
    errorName.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    message.includes('network error') ||
    message.includes('connection refused') ||
    message.includes('connection timeout')
  ) {
    return ErrorCategory.NETWORK;
  }

  if (
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('bucket not found') ||
    message.includes('index not found')
  ) {
    return ErrorCategory.NOT_FOUND;
  }

  if (
    message.includes('400') ||
    message.includes('bad request') ||
    message.includes('invalid') ||
    message.includes('validation') ||
    message.includes('malformed')
  ) {
    return ErrorCategory.VALIDATION;
  }

  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('internal server error') ||
    message.includes('service unavailable') ||
    message.includes('gateway error')
  ) {
    return ErrorCategory.SERVER_ERROR;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Get a user-friendly error message based on error category.
 * @param error The error
 * @param storageType The storage type
 * @returns User-friendly error message
 */
export function getUserFriendlyErrorMessage(
  error: unknown,
  storageType: EvidenceStorageType
): string {
  const category = categorizeError(error);
  const storageName = storageType.toUpperCase();

  switch (category) {
    case ErrorCategory.NETWORK:
      return `Unable to connect to ${storageName}. Please check your network connection and endpoint URL.`;

    case ErrorCategory.RATE_LIMIT:
      return `${storageName} rate limit exceeded. Please wait a moment and try again.`;

    case ErrorCategory.AUTHENTICATION:
      return `Authentication failed for ${storageName}. Please check your credentials.`;

    case ErrorCategory.PERMISSION:
      return `Access denied for ${storageName}. Please check your permissions and IAM policies.`;

    case ErrorCategory.VALIDATION:
      return `Invalid request to ${storageName}. Please check your configuration.`;

    case ErrorCategory.NOT_FOUND:
      return `Resource not found in ${storageName}. Please check your bucket/index name.`;

    case ErrorCategory.SERVER_ERROR:
      return `${storageName} service is temporarily unavailable. Please try again later.`;

    default:
      if (error instanceof Error) {
        return error.message;
      }
      return `An error occurred while accessing ${storageName}.`;
  }
}

/**
 * Determine if an error should trigger a fallback mechanism.
 * Some errors (like rate limits, network issues) might benefit from fallback.
 * @param error The error to check
 * @returns True if fallback should be attempted
 */
export function shouldAttemptFallback(error: unknown): boolean {
  const category = categorizeError(error);

  // Attempt fallback for rate limits and network errors
  // Don't attempt fallback for auth/permission errors (they won't work)
  return (
    category === ErrorCategory.RATE_LIMIT ||
    category === ErrorCategory.NETWORK ||
    category === ErrorCategory.SERVER_ERROR
  );
}

/**
 * Determine if an error is a permanent failure that shouldn't be retried.
 * @param error The error to check
 * @returns True if error is permanent
 */
export function isPermanentError(error: unknown): boolean {
  const category = categorizeError(error);

  return (
    category === ErrorCategory.AUTHENTICATION ||
    category === ErrorCategory.PERMISSION ||
    category === ErrorCategory.VALIDATION ||
    category === ErrorCategory.NOT_FOUND
  );
}

/**
 * Get recommended retry delay based on error category.
 * @param error The error
 * @param attemptNumber Current attempt number (0-indexed)
 * @returns Recommended delay in milliseconds
 */
export function getRecommendedRetryDelay(
  error: unknown,
  attemptNumber: number
): number {
  const category = categorizeError(error);

  // Base delays for different error categories
  const baseDelays: Record<ErrorCategory, number> = {
    [ErrorCategory.RATE_LIMIT]: 5000, // 5 seconds for rate limits
    [ErrorCategory.NETWORK]: 2000, // 2 seconds for network errors
    [ErrorCategory.SERVER_ERROR]: 3000, // 3 seconds for server errors
    [ErrorCategory.AUTHENTICATION]: 0, // Don't retry
    [ErrorCategory.PERMISSION]: 0, // Don't retry
    [ErrorCategory.VALIDATION]: 0, // Don't retry
    [ErrorCategory.NOT_FOUND]: 0, // Don't retry
    [ErrorCategory.UNKNOWN]: 1000, // 1 second default
  };

  const baseDelay = baseDelays[category] || 1000;

  // Exponential backoff: baseDelay * 2^attemptNumber
  const delay = baseDelay * Math.pow(2, attemptNumber);

  // Cap at 60 seconds
  return Math.min(delay, 60000);
}
