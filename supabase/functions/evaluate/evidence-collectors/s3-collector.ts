/**
 * S3 Evidence Collector
 *
 * Implements evidence storage using AWS S3.
 * Supports access key/secret key authentication and IAM role-based authentication.
 */

import { S3Client, PutObjectCommand, HeadBucketCommand, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.490.0';
import type { S3Credentials, EvidenceData, ReferenceInfo } from './types.ts';
import { BaseEvidenceCollector } from './base.ts';
import { EvidenceCollectorError } from './types.ts';

// ============================================================================
// S3 EVIDENCE COLLECTOR
// ============================================================================

/**
 * S3 implementation of evidence collector.
 * Stores evidence as JSON objects in S3 buckets.
 */
export class S3Collector extends BaseEvidenceCollector {
  private readonly credentials: S3Credentials;
  private readonly s3Client: S3Client;

  constructor(credentials: S3Credentials) {
    super('s3');
    
    // Validate required credentials
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      throw new EvidenceCollectorError(
        'S3 credentials must include accessKeyId and secretAccessKey',
        's3',
        false
      );
    }

    if (!credentials.bucketName) {
      throw new EvidenceCollectorError(
        'S3 credentials must include bucketName',
        's3',
        false
      );
    }

    if (!credentials.region) {
      throw new EvidenceCollectorError(
        'S3 credentials must include region',
        's3',
        false
      );
    }

    this.credentials = credentials;

    // Initialize S3 client with credentials
    const clientConfig: {
      region: string;
      credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
      };
    } = {
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    };

    // Add session token if provided (for temporary credentials)
    if (credentials.sessionToken) {
      clientConfig.credentials.sessionToken = credentials.sessionToken;
    }

    this.s3Client = new S3Client(clientConfig);
  }

  /**
   * Store evidence data in S3.
   * Creates a JSON object in the configured S3 bucket.
   * @param evidenceData The evidence data to store
   * @returns Promise resolving to reference information
   * @throws EvidenceCollectorError if storage fails
   */
  async storeEvidence(evidenceData: EvidenceData): Promise<ReferenceInfo> {
    // Validate evidence data
    this.validateEvidenceData(evidenceData);

    // Generate reference ID
    const referenceId = this.generateReferenceId(
      evidenceData.evaluationRunId,
      evidenceData.testCaseId,
      evidenceData.iteration
    );

    // Generate S3 key path
    // Format: evidence/{evaluationRunId}/{testCaseId}/{iteration}-{referenceId}.json
    const key = this.generateS3Key(
      evidenceData.evaluationRunId,
      evidenceData.testCaseId,
      evidenceData.iteration,
      referenceId
    );

    // Prepare evidence object as JSON
    const evidenceObject = {
      referenceId,
      evaluationRunId: evidenceData.evaluationRunId,
      testCaseId: evidenceData.testCaseId,
      iteration: evidenceData.iteration,
      timestamp: evidenceData.timestamp,
      prompt: evidenceData.prompt,
      output: evidenceData.output,
      metadata: evidenceData.metadata || {},
    };

    const jsonContent = JSON.stringify(evidenceObject, null, 2);

    // Store in S3 with retry logic
    return await this.withRetry(async () => {
      try {
        const command = new PutObjectCommand({
          Bucket: this.credentials.bucketName,
          Key: key,
          Body: jsonContent,
          ContentType: 'application/json',
          Metadata: {
            'evaluation-run-id': evidenceData.evaluationRunId,
            'test-case-id': evidenceData.testCaseId,
            'iteration': evidenceData.iteration.toString(),
            'reference-id': referenceId,
          },
        });

        await this.s3Client.send(command);

        // Create storage location string (bucket/key)
        const storageLocation = `s3://${this.credentials.bucketName}/${key}`;

        // Return reference info
        return this.createReferenceInfo(
          referenceId,
          storageLocation,
          evidenceData.evaluationRunId,
          evidenceData.testCaseId
        );
      } catch (error) {
        // Extract response from AWS SDK error if available
        let response: Response | undefined;
        if (error && typeof error === 'object' && '$metadata' in error) {
          // AWS SDK v3 errors have $metadata with httpStatusCode
          const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
          if (metadata?.httpStatusCode) {
            // Create a mock Response for rate limit extraction
            response = new Response(null, { status: metadata.httpStatusCode });
          }
        }
        
        const collectorError = this.createCollectorError(
          error,
          `Failed to store evidence in S3: ${error instanceof Error ? error.message : String(error)}`,
          response
        );
        throw collectorError;
      }
    });
  }

  /**
   * Test S3 connectivity and permissions.
   * Attempts to perform a HeadBucket operation to verify access.
   * @returns Promise resolving to true if connection is successful
   * @throws EvidenceCollectorError if connection test fails
   */
  async testConnection(): Promise<boolean> {
    return await this.withRetry(async () => {
      try {
        // Test bucket access with HeadBucket command
        const command = new HeadBucketCommand({
          Bucket: this.credentials.bucketName,
        });

        await this.s3Client.send(command);

        // Also test write permissions by attempting to put a test object
        // (we'll delete it immediately or use a test key that can be overwritten)
        const testKey = `evidence/.test-connection-${Date.now()}.json`;
        const testCommand = new PutObjectCommand({
          Bucket: this.credentials.bucketName,
          Key: testKey,
          Body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
          ContentType: 'application/json',
        });

        await this.s3Client.send(testCommand);

        console.log(`[S3] Successfully tested connection to bucket: ${this.credentials.bucketName}`);
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Provide more specific error messages
        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          throw new EvidenceCollectorError(
            `S3 access denied. Check IAM permissions for bucket: ${this.credentials.bucketName}`,
            's3',
            false,
            403
          );
        }

        if (errorMessage.includes('404') || errorMessage.includes('NoSuchBucket')) {
          throw new EvidenceCollectorError(
            `S3 bucket not found: ${this.credentials.bucketName}`,
            's3',
            false,
            404
          );
        }

        if (errorMessage.includes('InvalidAccessKeyId') || errorMessage.includes('SignatureDoesNotMatch')) {
          throw new EvidenceCollectorError(
            'Invalid S3 credentials. Check access key ID and secret access key.',
            's3',
            false,
            401
          );
        }

        const collectorError = this.createCollectorError(
          error,
          `S3 connection test failed: ${errorMessage}`
        );
        throw collectorError;
      }
    });
  }

  /**
   * Generate S3 key path for evidence storage.
   * Format: evidence/{evaluationRunId}/{testCaseId}/{iteration}-{referenceId}.json
   * @param evaluationRunId The evaluation run ID
   * @param testCaseId The test case ID
   * @param iteration The iteration number
   * @param referenceId The reference ID
   * @returns S3 key path string
   */
  private generateS3Key(
    evaluationRunId: string,
    testCaseId: string,
    iteration: number,
    referenceId: string
  ): string {
    // Sanitize IDs to ensure valid S3 key format
    const sanitizeKey = (str: string): string => {
      // Replace invalid characters with hyphens
      return str.replace(/[^a-zA-Z0-9._-]/g, '-');
    };

    const sanitizedRunId = sanitizeKey(evaluationRunId);
    const sanitizedTestCaseId = sanitizeKey(testCaseId);
    const sanitizedRefId = sanitizeKey(referenceId);

    // Build key path: evidence/{runId}/{testCaseId}/{iteration}-{refId}.json
    return `evidence/${sanitizedRunId}/${sanitizedTestCaseId}/${iteration}-${sanitizedRefId}.json`;
  }

  /**
   * Get the S3 client instance (for testing purposes).
   * @returns S3Client instance
   */
  getS3Client(): S3Client {
    return this.s3Client;
  }

  /**
   * Get the bucket name (for testing purposes).
   * @returns Bucket name
   */
  getBucketName(): string {
    return this.credentials.bucketName;
  }
}

