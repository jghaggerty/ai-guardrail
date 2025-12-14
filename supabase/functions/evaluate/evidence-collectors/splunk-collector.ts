/**
 * Splunk Evidence Collector
 *
 * Implements evidence storage using Splunk REST API.
 * Supports token-based authentication (HEC) and username/password authentication.
 */

import type { SplunkCredentials, EvidenceData, ReferenceInfo } from './types.ts';
import { BaseEvidenceCollector } from './base.ts';
import { EvidenceCollectorError } from './types.ts';

// ============================================================================
// SPLUNK EVIDENCE COLLECTOR
// ============================================================================

/**
 * Splunk implementation of evidence collector.
 * Stores evidence as events in Splunk indexes using REST API.
 */
export class SplunkCollector extends BaseEvidenceCollector {
  private readonly credentials: SplunkCredentials;
  private readonly hecEndpoint: string;
  private readonly managementEndpoint: string;

  constructor(credentials: SplunkCredentials) {
    super('splunk');
    
    // Validate required credentials
    if (!credentials.endpoint) {
      throw new EvidenceCollectorError(
        'Splunk credentials must include endpoint URL',
        'splunk',
        false
      );
    }

    if (!credentials.index) {
      throw new EvidenceCollectorError(
        'Splunk credentials must include index name',
        'splunk',
        false
      );
    }

    // Validate authentication credentials based on auth type
    if (credentials.authType === 'token') {
      if (!credentials.token) {
        throw new EvidenceCollectorError(
          'Splunk token authentication requires a token',
          'splunk',
          false
        );
      }
    } else if (credentials.authType === 'username-password') {
      if (!credentials.username || !credentials.password) {
        throw new EvidenceCollectorError(
          'Splunk username-password authentication requires username and password',
          'splunk',
          false
        );
      }
    } else {
      throw new EvidenceCollectorError(
        `Invalid Splunk auth type: ${credentials.authType}`,
        'splunk',
        false
      );
    }

    this.credentials = credentials;

    // Normalize endpoint URL (remove trailing slash)
    const baseUrl = credentials.endpoint.replace(/\/$/, '');
    
    // HEC (HTTP Event Collector) endpoint - typically on port 8088
    // If endpoint is on 8089 (management port), try 8088 for HEC
    if (baseUrl.includes(':8089')) {
      this.hecEndpoint = baseUrl.replace(':8089', ':8088');
    } else if (!baseUrl.includes(':')) {
      // No port specified, assume default HEC port
      this.hecEndpoint = `${baseUrl}:8088`;
    } else {
      this.hecEndpoint = baseUrl;
    }

    // Management API endpoint - typically on port 8089
    if (baseUrl.includes(':8088')) {
      this.managementEndpoint = baseUrl.replace(':8088', ':8089');
    } else if (!baseUrl.includes(':')) {
      this.managementEndpoint = `${baseUrl}:8089`;
    } else {
      this.managementEndpoint = baseUrl;
    }
  }

