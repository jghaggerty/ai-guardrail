/**
 * Unit tests for Evidence Collector Factory
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  createEvidenceCollector,
  isStorageTypeSupported,
  validateCredentialsType,
  getSupportedStorageTypes,
} from './factory.ts';
import { EvidenceCollectorError } from './types.ts';
import type { S3Credentials, SplunkCredentials, ELKCredentials } from './types.ts';

Deno.test('createEvidenceCollector - creates S3 collector with valid credentials', () => {
  const creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };

  const collector = createEvidenceCollector('s3', creds);
  assertEquals(collector.storageType, 's3');
});

Deno.test('createEvidenceCollector - creates Splunk collector with valid credentials', () => {
  const creds: SplunkCredentials = {
    storageType: 'splunk',
    endpoint: 'https://splunk.example.com:8089',
    authType: 'token',
    token: 'test-token',
    index: 'test-index',
  };

  const collector = createEvidenceCollector('splunk', creds);
  assertEquals(collector.storageType, 'splunk');
});

Deno.test('createEvidenceCollector - creates ELK collector with valid credentials', () => {
  const creds: ELKCredentials = {
    storageType: 'elk',
    endpoint: 'https://elasticsearch.example.com:9200',
    authType: 'api-key',
    apiKey: 'test-key',
    index: 'test-index',
  };

  const collector = createEvidenceCollector('elk', creds);
  assertEquals(collector.storageType, 'elk');
});

Deno.test('createEvidenceCollector - rejects storage type mismatch', () => {
  const s3Creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };

  assertRejects(
    async () => {
      createEvidenceCollector('splunk', s3Creds);
    },
    EvidenceCollectorError,
    'Storage type mismatch'
  );
});

Deno.test('createEvidenceCollector - rejects unsupported storage type', () => {
  const creds = {
    storageType: 'unsupported',
  } as any;

  assertRejects(
    async () => {
      createEvidenceCollector('unsupported' as any, creds);
    },
    EvidenceCollectorError,
    'Unsupported storage type'
  );
});

Deno.test('isStorageTypeSupported - returns true for supported types', () => {
  assertEquals(isStorageTypeSupported('s3'), true);
  assertEquals(isStorageTypeSupported('splunk'), true);
  assertEquals(isStorageTypeSupported('elk'), true);
});

Deno.test('isStorageTypeSupported - returns false for unsupported types', () => {
  assertEquals(isStorageTypeSupported('unsupported'), false);
  assertEquals(isStorageTypeSupported(''), false);
});

Deno.test('validateCredentialsType - returns true for matching types', () => {
  const s3Creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };

  assertEquals(validateCredentialsType('s3', s3Creds), true);
});

Deno.test('validateCredentialsType - returns false for mismatched types', () => {
  const s3Creds: S3Credentials = {
    storageType: 's3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };

  assertEquals(validateCredentialsType('splunk', s3Creds), false);
});

Deno.test('getSupportedStorageTypes - returns all supported types', () => {
  const types = getSupportedStorageTypes();
  assertEquals(types.length, 3);
  assertEquals(types.includes('s3'), true);
  assertEquals(types.includes('splunk'), true);
  assertEquals(types.includes('elk'), true);
});
