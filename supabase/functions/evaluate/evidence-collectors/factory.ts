/**
 * Evidence Collector Factory
 *
 * Factory function to create appropriate evidence collector instances
 * based on storage type and credentials.
 */

import type {
  EvidenceCollector,
  EvidenceStorageType,
  EvidenceStorageCredentials,
  S3Credentials,
  SplunkCredentials,
  ELKCredentials,
} from './types.ts';
import { EvidenceCollectorError } from './types.ts';
import { S3Collector } from './s3-collector.ts';
import { SplunkCollector } from './splunk-collector.ts';
import { ELKCollector } from './elk-collector.ts';

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an evidence collector instance based on storage type and credentials.
 * @param storageType The type of storage system ('s3', 'splunk', or 'elk')
 * @param credentials The decrypted credentials for the storage system
 * @returns EvidenceCollector instance
 * @throws EvidenceCollectorError if storage type is unsupported or credentials are invalid
 */
export function createEvidenceCollector(
  storageType: EvidenceStorageType,
  credentials: EvidenceStorageCredentials
): EvidenceCollector {
  // Validate that storage type matches credentials type
  if (credentials.storageType !== storageType) {
    throw new EvidenceCollectorError(
      `Storage type mismatch: expected ${storageType}, got ${credentials.storageType}`,
      storageType,
      false
    );
  }

  switch (storageType) {
    case 's3':
      return createS3Collector(credentials as S3Credentials);

    case 'splunk':
      return createSplunkCollector(credentials as SplunkCredentials);

    case 'elk':
      return createELKCollector(credentials as ELKCredentials);

    default:
      throw new EvidenceCollectorError(
        `Unsupported storage type: ${storageType}`,
        storageType,
        false
      );
  }
}

/**
 * Create an S3 collector instance.
 * @param credentials S3 credentials
 * @returns S3Collector instance
 */
function createS3Collector(credentials: S3Credentials): S3Collector {
  try {
    return new S3Collector(credentials);
  } catch (error) {
    if (error instanceof EvidenceCollectorError) {
      throw error;
    }
    throw new EvidenceCollectorError(
      `Failed to create S3 collector: ${error instanceof Error ? error.message : String(error)}`,
      's3',
      false
    );
  }
}

/**
 * Create a Splunk collector instance.
 * @param credentials Splunk credentials
 * @returns SplunkCollector instance
 */
function createSplunkCollector(credentials: SplunkCredentials): SplunkCollector {
  try {
    return new SplunkCollector(credentials);
  } catch (error) {
    if (error instanceof EvidenceCollectorError) {
      throw error;
    }
    throw new EvidenceCollectorError(
      `Failed to create Splunk collector: ${error instanceof Error ? error.message : String(error)}`,
      'splunk',
      false
    );
  }
}

/**
 * Create an ELK/Elasticsearch collector instance.
 * @param credentials ELK credentials
 * @returns ELKCollector instance
 */
function createELKCollector(credentials: ELKCredentials): ELKCollector {
  try {
    return new ELKCollector(credentials);
  } catch (error) {
    if (error instanceof EvidenceCollectorError) {
      throw error;
    }
    throw new EvidenceCollectorError(
      `Failed to create ELK collector: ${error instanceof Error ? error.message : String(error)}`,
      'elk',
      false
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a storage type is supported.
 * @param storageType The storage type to check
 * @returns True if the storage type is supported
 */
export function isStorageTypeSupported(storageType: string): boolean {
  return ['s3', 'splunk', 'elk'].includes(storageType);
}

/**
 * Validate that credentials match the expected storage type.
 * @param storageType The expected storage type
 * @param credentials The credentials to validate
 * @returns True if credentials match the storage type
 */
export function validateCredentialsType(
  storageType: EvidenceStorageType,
  credentials: EvidenceStorageCredentials
): boolean {
  return credentials.storageType === storageType;
}

/**
 * Get a list of all supported storage types.
 * @returns Array of supported storage type strings
 */
export function getSupportedStorageTypes(): EvidenceStorageType[] {
  return ['s3', 'splunk', 'elk'];
}

