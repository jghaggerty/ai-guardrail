/**
 * Credential Decryption Utilities
 *
 * Utilities for decrypting stored evidence collection credentials.
 * Reuses the same encryption pattern as store-api-key/decrypt-api-key functions.
 */

import type {
  EvidenceStorageType,
  EvidenceStorageCredentials,
  S3Credentials,
  SplunkCredentials,
  ELKCredentials,
} from './types.ts';
import { EvidenceCollectorError } from './types.ts';

// ============================================================================
// DECRYPTION FUNCTION
// ============================================================================

/**
 * Decrypt encrypted credentials using AES-256-GCM with PBKDF2 key derivation.
 * This is the reverse of the encryption used in store-evidence-credentials.
 * Uses the same pattern as decrypt-api-key function.
 * @param encryptedData Base64-encoded encrypted credentials
 * @param secret Encryption secret from environment variable
 * @returns Decrypted credentials as JSON string
 * @throws Error if decryption fails
 */
export async function decryptCredentials(
  encryptedData: string,
  secret: string
): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  try {
    // Decode base64 to get combined data
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Extract salt (16 bytes), iv (12 bytes), and encrypted data
    if (combined.length < 28) {
      throw new Error('Invalid encrypted data format: too short');
    }

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

    // Import the secret as key material for PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive the same AES-256 key using PBKDF2 with same parameters
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt the credentials
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    return decoder.decode(decrypted);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decrypt credentials: ${errorMessage}`);
  }
}

/**
 * Decrypt and parse credentials for a specific storage type.
 * @param encryptedData Base64-encoded encrypted credentials
 * @param storageType The storage type to validate against
 * @param secret Encryption secret from environment variable
 * @returns Decrypted credentials object of the appropriate type
 * @throws EvidenceCollectorError if decryption or parsing fails
 */
export async function decryptAndParseCredentials(
  encryptedData: string,
  storageType: EvidenceStorageType,
  secret: string
): Promise<EvidenceStorageCredentials> {
  try {
    // Decrypt the credentials
    const decryptedJson = await decryptCredentials(encryptedData, secret);

    // Parse the JSON
    let credentials: unknown;
    try {
      credentials = JSON.parse(decryptedJson);
    } catch (parseError) {
      throw new Error(
        `Failed to parse decrypted credentials as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    // Validate that it's an object
    if (typeof credentials !== 'object' || credentials === null) {
      throw new Error('Decrypted credentials must be a JSON object');
    }

    const creds = credentials as Record<string, unknown>;

    // Validate storage type matches
    if (creds.storageType !== storageType) {
      throw new Error(
        `Storage type mismatch: expected ${storageType}, got ${creds.storageType}`
      );
    }

    // Validate and return the appropriate credential type
    switch (storageType) {
      case 's3':
        return validateAndReturnS3Credentials(creds);

      case 'splunk':
        return validateAndReturnSplunkCredentials(creds);

      case 'elk':
        return validateAndReturnELKCredentials(creds);

      default:
        throw new EvidenceCollectorError(
          `Unsupported storage type: ${storageType}`,
          storageType,
          false
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new EvidenceCollectorError(
      `Failed to decrypt credentials: ${errorMessage}`,
      storageType,
      false
    );
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate and return S3 credentials.
 * @param creds Parsed credentials object
 * @returns Validated S3Credentials
 * @throws Error if validation fails
 */
function validateAndReturnS3Credentials(creds: Record<string, unknown>): S3Credentials {
  if (
    typeof creds.accessKeyId !== 'string' ||
    typeof creds.secretAccessKey !== 'string' ||
    typeof creds.region !== 'string' ||
    typeof creds.bucketName !== 'string'
  ) {
    throw new Error(
      'S3 credentials must include accessKeyId, secretAccessKey, region, and bucketName'
    );
  }

  const s3Creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    region: creds.region,
    bucketName: creds.bucketName,
  };

  // Optional fields
  if (typeof creds.iamRoleArn === 'string') {
    s3Creds.iamRoleArn = creds.iamRoleArn;
  }

  if (typeof creds.sessionToken === 'string') {
    s3Creds.sessionToken = creds.sessionToken;
  }

  return s3Creds;
}

/**
 * Validate and return Splunk credentials.
 * @param creds Parsed credentials object
 * @returns Validated SplunkCredentials
 * @throws Error if validation fails
 */
function validateAndReturnSplunkCredentials(
  creds: Record<string, unknown>
): SplunkCredentials {
  if (typeof creds.endpoint !== 'string' || typeof creds.index !== 'string') {
    throw new Error('Splunk credentials must include endpoint and index');
  }

  if (creds.authType !== 'token' && creds.authType !== 'username-password') {
    throw new Error(
      'Splunk credentials must have authType of "token" or "username-password"'
    );
  }

  const splunkCreds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: creds.endpoint,
    authType: creds.authType,
    index: creds.index,
  };

  if (creds.authType === 'token') {
    if (typeof creds.token !== 'string') {
      throw new Error('Splunk token authentication requires a token');
    }
    splunkCreds.token = creds.token;
  } else {
    if (
      typeof creds.username !== 'string' ||
      typeof creds.password !== 'string'
    ) {
      throw new Error(
        'Splunk username-password authentication requires username and password'
      );
    }
    splunkCreds.username = creds.username;
    splunkCreds.password = creds.password;
  }

  return splunkCreds;
}

/**
 * Validate and return ELK credentials.
 * @param creds Parsed credentials object
 * @returns Validated ELKCredentials
 * @throws Error if validation fails
 */
function validateAndReturnELKCredentials(creds: Record<string, unknown>): ELKCredentials {
  if (typeof creds.endpoint !== 'string' || typeof creds.index !== 'string') {
    throw new Error('ELK credentials must include endpoint and index');
  }

  if (creds.authType !== 'api-key' && creds.authType !== 'username-password') {
    throw new Error(
      'ELK credentials must have authType of "api-key" or "username-password"'
    );
  }

  const elkCreds: ELKCredentials = {
    storageType: 'elk',
    endpoint: creds.endpoint,
    authType: creds.authType,
    index: creds.index,
  };

  if (creds.authType === 'api-key') {
    if (typeof creds.apiKey !== 'string') {
      throw new Error('ELK API key authentication requires an apiKey');
    }
    elkCreds.apiKey = creds.apiKey;
  } else {
    if (
      typeof creds.username !== 'string' ||
      typeof creds.password !== 'string'
    ) {
      throw new Error(
        'ELK username-password authentication requires username and password'
      );
    }
    elkCreds.username = creds.username;
    elkCreds.password = creds.password;
  }

  return elkCreds;
}

// ============================================================================
// HELPER FUNCTION
// ============================================================================

/**
 * Get the encryption secret from environment variables.
 * Uses the same secret as API key encryption for consistency.
 * @returns Encryption secret
 * @throws Error if secret is not configured
 */
export function getEncryptionSecret(): string {
  const secret = Deno.env.get('API_KEY_ENCRYPTION_SECRET');
  if (!secret) {
    throw new Error(
      'API_KEY_ENCRYPTION_SECRET environment variable is not configured'
    );
  }
  return secret;
}

