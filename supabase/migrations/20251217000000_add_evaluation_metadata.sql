-- Add evaluation metadata fields for deterministic execution and auditability
ALTER TABLE public.evaluations
ADD COLUMN IF NOT EXISTS determinism_mode text,
ADD COLUMN IF NOT EXISTS seed_value bigint,
ADD COLUMN IF NOT EXISTS iterations_run integer,
ADD COLUMN IF NOT EXISTS achieved_level text,
ADD COLUMN IF NOT EXISTS parameters_used jsonb,
ADD COLUMN IF NOT EXISTS confidence_intervals jsonb,
ADD COLUMN IF NOT EXISTS per_iteration_results jsonb;

ALTER TABLE public.evidence_references
ADD COLUMN IF NOT EXISTS determinism_mode text,
ADD COLUMN IF NOT EXISTS seed_value bigint,
ADD COLUMN IF NOT EXISTS iterations_run integer,
ADD COLUMN IF NOT EXISTS achieved_level text,
ADD COLUMN IF NOT EXISTS parameters_used jsonb,
ADD COLUMN IF NOT EXISTS confidence_intervals jsonb,
ADD COLUMN IF NOT EXISTS per_iteration_results jsonb;
