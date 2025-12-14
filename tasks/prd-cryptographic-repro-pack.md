# PRD: Cryptographic "Repro Pack" (Hashes + Signed Transcripts)

## Introduction/Overview

This feature provides tamper-evident cryptographic digests of evaluation runs without storing raw text. The system stores prompt IDs, test-case versions, sampling configuration, hashed outputs, detector version, and timestamps, all signed server-side. This enables compliance teams to prove that specific evaluations occurred at specific times and that the system hasn't been altered later, while maintaining privacy by not storing raw outputs.

**Problem:** Compliance teams need proof that evaluations occurred as claimed, but storing raw outputs may violate privacy or data retention policies. They need cryptographic proof of what happened without exposing sensitive content.

**Goal:** Create tamper-evident "repro packs" that cryptographically prove evaluation integrity and provide audit trails without storing raw prompt/output text.

## Goals

1. Generate cryptographic repro packs for every evaluation run that include all metadata except raw text
2. Provide server-side signing of repro packs to prove authenticity
3. Support both BiasLens server signing and customer-provided signing keys
4. Store repro packs in BiasLens database with ability to export to customer systems
5. Include replay instructions in repro packs so evaluations can be verified/reproduced
6. Enable compliance teams to prove evaluation integrity and timing without exposing raw data

## User Stories

1. **As a compliance officer**, I want cryptographic proof that an evaluation ran at a specific time with specific parameters so that I can demonstrate audit trail integrity to regulators.

2. **As a security auditor**, I want to verify that evaluation results haven't been tampered with after generation so that I can trust the historical record.

3. **As a compliance team member**, I want to use our own signing keys for repro packs so that we maintain full control over cryptographic verification.

4. **As a data analyst**, I want to see repro pack hashes and signatures in evaluation results so that I can verify integrity when needed.

5. **As a compliance auditor**, I want replay instructions included in repro packs so that I can reproduce evaluations if needed (when paired with customer-side evidence).

## Functional Requirements

1. The system must generate a repro pack for every evaluation run that includes:
   - Prompt IDs (unique identifiers for each prompt used)
   - Test case versions (version identifiers for test cases)
   - Sampling configuration (temperature, seed, max tokens, etc.)
   - Hashed outputs (cryptographic hash of each model output, not the raw text)
   - Detector version (version of bias detection algorithms used)
   - Timestamp (precise time when evaluation was executed)
   - Model information (provider, model name, version)
   - Evaluation configuration (test suite, parameters)

2. The system must compute cryptographic hashes of outputs using SHA-256 algorithm (industry standard for this use case).

3. The system must support two signing modes:
   - BiasLens server-side signing (default): BiasLens signs repro packs with its private key
   - Customer-provided signing: Customers can provide their own signing key for repro packs

4. The system must store repro packs in the BiasLens database with the following structure:
   - Repro pack ID (unique identifier)
   - Evaluation run ID (foreign key to evaluation)
   - Cryptographic hash of the repro pack content
   - Digital signature (signed hash)
   - Signing authority identifier (BiasLens or customer key ID)
   - Timestamp
   - Repro pack content (JSON structure with all metadata)

5. The system must include replay instructions in each repro pack that specify:
   - How to reproduce the evaluation (test case IDs, model configuration, sampling parameters)
   - Reference to customer-side evidence (if collector mode is enabled)
   - Version information for all components (detectors, test cases, etc.)

6. The system must allow customers to export repro packs to their own systems:
   - Download repro pack as JSON file
   - API endpoint to retrieve repro packs programmatically
   - Include signature verification instructions in exported pack

7. The system must provide signature verification functionality:
   - UI component to verify repro pack signatures
   - API endpoint to verify signatures programmatically
   - Display verification status (valid/invalid) in UI

8. The system must display repro pack information in evaluation results:
   - Show repro pack ID and hash
   - Display signature status
   - Provide download/export option
   - Show signing authority

9. The system must handle customer-provided signing keys:
   - Secure storage of customer signing keys (encrypted)
   - Key rotation support
   - Key management UI in settings

10. The system must generate repro packs for all evaluation types:
    - Single evaluations
    - Scheduled/recurring evaluations
    - Batch evaluations

