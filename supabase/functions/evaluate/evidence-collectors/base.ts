/**
 * Base Evidence Collector
 *
 * Abstract base class providing common functionality for all evidence collectors.
 * Implements reference ID generation, error handling, and retry logic.
 */

import type {
  EvidenceCollector,
  EvidenceData,
  EvidenceStorageType,
  ReferenceInfo,
  EvidenceCollectorError,
  RateLimitInfo,
} from './types.ts';

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

/**
 * Default retry configuration for evidence storage operations.
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Retry configuration type.
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

// ============================================================================
// BASE EVIDENCE COLLECTOR
// ============================================================================

/**
 * Abstract base class for evidence collectors.
 * Provides common functionality for reference ID generation, error handling, and retry logic.
 * Subclasses must implement storage-specific storeEvidence and testConnection methods.
 */
export abstract class BaseEvidenceCollector implements EvidenceCollector {
  public readonly storageType: EvidenceStorageType;
  protected readonly retryConfig: RetryConfig;

  constructor(storageType: EvidenceStorageType, retryConfig?: Partial<RetryConfig>) {
    this.storageType = storageType;
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...retryConfig,
    };
  }

  // ========================================================================
  // ABSTRACT METHODS (must be implemented by subclasses)
  // ========================================================================

  /**
   * Store evidence data in the customer storage system.
   * Must be implemented by each storage-specific collector.
   * @param evidenceData The evidence data to store
   * @returns Promise resolving to reference information
   * @throws EvidenceCollectorError if storage fails after retries
   */
  abstract storeEvidence(evidenceData: EvidenceData): Promise<ReferenceInfo>;

  /**
   * Test connectivity and permissions for the storage system.
   * Must be implemented by each storage-specific collector.
   * @returns Promise resolving to true if connection is successful
   * @throws EvidenceCollectorError if connection test fails
   */
  abstract testConnection(): Promise<boolean>;

  // ========================================================================
  // COMMON FUNCTIONALITY
  // ========================================================================

  /**
   * Generate a unique reference ID for evidence.
   * Format: evaluation-run-{evaluationRunId}-{testCaseId}-{iteration}-{uuid}
   * or evaluation-run-{evaluationRunId}-{uuid} if testCaseId/iteration not provided.
   * @param evaluationRunId The evaluation run ID
   * @param testCaseId Optional test case ID
   * @param iteration Optional iteration number
   * @returns A unique reference ID string
   */
  generateReferenceId(
    evaluationRunId: string,
    testCaseId?: string,
    iteration?: number
  ): string {
    const uuid = this.generateUUID();
    const parts = ['evaluation-run', evaluationRunId];
    
    if (testCaseId) {
      parts.push(`test-case-${testCaseId}`);
    }
    
    if (iteration !== undefined) {
      parts.push(`iteration-${iteration}`);
    }
    
    parts.push(uuid);
    
    return parts.join('-');
  }

  /**
   * Generate a UUID for reference IDs.
   * Uses crypto.randomUUID() if available, otherwise falls back to timestamp-based ID.
   * @returns A UUID string
   */
  protected generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Execute a function with retry logic and exponential backoff.
   * Automatically retries on retryable errors up to maxRetries times.
   * @param fn The function to execute
   * @param config Optional retry configuration (overrides instance config)
   * @returns Promise resolving to the function result
   * @throws EvidenceCollectorError if all retries fail
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.retryConfig, ...config };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if error is an EvidenceCollectorError
        if (error instanceof EvidenceCollectorError) {
          // Don't retry non-retryable errors
          if (!error.isRetryable) {
            throw error;
          }

          // Log retry attempt
          if (attempt < retryConfig.maxRetries) {
            // Use rate limit retry-after if available, otherwise use exponential backoff
            let delay: number;
            if (error.rateLimitInfo?.retryAfter) {
              delay = error.rateLimitInfo.retryAfter * 1000; // Convert seconds to milliseconds
              delay = Math.min(delay, retryConfig.maxDelayMs);
              console.log(
                `[${this.storageType}] Rate limited. Waiting ${delay}ms before retry...`
              );
            } else {
              delay = this.calculateBackoffDelay(attempt, retryConfig);
              console.log(
                `[${this.storageType}] Attempt ${attempt + 1} failed: ${error.message}. ` +
                `Retrying in ${delay}ms...`
              );
            }
            await this.sleep(delay);
          }
        } else {
          // For non-EvidenceCollectorError, treat as retryable by default
          if (attempt < retryConfig.maxRetries) {
            const delay = this.calculateBackoffDelay(attempt, retryConfig);
            console.log(
              `[${this.storageType}] Attempt ${attempt + 1} failed: ${error.message}. ` +
              `Retrying in ${delay}ms...`
            );
            await this.sleep(delay);
          }
        }
      }
    }

    // All retries exhausted
    const errorMessage = lastError?.message || 'Unknown error';
    throw new EvidenceCollectorError(
      `Failed after ${retryConfig.maxRetries + 1} attempts: ${errorMessage}`,
      this.storageType,
      false // Not retryable after max retries
    );
  }

  /**
   * Calculate exponential backoff delay with jitter.
   * @param attempt Current attempt number (0-indexed)
   * @param config Retry configuration
   * @returns Delay in milliseconds
   */
  protected calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
    
    // Add jitter (random 0-1000ms) to prevent thundering herd
    const jitter = Math.random() * 1000;
    
    // Cap at maxDelayMs
    return Math.min(exponentialDelay + jitter, config.maxDelayMs);
  }

  /**
   * Sleep for a specified number of milliseconds.
   * @param ms Milliseconds to sleep
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create an EvidenceCollectorError from a generic error.
   * Attempts to determine if the error is retryable based on error type/message.
   * Extracts rate limit information from HTTP responses if available.
   * @param error The error to convert
   * @param defaultMessage Default error message if error has no message
   * @param response Optional HTTP response object to extract rate limit info from
   * @returns EvidenceCollectorError instance
   */
  protected createCollectorError(
    error: unknown,
    defaultMessage: string = 'Evidence storage failed',
    response?: Response
  ): EvidenceCollectorError {
    if (error instanceof EvidenceCollectorError) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = errorMessage || defaultMessage;

    // Determine if error is retryable based on common patterns
    const isRetryable = this.isRetryableError(error);

    // Try to extract status code if available
    let statusCode: number | undefined;
    if (response) {
      statusCode = response.status;
    } else if (error && typeof error === 'object' && 'status' in error) {
      statusCode = error.status as number;
    } else if (error && typeof error === 'object' && 'statusCode' in error) {
      statusCode = error.statusCode as number;
    }

    // Extract rate limit information from response headers
    let rateLimitInfo: RateLimitInfo | undefined;
    if (response) {
      rateLimitInfo = this.extractRateLimitInfo(response);
    }

    return new EvidenceCollectorError(
      message,
      this.storageType,
      isRetryable,
      statusCode,
      rateLimitInfo
    );
  }

  /**
   * Extract rate limit information from HTTP response headers.
   * Looks for standard rate limit headers like Retry-After, X-RateLimit-Remaining, etc.
   * @param response HTTP response object
   * @returns Rate limit information if available
   */
  protected extractRateLimitInfo(response: Response): RateLimitInfo | undefined {
    const info: RateLimitInfo = {};

    // Retry-After header (standard HTTP header, can be seconds or HTTP date)
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      const retryAfterNum = parseInt(retryAfter, 10);
      if (!isNaN(retryAfterNum)) {
        info.retryAfter = retryAfterNum;
      }
    }

    // X-RateLimit-Remaining header (common in REST APIs)
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining) {
      const remainingNum = parseInt(remaining, 10);
      if (!isNaN(remainingNum)) {
        info.remaining = remainingNum;
      }
    }

    // X-RateLimit-Reset header (timestamp when limit resets)
    const reset = response.headers.get('X-RateLimit-Reset');
    if (reset) {
      const resetNum = parseInt(reset, 10);
      if (!isNaN(resetNum)) {
        info.reset = resetNum;
      }
    }

    // Return info only if we found at least one field
    return Object.keys(info).length > 0 ? info : undefined;
  }

  /**
   * Determine if an error is retryable based on error type and message.
   * Network errors, rate limits, and temporary failures are retryable.
   * Authentication errors and validation errors are not retryable.
   * @param error The error to check
   * @returns True if error is retryable
   */
  protected isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return true; // Unknown errors are retryable by default
    }

    const message = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Network-related errors are retryable
    if (
      errorName.includes('network') ||
      errorName.includes('timeout') ||
      errorName.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('enotfound') ||
      message.includes('network error') ||
      message.includes('timeout')
    ) {
      return true;
    }

    // Rate limit errors are retryable
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429') ||
      message.includes('throttl')
    ) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('internal server error') ||
      message.includes('service unavailable')
    ) {
      return true;
    }

    // Authentication/authorization errors are NOT retryable
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('authentication') ||
      message.includes('invalid credentials')
    ) {
      return false;
    }

    // Validation errors are NOT retryable
    if (
      message.includes('400') ||
      message.includes('bad request') ||
      message.includes('invalid') ||
      message.includes('validation')
    ) {
      return false;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Validate evidence data before storage.
   * @param evidenceData The evidence data to validate
   * @throws EvidenceCollectorError if validation fails
   */
  protected validateEvidenceData(evidenceData: EvidenceData): void {
    if (!evidenceData.prompt || typeof evidenceData.prompt !== 'string') {
      throw new EvidenceCollectorError(
        'Evidence data must include a valid prompt string',
        this.storageType,
        false
      );
    }

    if (!evidenceData.output || typeof evidenceData.output !== 'string') {
      throw new EvidenceCollectorError(
        'Evidence data must include a valid output string',
        this.storageType,
        false
      );
    }

    if (!evidenceData.evaluationRunId || typeof evidenceData.evaluationRunId !== 'string') {
      throw new EvidenceCollectorError(
        'Evidence data must include a valid evaluationRunId',
        this.storageType,
        false
      );
    }

    if (!evidenceData.testCaseId || typeof evidenceData.testCaseId !== 'string') {
      throw new EvidenceCollectorError(
        'Evidence data must include a valid testCaseId',
        this.storageType,
        false
      );
    }

    if (typeof evidenceData.iteration !== 'number' || evidenceData.iteration < 0) {
      throw new EvidenceCollectorError(
        'Evidence data must include a valid iteration number',
        this.storageType,
        false
      );
    }
  }

  /**
   * Create reference info from stored evidence.
   * Helper method for subclasses to create consistent ReferenceInfo objects.
   * @param referenceId The reference ID
   * @param storageLocation The storage location path/identifier
   * @param evaluationRunId The evaluation run ID
   * @param testCaseId Optional test case ID
   * @returns ReferenceInfo object
   */
  protected createReferenceInfo(
    referenceId: string,
    storageLocation: string,
    evaluationRunId: string,
    testCaseId?: string
  ): ReferenceInfo {
    return {
      referenceId,
      storageType: this.storageType,
      storageLocation,
      evaluationRunId,
      testCaseId,
      storedAt: new Date().toISOString(),
    };
  }
}