  /**
   * Store evidence data in Splunk.
   * Creates an event in the configured Splunk index.
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

    // Prepare evidence event object
    const eventData = {
      referenceId,
      evaluationRunId: evidenceData.evaluationRunId,
      testCaseId: evidenceData.testCaseId,
      iteration: evidenceData.iteration,
      timestamp: evidenceData.timestamp,
      prompt: evidenceData.prompt,
      output: evidenceData.output,
      metadata: evidenceData.metadata || {},
    };

    // Store in Splunk with retry logic
    return await this.withRetry(async () => {
      try {
        let documentId: string;

        if (this.credentials.authType === 'token') {
          // Use HEC (HTTP Event Collector) endpoint for token auth
          documentId = await this.storeViaHEC(eventData, referenceId);
        } else {
          // Use management API for username/password auth
          documentId = await this.storeViaManagementAPI(eventData, referenceId);
        }

        // Create storage location string (index/document ID)
        const storageLocation = `splunk://${this.credentials.index}/${documentId}`;

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
          `Failed to store evidence in Splunk: ${error instanceof Error ? error.message : String(error)}`
        );
        throw collectorError;
      }
    });
  }

  /**
   * Store evidence using Splunk HEC (HTTP Event Collector) endpoint.
   * @param eventData The event data to store
   * @param referenceId The reference ID
   * @returns Document ID (acknowledgment ID from Splunk)
   */
  private async storeViaHEC(eventData: Record<string, unknown>, referenceId: string): Promise<string> {
    if (!this.credentials.token) {
      throw new EvidenceCollectorError(
        'Splunk token is required for HEC authentication',
        'splunk',
        false
      );
    }

    const hecUrl = `${this.hecEndpoint}/services/collector`;
    
    // HEC expects events in a specific format
    const hecPayload = {
      event: eventData,
      index: this.credentials.index,
      sourcetype: 'biaslens:evidence',
      source: 'biaslens-evidence-collector',
    };

    const response = await fetch(hecUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Splunk ${this.credentials.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hecPayload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      const rateLimitInfo = this.extractRateLimitInfo(response);
      throw new EvidenceCollectorError(
        `Splunk HEC request failed: ${response.status} ${response.statusText}. ${errorText}`,
        'splunk',
        response.status >= 500 || response.status === 429, // Retryable for 5xx and rate limits
        response.status,
        rateLimitInfo
      );
    }

    const result = await response.json().catch(() => ({}));
    
    // HEC returns acknowledgment ID or event ID
    const documentId = result.ackId || result.id || referenceId;
    return documentId as string;
  }

  /**
   * Store evidence using Splunk Management API.
   * Used for username/password authentication.
   * @param eventData The event data to store
   * @param referenceId The reference ID
   * @returns Document ID
   */
  private async storeViaManagementAPI(eventData: Record<string, unknown>, referenceId: string): Promise<string> {
    if (!this.credentials.username || !this.credentials.password) {
      throw new EvidenceCollectorError(
        'Splunk username and password are required for management API authentication',
        'splunk',
        false
      );
    }

    // First, authenticate to get a session token
    const authUrl = `${this.managementEndpoint}/services/auth/login`;
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: this.credentials.username,
        password: this.credentials.password,
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text().catch(() => 'Unknown error');
      throw new EvidenceCollectorError(
        `Splunk authentication failed: ${authResponse.status} ${authResponse.statusText}. ${errorText}`,
        'splunk',
        false, // Auth failures are not retryable
        authResponse.status
      );
    }

    const authXml = await authResponse.text();
    // Extract session key from XML response
    const sessionKeyMatch = authXml.match(/<sessionKey>([^<]+)<\/sessionKey>/);
    if (!sessionKeyMatch) {
      throw new EvidenceCollectorError(
        'Failed to extract session key from Splunk authentication response',
        'splunk',
        false
      );
    }

    const sessionKey = sessionKeyMatch[1];

    // Now create the event using the receiver endpoint
    const receiverUrl = `${this.managementEndpoint}/services/receivers/simple`;
    const eventPayload = {
      ...eventData,
      index: this.credentials.index,
      sourcetype: 'biaslens:evidence',
      source: 'biaslens-evidence-collector',
    };

    const eventResponse = await fetch(receiverUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Splunk ${sessionKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!eventResponse.ok) {
      const errorText = await eventResponse.text().catch(() => 'Unknown error');
      const rateLimitInfo = this.extractRateLimitInfo(eventResponse);
      throw new EvidenceCollectorError(
        `Splunk event creation failed: ${eventResponse.status} ${eventResponse.statusText}. ${errorText}`,
        'splunk',
        eventResponse.status >= 500 || eventResponse.status === 429,
        eventResponse.status,
        rateLimitInfo
      );
    }

    // Management API doesn't return a document ID, so we use the reference ID
    // In Splunk, events are indexed and can be searched by the reference ID
    return referenceId;
  }

  /**
   * Test Splunk connectivity and permissions.
   * Attempts to authenticate and verify index access.
   * @returns Promise resolving to true if connection is successful
   * @throws EvidenceCollectorError if connection test fails
   */
  async testConnection(): Promise<boolean> {
    return await this.withRetry(async () => {
      try {
        if (this.credentials.authType === 'token') {
          // Test HEC endpoint
          return await this.testHECConnection();
        } else {
          // Test management API connection
          return await this.testManagementAPIConnection();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Provide more specific error messages
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          throw new EvidenceCollectorError(
            'Splunk authentication failed. Check credentials.',
            'splunk',
            false,
            401
          );
        }

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          throw new EvidenceCollectorError(
            `Splunk access denied. Check permissions for index: ${this.credentials.index}`,
            'splunk',
            false,
            403
          );
        }

        if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          throw new EvidenceCollectorError(
            `Splunk index not found: ${this.credentials.index}`,
            'splunk',
            false,
            404
          );
        }

        const collectorError = this.createCollectorError(
          error,
          `Splunk connection test failed: ${errorMessage}`
        );
        throw collectorError;
      }
    });
  }

  /**
   * Test HEC connection.
   * @returns Promise resolving to true if connection is successful
   */
  private async testHECConnection(): Promise<boolean> {
    if (!this.credentials.token) {
      throw new EvidenceCollectorError(
        'Splunk token is required for HEC connection test',
        'splunk',
        false
      );
    }

    const hecUrl = `${this.hecEndpoint}/services/collector`;
    
    // Send a test event
    const testEvent = {
      event: {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'BiasLens connection test',
      },
      index: this.credentials.index,
      sourcetype: 'biaslens:test',
      source: 'biaslens-connection-test',
    };

    const response = await fetch(hecUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Splunk ${this.credentials.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEvent),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HEC test failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    console.log(`[Splunk] Successfully tested HEC connection to: ${this.hecEndpoint}`);
    return true;
  }

  /**
   * Test management API connection.
   * @returns Promise resolving to true if connection is successful
   */
  private async testManagementAPIConnection(): Promise<boolean> {
    if (!this.credentials.username || !this.credentials.password) {
      throw new EvidenceCollectorError(
        'Splunk username and password are required for management API connection test',
        'splunk',
        false
      );
    }

    // Test authentication
    const authUrl = `${this.managementEndpoint}/services/auth/login`;
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: this.credentials.username,
        password: this.credentials.password,
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text().catch(() => 'Unknown error');
      throw new Error(`Splunk authentication failed: ${authResponse.status} ${authResponse.statusText}. ${errorText}`);
    }

    // Extract session key
    const authXml = await authResponse.text();
    const sessionKeyMatch = authXml.match(/<sessionKey>([^<]+)<\/sessionKey>/);
    if (!sessionKeyMatch) {
      throw new Error('Failed to extract session key from Splunk authentication response');
    }

    const sessionKey = sessionKeyMatch[1];

    // Test index access by checking if index exists
    const indexUrl = `${this.managementEndpoint}/services/data/indexes/${encodeURIComponent(this.credentials.index)}`;
    const indexResponse = await fetch(indexUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Splunk ${sessionKey}`,
      },
    });

    if (!indexResponse.ok && indexResponse.status !== 404) {
      const errorText = await indexResponse.text().catch(() => 'Unknown error');
      throw new Error(`Splunk index check failed: ${indexResponse.status} ${indexResponse.statusText}. ${errorText}`);
    }

    console.log(`[Splunk] Successfully tested management API connection to: ${this.managementEndpoint}`);
    return true;
  }

  /**
   * Get the HEC endpoint URL (for testing purposes).
   * @returns HEC endpoint URL
   */
  getHECEndpoint(): string {
    return this.hecEndpoint;
  }

  /**
   * Get the management endpoint URL (for testing purposes).
   * @returns Management endpoint URL
   */
  getManagementEndpoint(): string {
    return this.managementEndpoint;
  }

  /**
   * Get the index name (for testing purposes).
   * @returns Index name
   */
  getIndexName(): string {
    return this.credentials.index;
  }
}

