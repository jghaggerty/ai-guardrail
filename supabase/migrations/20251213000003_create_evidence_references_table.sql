-- Create evidence_references table for detailed per-test-case references
-- This table stores granular reference information for each test case iteration
-- when collector mode is enabled, allowing traceability to specific evidence
CREATE TABLE public.evidence_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  test_case_id text NOT NULL,
  reference_id text NOT NULL,
  storage_location text NOT NULL,
  storage_type evidence_storage_type NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add comments to table and columns
COMMENT ON TABLE public.evidence_references IS 'Stores detailed per-test-case reference information linking BiasLens scores to customer-stored evidence';
COMMENT ON COLUMN public.evidence_references.evaluation_id IS 'Foreign key to the evaluation this reference belongs to';
COMMENT ON COLUMN public.evidence_references.test_case_id IS 'Identifier for the test case this reference corresponds to';
COMMENT ON COLUMN public.evidence_references.reference_id IS 'Unique reference ID for this test case iteration (e.g., test-case-{testCaseId}-{iteration}-{uuid})';
COMMENT ON COLUMN public.evidence_references.storage_location IS 'Full storage location path (e.g., S3 bucket/key, SIEM index/document ID)';
COMMENT ON COLUMN public.evidence_references.storage_type IS 'Type of storage system used (s3, splunk, or elk)';
COMMENT ON COLUMN public.evidence_references.created_at IS 'Timestamp when this reference was created';

-- Create indexes for query performance
CREATE INDEX idx_evidence_references_evaluation_id ON public.evidence_references(evaluation_id);
CREATE INDEX idx_evidence_references_test_case_id ON public.evidence_references(test_case_id);
CREATE INDEX idx_evidence_references_reference_id ON public.evidence_references(reference_id);

-- Enable Row Level Security
ALTER TABLE public.evidence_references ENABLE ROW LEVEL SECURITY;

-- RLS policies: team members can view references for evaluations in their team
CREATE POLICY "Team members can view evidence references"
ON public.evidence_references FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evidence_references.evaluation_id
    AND e.team_id = public.get_user_team_id(auth.uid())
  )
);

-- Evaluation owners can create references
CREATE POLICY "Evaluation owners can create evidence references"
ON public.evidence_references FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evidence_references.evaluation_id
    AND e.user_id = auth.uid()
  )
);

-- Evaluation owners can update references
CREATE POLICY "Evaluation owners can update evidence references"
ON public.evidence_references FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evidence_references.evaluation_id
    AND e.user_id = auth.uid()
  )
);

-- Evaluation owners can delete references
CREATE POLICY "Evaluation owners can delete evidence references"
ON public.evidence_references FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evidence_references.evaluation_id
    AND e.user_id = auth.uid()
  )
);

