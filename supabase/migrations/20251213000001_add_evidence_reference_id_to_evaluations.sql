-- Add evidence_reference_id column to evaluations table
-- This column stores the reference ID linking to customer-stored evidence
-- It is nullable since not all evaluations use collector mode
ALTER TABLE public.evaluations 
    ADD COLUMN evidence_reference_id text;

-- Add comment to column
COMMENT ON COLUMN public.evaluations.evidence_reference_id IS 'Reference ID linking to customer-stored evidence (S3 key, SIEM document ID, etc.). Only set when collector mode is enabled.';

