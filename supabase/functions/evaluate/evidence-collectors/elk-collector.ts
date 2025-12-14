/**
 * ELK/Elasticsearch Evidence Collector
 *
 * Implements evidence storage using Elasticsearch REST API.
 * Supports API key authentication and username/password (Basic) authentication.
 */

import type { ELKCredentials, EvidenceData, ReferenceInfo } from './types.ts';
import { BaseEvidenceCollector } from './base.ts';
import { EvidenceCollectorError } from './types.ts';

// ============================================================================
// ELK/ELASTICSEARCH EVIDENCE COLLECTOR
// ============================================================================

/**
 * ELK/Elasticsearch implementation of evidence collector.
 * Stores evidence as documents in Elasticsearch indexes using REST API.
 */
export class ELKCollector extends BaseEvidenceCollector {
  private readonly credentials: ELKCredentials;
  private readonly endpoint: string;

  constructor(credentials: ELKCredentials) {
    super('elk');
    
    // Validate required credentials
    if (!credentials.endpoint) {
      throw new EvidenceCollectorError(
        'Elasticsearch credentials must include endpoint URL',
        'elk',
        false
      );
    }

    if (!credentials.index) {
      throw new EvidenceCollectorError(
        'Elasticsearch credentials must include index name',
        'elk',
        false
      );
    }

    // Validate authentication credentials based on auth type
    if (credentials.authType === 'api-key') {
      if (!credentials.apiKey) {
        throw new EvidenceCollectorError(
          'Elasticsearch API key authentication requires an apiKey',
          'elk',
          false
        );
      }
    } else if (credentials.authType === 'username-password') {
      if (!credentials.username || !credentials.password) {
        throw new EvidenceCollectorError(
          'Elasticsearch username-password authentication requires username and password',
          'elk',
          false
        );
      }
    } else {
      throw new EvidenceCollectorError(
        `Invalid Elasticsearch auth type: ${credentials.authType}`,
        'elk',
        false
      );
    }

    this.credentials = credentials;

    // Normalize endpoint URL (remove trailing slash)
    this.endpoint = credentials.endpoint.replace(/\/$/, '');
  }