11. The system must ensure repro pack immutability:
    - Repro packs cannot be modified after creation
    - Any modification attempt invalidates the signature
    - Historical repro packs remain accessible for audit purposes

12. The system must support repro pack linking:
    - Link repro packs to customer-side evidence via reference IDs (when collector mode is enabled)
    - Enable traceability between repro pack and full evidence

## Non-Goals (Out of Scope)

1. This feature will NOT store raw prompt or output text - only hashes and metadata.

2. This feature will NOT provide the ability to replay evaluations directly from repro packs alone - replay requires access to original test cases and model APIs (or customer-side evidence).

3. This feature will NOT implement a blockchain or distributed ledger - it uses traditional cryptographic signing.

4. This feature will NOT provide real-time repro pack generation during evaluation - repro packs are generated after evaluation completion.

5. This feature will NOT support multiple hash algorithms in the initial version (SHA-256 only).

6. This feature will NOT provide a public key infrastructure (PKI) management system - customers must manage their own keys if using customer signing.

## Design Considerations

1. **Evaluation Results UI:**
   - Add "Repro Pack" section in evaluation detail view
   - Display repro pack ID, hash (truncated), signature status
   - "Download Repro Pack" button
   - "Verify Signature" button with verification result display
   - Link to customer-side evidence if collector mode is enabled

2. **Settings UI:**
   - New section for "Repro Pack Signing"
   - Option to use BiasLens signing (default) or customer signing
   - If customer signing selected: upload/configure signing key
   - Display current signing authority

3. **Repro Pack Format:**
   - JSON structure for human readability
   - Include schema version for future compatibility
   - Clear separation between metadata and signature sections

4. **Verification UI:**
   - Modal or dedicated page for signature verification
   - Upload repro pack file or paste JSON
   - Display verification result with clear success/failure indication
   - Show details: signing authority, timestamp, hash

## Technical Considerations

1. **Cryptographic Implementation:**
   - Use SHA-256 for hashing (standard library implementation)
   - Use RSA or ECDSA for digital signatures (industry standard)
   - Store signing keys securely (Supabase Vault or similar encryption)

2. **Database Schema:**
   - New table: `repro_packs`
   - Columns: id, evaluation_run_id, content_hash, signature, signing_authority, signing_key_id, created_at, repro_pack_content (JSONB)
   - Index on evaluation_run_id for fast lookups

3. **Performance:**
   - Repro pack generation should not significantly slow down evaluation completion
   - Consider async generation for large evaluations
   - Efficient hashing of outputs (batch processing if needed)

4. **Storage:**
   - Repro packs stored in BiasLens database (as specified)
   - Consider size limits for very large evaluations
   - Archive strategy for old repro packs (retention policy)

5. **Security:**
   - Signing keys must be encrypted at rest
   - Key rotation without breaking existing signatures
   - Audit log of all repro pack generations and verifications

6. **Integration:**
   - Must integrate with evaluation execution flow
   - Must work with customer-side evidence capture (link via reference IDs)
   - Must integrate with existing evaluation results display

7. **Dependencies:**
   - Cryptographic libraries (Node.js crypto module or similar)
   - JSON serialization for repro pack format
   - Database schema updates

## Success Metrics

1. **Adoption:** Number of customers using repro packs within first 3 months
2. **Support Reduction:** Reduction in compliance-related support tickets about audit trail integrity
3. **Audit Efficiency:** Reduction in time to complete compliance audits (measured through customer surveys)
4. **Verification Usage:** Number of repro pack verifications performed (indicates trust/usage)
5. **Reliability:** Repro pack generation success rate (target: 100% - every evaluation gets a repro pack)

## Open Questions

1. What is the retention policy for repro packs? Should they be kept indefinitely or have expiration?
2. Should we support multiple signatures on the same repro pack (e.g., both BiasLens and customer signature)?
3. What is the maximum size limit for repro packs? How do we handle extremely large evaluations?
4. Should repro packs be versioned? What happens if we need to change the repro pack schema?
5. Should we provide a public API for third-party verification tools?
6. How should we handle repro packs for evaluations that fail partway through?
7. Should repro packs include confidence intervals or statistical metadata from deterministic replay (if enabled)?

