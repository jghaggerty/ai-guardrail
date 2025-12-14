/**
 * Unit tests for SplunkCollector
 */

import { assertEquals, assertRejects, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { SplunkCollector } from './splunk-collector.ts';
import { EvidenceCollectorError } from './types.ts';
import type { SplunkCredentials, EvidenceData } from './types.ts';

// Mock fetch globally
let mockFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (mockFetch) {
    return mockFetch(input, init);
  }
  return new Response(JSON.stringify({}), { status: 200 });
};

Deno.test('SplunkCollector - constructor validates credentials', () => {
  // Test missing endpoint
  assertRejects(
    async () => {
      const creds: SplunkCredentials = {
        storageType: 'splunk',
        authType: 'token',
        token: 'test-token',
        index: 'test-index',
      } as SplunkCredentials;
      new SplunkCollector(creds);
    },
    EvidenceCollectorError,
    'Splunk credentials must include endpoint URL'
  );

  // Test missing index
  assertRejects(
    async () => {
      const creds: SplunkCredentials = {
        storageType: 'splunk',
        endpoint: 'https://splunk.example.com:8089',
        authType: 'token',
        token: 'test-token',
      } as SplunkCredentials;
      new SplunkCollector(creds);
    },
    EvidenceCollectorError,
    'Splunk credentials must include index name'
  );

  // Test token auth without token
  assertRejects(
    async () => {
      const creds: SplunkCredentials = {
        storageType: 'splunk',
        endpoint: 'https://splunk.example.com:8089',
        authType: 'token',
        index: 'test-index',
      } as SplunkCredentials;
      new SplunkCollector(creds);
    },
    EvidenceCollectorError,
    'Splunk token authentication requires a token'
  );

  // Test username-password auth without credentials
  assertRejects(
    async () => {
      const creds: SplunkCredentials = {
        storageType: 'splunk',
        endpoint: 'https://splunk.example.com:8089',
        authType: 'username-password',
        index: 'test-index',
      } as SplunkCredentials;
      new SplunkCollector(creds);
    },
    EvidenceCollectorError,
    'Splunk username-password authentication requires username and password'
  );

  // Test valid token credentials
  const validTokenCreds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: 'https://splunk.example.com:8089',
    authType: 'token',
    token: 'test-token',
    index: 'test-index',
  };
  const tokenCollector = new SplunkCollector(validTokenCreds);
  assertEquals(tokenCollector.storageType, 'splunk');
  assertEquals(tokenCollector.getIndexName(), 'test-index');

  // Test valid username-password credentials
  const validUserPassCreds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: 'https://splunk.example.com:8089',
    authType: 'username-password',
    username: 'test-user',
    password: 'test-pass',
    index: 'test-index',
  };
  const userPassCollector = new SplunkCollector(validUserPassCreds);
  assertEquals(userPassCollector.storageType, 'splunk');
  assertEquals(userPassCollector.getIndexName(), 'test-index');
});

Deno.test('SplunkCollector - storeEvidence via HEC validates evidence data', async () => {
  const creds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: 'https://splunk.example.com:8088',
    authType: 'token',
    token: 'test-token',
    index: 'test-index',
  };
  const collector = new SplunkCollector(creds);

  // Mock successful HEC response
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/services/collector')) {
      return new Response(JSON.stringify({ ackId: 'test-ack-id' }), { status: 200 });
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

Deno.test('SplunkCollector - storeEvidence via HEC handles errors', async () => {
  const creds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: 'https://splunk.example.com:8088',
    authType: 'token',
    token: 'test-token',
    index: 'test-index',
  };
  const collector = new SplunkCollector(creds);

  // Mock HEC error (429 rate limit)
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/services/collector')) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: { 'Retry-After': '60' },
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

Deno.test('SplunkCollector - storeEvidence via Management API handles authentication', async () => {
  const creds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: 'https://splunk.example.com:8089',
    authType: 'username-password',
    username: 'test-user',
    password: 'test-pass',
    index: 'test-index',
  };
  const collector = new SplunkCollector(creds);

  // Mock authentication failure
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/services/auth/login')) {
      return new Response(
        '<response><messages><msg type="ERROR">Invalid credentials</msg></messages></response>',
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
    EvidenceCollectorError,
    'Splunk authentication failed'
  );
});

Deno.test('SplunkCollector - testConnection via HEC validates connection', async () => {
  const creds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: 'https://splunk.example.com:8088',
    authType: 'token',
    token: 'test-token',
    index: 'test-index',
  };
  const collector = new SplunkCollector(creds);

  // Mock successful HEC connection test
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/services/collector')) {
      return new Response(JSON.stringify({ ackId: 'test-ack' }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const result = await collector.testConnection();
  assertEquals(result, true);
});

Deno.test('SplunkCollector - testConnection handles authentication errors', async () => {
  const creds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: 'https://splunk.example.com:8089',
    authType: 'username-password',
    username: 'invalid-user',
    password: 'invalid-pass',
    index: 'test-index',
  };
  const collector = new SplunkCollector(creds);

  // Mock authentication error
  mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/services/auth/login')) {
      return new Response(
        '<response><messages><msg type="ERROR">Invalid credentials</msg></messages></response>',
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
    'Splunk authentication failed'
  );
});

Deno.test('SplunkCollector - generateReferenceId creates unique IDs', () => {
  const creds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: 'https://splunk.example.com:8089',
    authType: 'token',
    token: 'test-token',
    index: 'test-index',
  };
  const collector = new SplunkCollector(creds);

  const refId1 = collector.generateReferenceId('eval-123', 'test-case-1', 0);
  const refId2 = collector.generateReferenceId('eval-123', 'test-case-1', 0);

  // Should be different due to UUID
  assert(refId1 !== refId2);
  assert(refId1.includes('evaluation-run'));
  assert(refId1.includes('eval-123'));
});