  /**
   * Store evidence data in Elasticsearch.
   * Creates a document in the configured Elasticsearch index.
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

    // Prepare evidence document object
    const documentData = {
      referenceId,
      evaluationRunId: evidenceData.evaluationRunId,
      testCaseId: evidenceData.testCaseId,
      iteration: evidenceData.iteration,
      timestamp: evidenceData.timestamp,
      prompt: evidenceData.prompt,
      output: evidenceData.output,
      metadata: evidenceData.metadata || {},
    };

    // Store in Elasticsearch with retry logic
    return await this.withRetry(async () => {
      try {
        // Create document in Elasticsearch
        const documentId = await this.createDocument(documentData, referenceId);

        // Create storage location string (index/document ID)
        const storageLocation = `elasticsearch://${this.credentials.index}/${documentId}`;

        // Return reference info
        return this.createReferenceInfo(
          referenceId,
          storageLocation,
          evidenceData.evaluationRunId,
          evidenceData.testCaseId
        );
      } catch (error) {
        const collectorError = this.createCollectorError(
          error,
          `Failed to store evidence in Elasticsearch: ${error instanceof Error ? error.message : String(error)}`
        );
        throw collectorError;
      }
    });
  }

  /**
   * Create a document in Elasticsearch.
   * @param documentData The document data to store
   * @param referenceId The reference ID (used as document ID)
   * @returns Document ID
   */
  private async createDocument(documentData: Record<string, unknown>, referenceId: string): Promise<string> {
    // Elasticsearch endpoint: POST /{index}/_doc/{id}
    const docUrl = `${this.endpoint}/${encodeURIComponent(this.credentials.index)}/_doc/${encodeURIComponent(referenceId)}`;

    // Prepare headers with authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication header
    if (this.credentials.authType === 'api-key') {
      if (!this.credentials.apiKey) {
        throw new EvidenceCollectorError(
          'Elasticsearch API key is required',
          'elk',
          false
        );
      }
      // API key format: base64(id:api_key)
      // The apiKey in credentials should already be the base64-encoded id:api_key
      headers['Authorization'] = `ApiKey ${this.credentials.apiKey}`;
    } else {
      // Basic authentication: base64(username:password)
      if (!this.credentials.username || !this.credentials.password) {
        throw new EvidenceCollectorError(
          'Elasticsearch username and password are required',
          'elk',
          false
        );
      }
      const credentials = `${this.credentials.username}:${this.credentials.password}`;
      const encodedCredentials = btoa(credentials);
      headers['Authorization'] = `Basic ${encodedCredentials}`;
    }

    const response = await fetch(docUrl, {
      method: 'PUT', // Use PUT to create/update with specific ID
      headers,
      body: JSON.stringify(documentData),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorMessage = `Elasticsearch request failed: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.reason) {
          errorMessage += `. ${errorJson.error.reason}`;
        }
      } catch {
        // If parsing fails, use the raw error text
        if (errorText) {
          errorMessage += `. ${errorText}`;
        }
      }

      const rateLimitInfo = this.extractRateLimitInfo(response);
      throw new EvidenceCollectorError(
        errorMessage,
        'elk',
        response.status >= 500 || response.status === 429, // Retryable for 5xx and rate limits
        response.status,
        rateLimitInfo
      );
    }

    const result = await response.json().catch(() => ({}));
    
    // Elasticsearch returns _id in the response
    const documentId = result._id || referenceId;
    return documentId as string;
  }

  /**
   * Test Elasticsearch connectivity and permissions.
   * Attempts to authenticate and verify index access.
   * @returns Promise resolving to true if connection is successful
   * @throws EvidenceCollectorError if connection test fails
   */
  async testConnection(): Promise<boolean> {
    return await this.withRetry(async () => {
      try {
        // Test cluster health first
        await this.testClusterHealth();

        // Test index access
        await this.testIndexAccess();

        console.log(`[Elasticsearch] Successfully tested connection to: ${this.endpoint}`);
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Provide more specific error messages
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          throw new EvidenceCollectorError(
            'Elasticsearch authentication failed. Check credentials.',
            'elk',
            false,
            401
          );
        }

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          throw new EvidenceCollectorError(
            `Elasticsearch access denied. Check permissions for index: ${this.credentials.index}`,
            'elk',
            false,
            403
          );
        }

        if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          // Index might not exist yet, which is okay - we can create it
          // But if cluster is not found, that's an error
          if (errorMessage.includes('cluster') || errorMessage.includes('node')) {
            throw new EvidenceCollectorError(
              `Elasticsearch cluster not found or unreachable: ${this.endpoint}`,
              'elk',
              false,
              404
            );
          }
          // Index not found is okay - we'll create it on first write
          console.log(`[Elasticsearch] Index ${this.credentials.index} does not exist yet (will be created on first write)`);
          return true;
        }

        const collectorError = this.createCollectorError(
          error,
          `Elasticsearch connection test failed: ${errorMessage}`
        );
        throw collectorError;
      }
    });
  }

  /**
   * Test Elasticsearch cluster health.
   * @throws Error if cluster is not accessible
   */
  private async testClusterHealth(): Promise<void> {
    const healthUrl = `${this.endpoint}/_cluster/health`;

    // Prepare headers with authentication
    const headers: Record<string, string> = {};

    if (this.credentials.authType === 'api-key') {
      if (!this.credentials.apiKey) {
        throw new EvidenceCollectorError(
          'Elasticsearch API key is required',
          'elk',
          false
        );
      }
      headers['Authorization'] = `ApiKey ${this.credentials.apiKey}`;
    } else {
      if (!this.credentials.username || !this.credentials.password) {
        throw new EvidenceCollectorError(
          'Elasticsearch username and password are required',
          'elk',
          false
        );
      }
      const credentials = `${this.credentials.username}:${this.credentials.password}`;
      const encodedCredentials = btoa(credentials);
      headers['Authorization'] = `Basic ${encodedCredentials}`;
    }

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Elasticsearch cluster health check failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const health = await response.json().catch(() => ({}));
    if (health.status === 'red') {
      throw new Error('Elasticsearch cluster is in red status (unhealthy)');
    }
  }

  /**
   * Test index access by attempting to get index information.
   * @throws Error if index access fails
   */
  private async testIndexAccess(): Promise<void> {
    const indexUrl = `${this.endpoint}/${encodeURIComponent(this.credentials.index)}`;

    // Prepare headers with authentication
    const headers: Record<string, string> = {};

    if (this.credentials.authType === 'api-key') {
      if (!this.credentials.apiKey) {
        throw new EvidenceCollectorError(
          'Elasticsearch API key is required',
          'elk',
          false
        );
      }
      headers['Authorization'] = `ApiKey ${this.credentials.apiKey}`;
    } else {
      if (!this.credentials.username || !this.credentials.password) {
        throw new EvidenceCollectorError(
          'Elasticsearch username and password are required',
          'elk',
          false
        );
      }
      const credentials = `${this.credentials.username}:${this.credentials.password}`;
      const encodedCredentials = btoa(credentials);
      headers['Authorization'] = `Basic ${encodedCredentials}`;
    }

    // Try to get index info (HEAD request to check if index exists)
    const response = await fetch(indexUrl, {
      method: 'HEAD',
      headers,
    });

    // 404 is okay - index doesn't exist yet, we'll create it on first write
    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Elasticsearch index access check failed: ${response.status} ${response.statusText}. ${errorText}`);
    }
  }

  /**
   * Get the endpoint URL (for testing purposes).
   * @returns Endpoint URL
   */
  getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Get the index name (for testing purposes).
   * @returns Index name
   */
  getIndexName(): string {
    return this.credentials.index;
  }
}

