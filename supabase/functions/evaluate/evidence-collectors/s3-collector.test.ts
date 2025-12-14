/**
 * Unit tests for S3Collector
 */

import { assertEquals, assertRejects, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { S3Collector } from './s3-collector.ts';
import { EvidenceCollectorError } from './types.ts';
import type { S3Credentials, EvidenceData } from './types.ts';

// Mock AWS SDK
const mockS3Client = {
  send: async (command: unknown) => {
    // Mock implementation
    return {};
  },
};

// Mock the AWS SDK module
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  // This will be overridden in individual tests
  return new Response(JSON.stringify({}), { status: 200 });
};

Deno.test('S3Collector - constructor validates credentials', () => {
  // Test missing accessKeyId
  assertRejects(
    async () => {
      const creds: S3Credentials = {
        storageType: 's3',
        secretAccessKey: 'secret',
        region: 'us-east-1',
        bucketName: 'test-bucket',
      } as S3Credentials;
      new S3Collector(creds);
    },
    EvidenceCollectorError,
    'S3 credentials must include accessKeyId'
  );

  // Test missing secretAccessKey
  assertRejects(
    async () => {
      const creds: S3Credentials = {
        storageType: 's3',
        accessKeyId: 'key',
        region: 'us-east-1',
        bucketName: 'test-bucket',
      } as S3Credentials;
      new S3Collector(creds);
    },
    EvidenceCollectorError,
    'S3 credentials must include secretAccessKey'
  );

  // Test missing bucketName
  assertRejects(
    async () => {
      const creds: S3Credentials = {
        storageType: 's3',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        region: 'us-east-1',
      } as S3Credentials;
      new S3Collector(creds);
    },
    EvidenceCollectorError,
    'S3 credentials must include bucketName'
  );

  // Test missing region
  assertRejects(
    async () => {
      const creds: S3Credentials = {
        storageType: 's3',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucketName: 'test-bucket',
      } as S3Credentials;
      new S3Collector(creds);
    },
    EvidenceCollectorError,
    'S3 credentials must include region'
  );

  // Test valid credentials
  const validCreds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };
  const collector = new S3Collector(validCreds);
  assertEquals(collector.storageType, 's3');
  assertEquals(collector.getBucketName(), 'test-bucket');
});

Deno.test('S3Collector - generateReferenceId creates unique IDs', () => {
  const creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };
  const collector = new S3Collector(creds);

  const refId1 = collector.generateReferenceId('eval-123', 'test-case-1', 0);
  const refId2 = collector.generateReferenceId('eval-123', 'test-case-1', 0);

  // Should be different due to UUID
  assert(refId1 !== refId2);
  assert(refId1.includes('evaluation-run'));
  assert(refId1.includes('eval-123'));
  assert(refId1.includes('test-case-test-case-1'));
  assert(refId1.includes('iteration-0'));
});

Deno.test('S3Collector - storeEvidence validates evidence data', async () => {
  const creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };
  const collector = new S3Collector(creds);

  // Mock successful S3 upload
  globalThis.fetch = async () => {
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

  // Test missing output
  await assertRejects(
    async () => {
      const invalidData: EvidenceData = {
        prompt: 'test prompt',
        testCaseId: 'test-1',
        iteration: 0,
        timestamp: new Date().toISOString(),
        evaluationRunId: 'eval-123',
      } as EvidenceData;
      await collector.storeEvidence(invalidData);
    },
    EvidenceCollectorError,
    'Evidence data must include a valid output string'
  );
});

Deno.test('S3Collector - storeEvidence handles S3 errors', async () => {
  const creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };
  const collector = new S3Collector(creds);

  // Mock S3 error (403 Forbidden)
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({ error: 'Access Denied' }),
      { status: 403 }
    );
  };

  const evidenceData: EvidenceData = {
    prompt: 'test prompt',
    output: 'test output',
    testCaseId: 'test-1',
    iteration: 0,
    timestamp: new Date().toISOString(),
    evaluationRunId: 'eval-123',
  };

  // Should throw EvidenceCollectorError after retries
  await assertRejects(
    async () => {
      await collector.storeEvidence(evidenceData);
    },
    EvidenceCollectorError
  );
});

Deno.test('S3Collector - testConnection validates connection', async () => {
  const creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };
  const collector = new S3Collector(creds);

  // Mock successful connection test
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    if (callCount === 1) {
      // HeadBucket success
      return new Response(null, { status: 200 });
    } else {
      // PutObject test success
      return new Response(JSON.stringify({}), { status: 200 });
    }
  };

  const result = await collector.testConnection();
  assertEquals(result, true);
});

Deno.test('S3Collector - testConnection handles authentication errors', async () => {
  const creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'invalid-key',
    secretAccessKey: 'invalid-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };
  const collector = new S3Collector(creds);

  // Mock authentication error
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({ error: 'InvalidAccessKeyId' }),
      { status: 403 }
    );
  };

  await assertRejects(
    async () => {
      await collector.testConnection();
    },
    EvidenceCollectorError,
    'Invalid S3 credentials'
  );
});

Deno.test('S3Collector - testConnection handles bucket not found', async () => {
  const creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'nonexistent-bucket',
  };
  const collector = new S3Collector(creds);

  // Mock bucket not found error
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({ error: 'NoSuchBucket' }),
      { status: 404 }
    );
  };

  await assertRejects(
    async () => {
      await collector.testConnection();
    },
    EvidenceCollectorError,
    'S3 bucket not found'
  );
});
