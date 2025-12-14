/**
 * Unit tests for ELKCollector
 */

import { assertEquals, assertRejects, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { ELKCollector } from './elk-collector.ts';
import { EvidenceCollectorError } from './types.ts';
import type { ELKCredentials, EvidenceData } from './types.ts';

// Mock fetch globally
let mockFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (mockFetch) {
    return mockFetch(input, init);
  }
  return new Response(JSON.stringify({}), { status: 200 });
};

Deno.test('ELKCollector - constructor validates credentials', () => {
  // Test missing endpoint
  assertRejects(
    async () => {
      const creds: ELKCredentials = {
        storageType: 'elk',
        authType: 'api-key',
        apiKey: 'test-key',
        index: 'test-index',
      } as ELKCredentials;
      new ELKCollector(creds);
    },
    EvidenceCollectorError,
    'Elasticsearch credentials must include endpoint URL'
  );

  // Test missing index
  assertRejects(
    async () => {
      const creds: ELKCredentials = {
        storageType: 'elk',
        endpoint: 'https://elasticsearch.example.com:9200',
        authType: 'api-key',
        apiKey: 'test-key',
      } as ELKCredentials;
      new ELKCollector(creds);
    },
    EvidenceCollectorError,
    'Elasticsearch credentials must include index name'
  );

  // Test API key auth without API key
  assertRejects(
    async () => {
      const creds: ELKCredentials = {
        storageType: 'elk',
        endpoint: 'https://elasticsearch.example.com:9200',
        authType: 'api-key',
        index: 'test-index',
      } as ELKCredentials;
      new ELKCollector(creds);
    },
    EvidenceCollectorError,
    'Elasticsearch API key authentication requires an apiKey'
  );

  // Test username-password auth without credentials
  assertRejects(
    async () => {
      const creds: ELKCredentials = {
        storageType: 'elk',
        endpoint: 'https://elasticsearch.example.com:9200',
        authType: 'username-password',
        index: 'test-index',
      } as ELKCredentials;
      new ELKCollector(creds);
    },
    EvidenceCollectorError,
    'Elasticsearch username-password authentication requires username and password'
  );

  // Test valid API key credentials
  const validApiKeyCreds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'api-key',
    apiKey: 'test-api-key',
    index: 'test-index',
  };
  const apiKeyCollector = new ELKCollector(validApiKeyCreds);
  assertEquals(apiKeyCollector.storageType, 'elk');
  assertEquals(apiKeyCollector.getIndexName(), 'test-index');

  // Test valid username-password credentials
  const validUserPassCreds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'username-password',
    username: 'test-user',
    password: 'test-pass',
    index: 'test-index',
  };
  const userPassCollector = new ELKCollector(validUserPassCreds);
  assertEquals(userPassCollector.storageType, 'elk');
  assertEquals(userPassCollector.getIndexName(), 'test-index');
});

Deno.test('ELKCollector - storeEvidence validates evidence data', async () => {
  const creds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'api-key',
    apiKey: 'test-key',
    index: 'test-index',
  };
  const collector = new ELKCollector(creds);

  // Mock successful Elasticsearch response
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/_doc/')) {
      return new Response(
        JSON.stringify({ _id: 'test-doc-id', result: 'created' }),
        { status: 201 }
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  // Test missing prompt
  await assertRejects(
    async () => {
      const invalidData: EvidenceData = {
        output: 'test output',
        testCaseId: 'test-1',
        iteration: 0,
        timestamp: new Date().toISOString(),
        evaluationRunId: 'eval-123',
      } as EvidenceData;
      await collector.storeEvidence(invalidData);
    },
    EvidenceCollectorError,
    'Evidence data must include a valid prompt string'
  );
});

Deno.test('ELKCollector - storeEvidence handles Elasticsearch errors', async () => {
  const creds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'api-key',
    apiKey: 'test-key',
    index: 'test-index',
  };
  const collector = new ELKCollector(creds);

  // Mock Elasticsearch error (429 rate limit)
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/_doc/')) {
      return new Response(
        JSON.stringify({
          error: {
            type: 'es_rejected_execution_exception',
            reason: 'rejected execution of org.elasticsearch.transport.TransportService',
          },
        }),
        {
          status: 429,
          headers: { 'Retry-After': '30' },
        }
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const evidenceData: EvidenceData = {
    prompt: 'test prompt',
    output: 'test output',
    testCaseId: 'test-1',
    iteration: 0,
    timestamp: new Date().toISOString(),
    evaluationRunId: 'eval-123',
  };

  // Should retry and eventually fail after max retries
  await assertRejects(
    async () => {
      await collector.storeEvidence(evidenceData);
    },
    EvidenceCollectorError
  );
});

Deno.test('ELKCollector - storeEvidence handles authentication errors', async () => {
  const creds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'api-key',
    apiKey: 'invalid-key',
    index: 'test-index',
  };
  const collector = new ELKCollector(creds);

  // Mock authentication error
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/_doc/')) {
      return new Response(
        JSON.stringify({
          error: {
            type: 'security_exception',
            reason: 'missing authentication credentials',
          },
        }),
        { status: 401 }
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const evidenceData: EvidenceData = {
    prompt: 'test prompt',
    output: 'test output',
    testCaseId: 'test-1',
    iteration: 0,
    timestamp: new Date().toISOString(),
    evaluationRunId: 'eval-123',
  };

  await assertRejects(
    async () => {
      await collector.storeEvidence(evidenceData);
    },
    EvidenceCollectorError
  );
});

Deno.test('ELKCollector - testConnection validates connection', async () => {
  const creds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'api-key',
    apiKey: 'test-key',
    index: 'test-index',
  };
  const collector = new ELKCollector(creds);

  // Mock successful connection test
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/_cluster/health')) {
      return new Response(
        JSON.stringify({ status: 'green', cluster_name: 'test-cluster' }),
        { status: 200 }
      );
    }
    if (url.includes('/test-index')) {
      // Index exists
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const result = await collector.testConnection();
  assertEquals(result, true);
});

Deno.test('ELKCollector - testConnection handles cluster health errors', async () => {
  const creds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'api-key',
    apiKey: 'test-key',
    index: 'test-index',
  };
  const collector = new ELKCollector(creds);

  // Mock cluster health error
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/_cluster/health')) {
      return new Response(
        JSON.stringify({ error: 'Connection refused' }),
        { status: 503 }
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  await assertRejects(
    async () => {
      await collector.testConnection();
    },
    EvidenceCollectorError
  );
});

Deno.test('ELKCollector - testConnection handles authentication errors', async () => {
  const creds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'username-password',
    username: 'invalid-user',
    password: 'invalid-pass',
    index: 'test-index',
  };
  const collector = new ELKCollector(creds);

  // Mock authentication error
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/_cluster/health')) {
      return new Response(
        JSON.stringify({
          error: {
            type: 'security_exception',
            reason: 'missing authentication credentials',
          },
        }),
        { status: 401 }
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  await assertRejects(
    async () => {
      await collector.testConnection();
    },
    EvidenceCollectorError,
    'Elasticsearch authentication failed'
  );
});

Deno.test('ELKCollector - generateReferenceId creates unique IDs', () => {
  const creds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'api-key',
    apiKey: 'test-key',
    index: 'test-index',
  };
  const collector = new ELKCollector(creds);

  const refId1 = collector.generateReferenceId('eval-123', 'test-case-1', 0);
  const refId2 = collector.generateReferenceId('eval-123', 'test-case-1', 0);

  // Should be different due to UUID
  assert(refId1 !== refId2);
  assert(refId1.includes('evaluation-run'));
  assert(refId1.includes('eval-123'));
});
