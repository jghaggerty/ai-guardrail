# Task List: Customer-Side Evidence Capture

## Relevant Files

- `supabase/migrations/20251213000000_evidence_collection_config.sql` - Database migration for evidence collection configuration table.
- `supabase/migrations/20251213000001_add_evidence_reference_id_to_evaluations.sql` - Migration to add evidence_reference_id column to evaluations table.
- `supabase/migrations/20251213000002_add_evidence_storage_type_to_evaluations.sql` - Migration to add evidence_storage_type column to evaluations table.
- `supabase/migrations/20251213000003_create_evidence_references_table.sql` - Migration to create evidence_references table for per-test-case reference tracking.
- `supabase/migrations/20251213000004_add_evidence_collection_indexes.sql` - Migration to add performance indexes for evidence collection queries.
- `supabase/migrations/20251213000005_verify_evidence_collection_foreign_keys.sql` - Migration to verify foreign key constraints and cascade delete rules are properly configured.
- `supabase/functions/store-evidence-credentials/index.ts` - Edge function to securely store and encrypt evidence collection credentials (similar to store-api-key).
- `supabase/functions/store-evidence-credentials/index.test.ts` - Unit tests for credential storage function.
- `supabase/functions/test-evidence-connection/index.ts` - Edge function to test connectivity and permissions for S3, Splunk, and ELK storage systems.
- `supabase/functions/test-evidence-connection/index.test.ts` - Unit tests for connection testing function.
- `supabase/functions/evaluate/evidence-collectors/types.ts` - TypeScript interfaces and types for evidence collection system.
- `supabase/functions/evaluate/evidence-collectors/base.ts` - Base abstract class/interface for evidence collectors.
- `supabase/functions/evaluate/evidence-collectors/s3-collector.ts` - S3 evidence collector implementation using AWS SDK.
- `supabase/functions/evaluate/evidence-collectors/s3-collector.test.ts` - Unit tests for S3 collector.
- `supabase/functions/evaluate/evidence-collectors/splunk-collector.ts` - Splunk evidence collector implementation using Splunk REST API.
- `supabase/functions/evaluate/evidence-collectors/splunk-collector.test.ts` - Unit tests for Splunk collector.
- `supabase/functions/evaluate/evidence-collectors/elk-collector.ts` - ELK/Elasticsearch evidence collector implementation.
- `supabase/functions/evaluate/evidence-collectors/elk-collector.test.ts` - Unit tests for ELK collector.
- `supabase/functions/evaluate/evidence-collectors/factory.ts` - Factory function to create appropriate collector based on storage type.
- `supabase/functions/evaluate/evidence-collectors/factory.test.ts` - Unit tests for collector factory.
- `supabase/functions/evaluate/index.ts` - Main evaluation function (modify to integrate evidence collection).
- `src/pages/Settings.tsx` - Settings page (modify to add Evidence Collection configuration section).
- `src/components/EvidenceCollectionSettings.tsx` - New component for evidence collection configuration UI.
- `src/components/EvidenceCollectionSettings.test.tsx` - Unit tests for EvidenceCollectionSettings component.
- `src/lib/api.ts` - API client functions (modify to add evidence collection API calls).
- `src/lib/api.test.ts` - Unit tests for API functions.
- `src/types/bias.ts` - TypeScript types (modify to add evidence collection and reference ID types).
- `src/components/HeuristicCard.tsx` - Heuristic finding card component (modify to display reference IDs).
- `src/pages/Index.tsx` - Main dashboard page (modify to display reference IDs in evaluation results).
- `src/components/HistoryPanel.tsx` - History panel component (modify to show reference IDs if needed).

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Database Schema and Migration
  - [x] 1.1 Create migration file for `evidence_collection_configs` table with columns: id, team_id, storage_type (enum: 's3', 'splunk', 'elk'), is_enabled (boolean), credentials_encrypted (text), configuration (jsonb for storage-specific settings), last_tested_at (timestamp), created_at, updated_at
  - [x] 1.2 Add `evidence_reference_id` column to `evaluations` table to store the reference ID linking to customer-stored evidence
  - [x] 1.3 Add `evidence_storage_type` column to `evaluations` table to track which storage system was used (nullable, only set when collector mode is enabled)
  - [x] 1.4 Create `evidence_references` table with columns: id, evaluation_id, test_case_id, reference_id, storage_location (text), storage_type, created_at (for detailed per-test-case references if needed)
  - [x] 1.5 Set up Row Level Security (RLS) policies for `evidence_collection_configs` table (team members can view/update their team's config)
  - [x] 1.6 Create indexes on `evidence_collection_configs.team_id` and `evaluations.evidence_reference_id` for query performance
  - [x] 1.7 Add foreign key constraints and cascade delete rules appropriately

- [x] 2.0 Evidence Collection Storage Integrations
  - [x] 2.1 Create `supabase/functions/evaluate/evidence-collectors/types.ts` with TypeScript interfaces: `EvidenceCollector`, `EvidenceData`, `StorageCredentials`, `ReferenceInfo`, and storage-specific credential types (S3Credentials, SplunkCredentials, ELKCredentials)
  - [x] 2.2 Create `supabase/functions/evaluate/evidence-collectors/base.ts` with abstract base class `BaseEvidenceCollector` implementing common functionality (reference ID generation, error handling, retry logic)
  - [x] 2.3 Create `supabase/functions/evaluate/evidence-collectors/s3-collector.ts` implementing S3 storage using AWS SDK for JavaScript/TypeScript, supporting access key/secret key authentication, handling bucket/key path generation, and implementing retry logic for transient failures
  - [x] 2.4 Create `supabase/functions/evaluate/evidence-collectors/splunk-collector.ts` implementing Splunk storage using Splunk REST API, supporting token-based and username/password authentication, handling index/document creation, and implementing retry logic
  - [x] 2.5 Create `supabase/functions/evaluate/evidence-collectors/elk-collector.ts` implementing ELK/Elasticsearch storage using Elasticsearch client library, supporting API key and username/password authentication, handling index/document creation, and implementing retry logic
  - [x] 2.6 Create `supabase/functions/evaluate/evidence-collectors/factory.ts` with factory function that creates appropriate collector instance based on storage type from configuration
  - [x] 2.7 Implement credential decryption utilities (reuse pattern from `store-api-key`/`decrypt-api-key` functions) for decrypting stored credentials when creating collectors
  - [x] 2.8 Add error handling for rate limits, network failures, and permission errors with appropriate retry strategies and fallback mechanisms
  - [x] 2.9 Write unit tests for each collector class, testing successful storage, error handling, retry logic, and credential validation

- [x] 3.0 Settings UI for Evidence Collection Configuration
  - [x] 3.1 Create `src/components/EvidenceCollectionSettings.tsx` component with toggle switch to enable/disable collector mode, storage type selector (S3, Splunk, ELK), and conditional configuration forms
  - [x] 3.2 Implement S3 configuration form with fields: bucket name, region, access key, secret key (with show/hide toggle), and optional IAM role field
  - [x] 3.3 Implement Splunk configuration form with fields: endpoint URL, authentication type selector (token/username-password), token field or username/password fields based on selection, and index name
  - [x] 3.4 Implement ELK configuration form with fields: endpoint URL, authentication type selector (API key/username-password), API key or username/password fields, and index name
  - [x] 3.5 Add "Test Connection" button that calls test-evidence-connection edge function and displays success/error status with clear error messages
  - [x] 3.6 Add connection status indicator (connected/disconnected) that shows current configuration status
  - [x] 3.7 Integrate EvidenceCollectionSettings component into `src/pages/Settings.tsx` as a new tab or section within existing tabs
  - [x] 3.8 Add API functions in `src/lib/api.ts` for: fetching evidence collection config, saving evidence collection config, testing evidence connection
  - [x] 3.9 Implement form validation for required fields and format validation (e.g., URL format, bucket name format)
  - [x] 3.10 Add warning indicators when collector mode is enabled but not properly configured
  - [x] 3.11 Add option to disable collector mode if persistent connection failures occur
  - [x] 3.12 Write unit tests for EvidenceCollectionSettings component testing form interactions, validation, and API calls

- [ ] 4.0 Evaluation Execution Integration
  - [ ] 4.1 Modify `supabase/functions/evaluate/index.ts` to check if collector mode is enabled for the team before starting evaluation
  - [ ] 4.2 Add function to fetch and decrypt evidence collection configuration for the team
  - [ ] 4.3 Create evidence collector instance using factory function when collector mode is enabled
  - [ ] 4.4 Modify evaluation execution flow to capture raw prompts and outputs before sending to BiasLens (intercept LLM calls in test runner)
  - [ ] 4.5 Generate unique reference IDs for evaluation run and per-test-case (format: evaluation-run-{uuid}, test-case-{testCaseId}-{iteration}-{uuid})
  - [ ] 4.6 Implement evidence storage logic: for each test case iteration, store raw prompt and output in customer storage with reference ID, then store reference ID in BiasLens database
  - [ ] 4.7 Modify evaluation flow to send only scores, reference IDs, and metadata to BiasLens (ensure raw outputs are never stored in BiasLens database)
  - [ ] 4.8 Add error handling: if evidence storage fails, log error, optionally fall back to standard mode, and continue evaluation (don't block evaluation execution)
  - [ ] 4.9 Implement batch evidence collection for large-scale evaluations (store multiple test cases in batches to avoid overwhelming storage systems)
  - [ ] 4.10 Add async/background processing option for evidence storage to avoid slowing down evaluation execution (consider queue-based approach for high-volume scenarios)
  - [ ] 4.11 Store evidence_reference_id and evidence_storage_type in evaluations table when collector mode is used
  - [ ] 4.12 Store detailed per-test-case references in evidence_references table if needed for granular traceability
  - [ ] 4.13 Add logging for all evidence collection activities for audit purposes
  - [ ] 4.14 Handle rate limits from storage systems gracefully with exponential backoff
  - [ ] 4.15 Write integration tests for evaluation execution with collector mode enabled, testing successful storage, error handling, and fallback behavior

- [ ] 5.0 Results Display and Reference ID Management
  - [ ] 5.1 Modify `src/types/bias.ts` to add `evidenceReferenceId` and `evidenceStorageType` fields to `EvaluationRun` interface
  - [ ] 5.2 Update API response types in `src/lib/api.ts` to include evidence reference information in evaluation results
  - [ ] 5.3 Modify `src/pages/Index.tsx` to display evidence reference ID and storage type in evaluation results section (add new section or badge showing reference info)
  - [ ] 5.4 Modify `src/components/HeuristicCard.tsx` to display reference IDs next to scores if available (show per-test-case references if stored)
  - [ ] 5.5 Add copy-to-clipboard functionality for reference IDs (make reference IDs clickable/copyable)
  - [ ] 5.6 Display storage location type badge (S3, Splunk, ELK) in evaluation results
  - [ ] 5.7 Add tooltip or help text explaining what reference IDs are and how to use them to access customer-stored evidence
  - [ ] 5.8 Update `src/components/HistoryPanel.tsx` to optionally show reference ID indicator in historical evaluations list
  - [ ] 5.9 Ensure reference IDs are displayed consistently across all evaluation result views (heuristics tab, recommendations tab, etc.)
  - [ ] 5.10 Add visual indicator (icon/badge) when collector mode was used for an evaluation
  - [ ] 5.11 Write unit tests for UI components displaying reference IDs

