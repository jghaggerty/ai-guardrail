/**
 * Evidence Collector Types
 *
 * This module defines TypeScript interfaces for the evidence collection system
 * that stores raw prompts and outputs in customer-side storage (S3, Splunk, ELK).
 */

// ============================================================================
// ENUMS & BASIC TYPES
// ============================================================================

/**
 * Supported evidence storage types
 */
export type EvidenceStorageType = 's3' | 'splunk' | 'elk';

// ============================================================================
// EVIDENCE DATA TYPES
// ============================================================================

/**
 * Raw evidence data to be stored in customer storage systems.
 * Contains the prompt and output from a single test case iteration.
 */
export interface EvidenceData {
  /** The raw prompt that was sent to the LLM */
  prompt: string;
  /** The raw output/response from the LLM */
  output: string;
  /** Test case ID that generated this evidence */
  testCaseId: string;
  /** Iteration number within the test case */
  iteration: number;
  /** Timestamp when this evidence was captured */
  timestamp: string;
  /** Evaluation run ID this evidence belongs to */
  evaluationRunId: string;
  /** Additional metadata (optional) */
  metadata?: Record<string, unknown>;
}

/**
 * Reference information linking BiasLens scores to customer-stored evidence.
 * This is what gets stored in the BiasLens database.
 */
export interface ReferenceInfo {
  /** Unique reference ID for this evidence entry */
  referenceId: string;
  /** Storage type where evidence is located */
  storageType: EvidenceStorageType;
  /** Storage location path/identifier (e.g., S3 bucket/key, Splunk index/doc ID, ELK index/doc ID) */
  storageLocation: string;
  /** Evaluation run ID this reference belongs to */
  evaluationRunId: string;
  /** Test case ID (if per-test-case references are used) */
  testCaseId?: string;
  /** Timestamp when evidence was stored */
  storedAt: string;
}

// ============================================================================
// STORAGE CREDENTIAL TYPES
// ============================================================================

/**
 * Base interface for storage credentials.
 * All storage-specific credentials extend this.
 */
export interface StorageCredentials {
  /** Type of storage system */
  storageType: EvidenceStorageType;
}

/**
 * S3 storage credentials and configuration.
 */
export interface S3Credentials extends StorageCredentials {
  storageType: 's3';
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /** AWS region (e.g., 'us-east-1') */
  region: string;
  /** S3 bucket name */
  bucketName: string;
  /** Optional IAM role ARN for role-based authentication */
  iamRoleArn?: string;
  /** Optional session token for temporary credentials */
  sessionToken?: string;
}

/**
 * Splunk storage credentials and configuration.
 */
export interface SplunkCredentials extends StorageCredentials {
  storageType: 'splunk';
  /** Splunk endpoint URL (e.g., 'https://splunk.example.com:8089') */
  endpoint: string;
  /** Authentication type: 'token' or 'username-password' */
  authType: 'token' | 'username-password';
  /** Authentication token (required if authType is 'token') */
  token?: string;
  /** Username (required if authType is 'username-password') */
  username?: string;
  /** Password (required if authType is 'username-password') */
  password?: string;
  /** Splunk index name where evidence will be stored */
  index: string;
}

/**
 * ELK/Elasticsearch storage credentials and configuration.
 */
export interface ELKCredentials extends StorageCredentials {
  storageType: 'elk';
  /** Elasticsearch endpoint URL (e.g., 'https://elasticsearch.example.com:9200') */
  endpoint: string;
  /** Authentication type: 'api-key' or 'username-password' */
  authType: 'api-key' | 'username-password';
  /** API key (required if authType is 'api-key') */
  apiKey?: string;
  /** Username (required if authType is 'username-password') */
  username?: string;
  /** Password (required if authType is 'username-password') */
  password?: string;
  /** Elasticsearch index name where evidence will be stored */
  index: string;
}

/**
 * Union type for all credential types.
 */
export type EvidenceStorageCredentials = S3Credentials | SplunkCredentials | ELKCredentials;

// ============================================================================
// EVIDENCE COLLECTOR INTERFACE
// ============================================================================

/**
 * Result of storing evidence in customer storage.
 */
export interface StoreEvidenceResult {
  /** Whether the storage operation succeeded */
  success: boolean;
  /** Reference information if storage succeeded */
  referenceInfo?: ReferenceInfo;
  /** Error message if storage failed */
  error?: string;
  /** Storage location path/identifier */
  storageLocation?: string;
}

/**
 * Interface for evidence collectors that store evidence in customer storage systems.
 * Each storage type (S3, Splunk, ELK) implements this interface.
 */
export interface EvidenceCollector {
  /** Type of storage system this collector handles */
  storageType: EvidenceStorageType;
  
  /**
   * Store evidence data in the customer storage system.
   * @param evidenceData The evidence data to store
   * @returns Promise resolving to reference information
   * @throws Error if storage fails after retries
   */
  storeEvidence(evidenceData: EvidenceData): Promise<ReferenceInfo>;
  
  /**
   * Test connectivity and permissions for the storage system.
   * @returns Promise resolving to true if connection is successful
   * @throws Error if connection test fails
   */
  testConnection(): Promise<boolean>;
  
  /**
   * Generate a unique reference ID for evidence.
   * Format may vary by storage type.
   * @param evaluationRunId The evaluation run ID
   * @param testCaseId Optional test case ID
   * @param iteration Optional iteration number
   * @returns A unique reference ID string
   */
  generateReferenceId(
    evaluationRunId: string,
    testCaseId?: string,
    iteration?: number
  ): string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Rate limit information extracted from error responses.
 */
export interface RateLimitInfo {
  /** Retry after this many seconds (from Retry-After header) */
  retryAfter?: number;
  /** Remaining requests in current window */
  remaining?: number;
  /** When the rate limit window resets (timestamp) */
  reset?: number;
}

/**
 * Error thrown by evidence collectors.
 */
export class EvidenceCollectorError extends Error {
  constructor(
    message: string,
    public readonly storageType: EvidenceStorageType,
    public readonly isRetryable: boolean = false,
    public readonly statusCode?: number,
    public readonly rateLimitInfo?: RateLimitInfo
  ) {
    super(message);
    this.name = 'EvidenceCollectorError';
  }
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Evidence collection configuration from the database.
 */
export interface EvidenceCollectionConfig {
  /** Configuration ID */
  id: string;
  /** Team ID this configuration belongs to */
  teamId: string;
  /** Storage type */
  storageType: EvidenceStorageType;
  /** Whether collector mode is enabled */
  isEnabled: boolean;
  /** Encrypted credentials (needs decryption before use) */
  credentialsEncrypted: string | null;
  /** Storage-specific configuration (bucket name, index, etc.) */
  configuration: Record<string, unknown>;
  /** Last time connection was tested */
  lastTestedAt: string | null;
}

