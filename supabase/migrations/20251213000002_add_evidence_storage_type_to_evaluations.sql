-- Add evidence_storage_type column to evaluations table
-- This column tracks which storage system was used (s3, splunk, or elk)
-- It is nullable since it's only set when collector mode is enabled
ALTER TABLE public.evaluations 
    ADD COLUMN evidence_storage_type evidence_storage_type;

-- Add comment to column
COMMENT ON COLUMN public.evaluations.evidence_storage_type IS 'Type of storage system used for evidence collection (s3, splunk, or elk). Only set when collector mode is enabled.';

