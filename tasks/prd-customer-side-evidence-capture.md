# PRD: Customer-Side Evidence Capture

## Introduction/Overview

This feature enables customers to run bias evaluations in their own environment and store raw prompts and outputs in their own log stores (S3 or SIEM systems), while BiasLens ingests only scores and references/IDs. This addresses compliance requirements where organizations need full evidence in their governance systems while still leveraging BiasLens for analysis and traceability.

**Problem:** Organizations with strict compliance requirements need to maintain full control over sensitive evaluation data (raw prompts and outputs) in their own systems, but still want to use BiasLens for bias analysis and scoring.

**Goal:** Provide a "collector" option that allows customers to store raw evaluation data in their own infrastructure while BiasLens processes only aggregated scores and reference identifiers.

## Goals

1. Enable customers to store raw prompts and outputs in their own S3 buckets or SIEM systems
2. Ensure BiasLens never sees or stores raw evaluation outputs
3. Provide traceability between BiasLens scores and customer-stored evidence through reference IDs
4. Support integration with S3 and common SIEM systems (Splunk, ELK, etc.)
5. Minimize setup complexity by allowing customers to provide credentials/endpoints while BiasLens handles the integration logic
6. Provide a simple toggle in settings to enable "collector mode"

## User Stories

1. **As a compliance officer**, I want to store all raw evaluation data in our SIEM system so that we maintain full audit trails in our governance infrastructure.

2. **As a DevOps engineer**, I want to configure evidence collection by providing S3 bucket credentials and endpoint so that raw data is automatically stored in our AWS infrastructure.

3. **As a security team member**, I want BiasLens to never see raw prompts and outputs so that sensitive data remains within our control and compliance boundaries.

4. **As a data analyst**, I want to see bias scores in BiasLens with references to where the full evidence is stored so that I can trace back to original data when needed.

5. **As a compliance auditor**, I want to access full evidence in our governance system while using BiasLens analysis so that I can verify findings against original data.

## Functional Requirements

1. The system must provide a toggle in the Settings page to enable "Customer-Side Evidence Capture" mode (also referred to as "collector mode").

2. When collector mode is enabled, the system must allow users to configure evidence storage destination:
   - S3 bucket configuration (bucket name, region, access key, secret key)
   - SIEM system configuration (Splunk endpoint, authentication credentials)
   - SIEM system configuration (ELK/Elasticsearch endpoint, authentication credentials)

3. The system must generate unique reference IDs for each evaluation run that can be used to link BiasLens scores to customer-stored evidence.

4. During evaluation execution, the system must:
   - Capture raw prompts and outputs before sending to BiasLens
   - Store raw data in the configured customer storage (S3 or SIEM)
   - Generate and store reference IDs/pointers in customer storage
   - Send only scores, reference IDs, and metadata to BiasLens

5. The system must support structured reference formats that include:
   - Evaluation run ID
   - Test case ID
   - Timestamp
   - Storage location (e.g., S3 bucket/key path or SIEM index/document ID)

6. The system must display reference IDs in the BiasLens UI alongside scores so users can trace back to full evidence.

7. The system must handle authentication with customer storage systems:
   - AWS S3: Support IAM role, access key/secret key, or temporary credentials
   - Splunk: Support token-based or username/password authentication
   - ELK: Support API key or username/password authentication

8. The system must validate storage connectivity and permissions before allowing evaluations to run in collector mode.

9. The system must provide error handling for storage failures:
   - Retry logic for transient failures
   - Clear error messages when storage is unavailable
   - Option to fall back to standard mode if collector mode fails

10. The system must support both compliance/audit teams and DevOps/infrastructure teams as primary users.

11. The system must log all evidence collection activities for audit purposes.

12. The system must support batch evidence collection for large-scale evaluations (thousands of test cases).

## Non-Goals (Out of Scope)

1. This feature will NOT store raw data in BiasLens infrastructure - it is explicitly designed to avoid this.

2. This feature will NOT provide a generic webhook/API for arbitrary log stores in the initial version (focusing on S3, Splunk, and ELK).

3. This feature will NOT automatically configure customer infrastructure - customers must provide credentials and endpoints.

4. This feature will NOT provide a UI for browsing customer-stored evidence - users must access their own storage systems.

5. This feature will NOT handle evidence retrieval or replay - it only handles storage and reference generation.

6. This feature will NOT support real-time evidence streaming - evidence is stored after evaluation completion.

## Design Considerations

1. **Settings UI:**
   - Add a new section in Settings page for "Evidence Collection"
   - Toggle switch to enable/disable collector mode
   - Configuration form that appears when enabled, with tabs or dropdown for storage type (S3, Splunk, ELK)
   - Test connection button to validate credentials and permissions
   - Display current configuration status (connected/disconnected)

2. **Evaluation Results UI:**
   - Display reference IDs/pointers next to scores in evaluation results
   - Make reference IDs clickable or copyable for easy access
   - Show storage location type (S3, Splunk, ELK) in results view

3. **Error Handling UI:**
   - Clear error messages when storage connection fails
   - Warning indicators when collector mode is enabled but not properly configured
   - Option to disable collector mode if persistent failures occur

## Technical Considerations

1. **Integration Points:**
   - Must integrate with existing evaluation execution flow in `supabase/functions/evaluate/`
   - Must add new database tables/columns to store collector mode configuration per organization/user
   - Must extend evaluation results schema to include reference IDs

2. **Storage Integrations:**
   - S3: Use AWS SDK for JavaScript/TypeScript
   - Splunk: Use Splunk REST API or SDK
   - ELK: Use Elasticsearch client library

3. **Security:**
   - Customer credentials must be encrypted at rest (similar to existing API key storage)
   - Use secure credential storage mechanism (Supabase Vault or similar)
   - Support credential rotation without breaking existing evaluations

4. **Performance:**
   - Evidence collection should not significantly slow down evaluation execution
   - Consider async/background processing for evidence storage
   - Handle rate limits from storage systems (S3, SIEM APIs)

5. **Scalability:**
   - Support large-scale evaluations (thousands of test cases) without overwhelming storage systems
   - Implement batching for evidence storage operations
   - Consider queue-based processing for high-volume scenarios

6. **Dependencies:**
   - AWS SDK for S3 integration
   - Splunk SDK or REST client for Splunk integration
   - Elasticsearch client for ELK integration
   - Existing evaluation framework and database schema

## Success Metrics

1. **Adoption:** Number of customers enabling collector mode within first 3 months of release
2. **Support Reduction:** Reduction in compliance-related support tickets about data storage and governance
3. **Audit Efficiency:** Reduction in time to complete compliance audits (measured through customer surveys)
4. **Reliability:** Evidence collection success rate (target: >99.5% successful storage operations)
5. **Performance:** Evaluation execution time increase when collector mode is enabled (target: <10% overhead)

## Open Questions

1. Should we support multiple storage destinations simultaneously (e.g., store in both S3 and SIEM)?
2. What is the retention policy for reference IDs in BiasLens? Should they be kept indefinitely?
3. Should we support custom metadata fields that customers want to include with stored evidence?
4. How should we handle evidence storage for scheduled/recurring evaluations?
5. Should we provide a way for customers to export reference mappings for their own records?
6. What format should raw evidence be stored in? (JSON, structured logs, etc.)
7. Should we support compression of stored evidence for cost optimization?

