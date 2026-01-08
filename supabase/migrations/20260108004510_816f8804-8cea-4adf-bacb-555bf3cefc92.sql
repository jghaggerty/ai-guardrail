-- Drop existing check constraint
ALTER TABLE public.evaluation_settings DROP CONSTRAINT evaluation_settings_sample_size_check;

-- Add new constraint allowing sample_size from 1 to 1000
ALTER TABLE public.evaluation_settings ADD CONSTRAINT evaluation_settings_sample_size_check CHECK (sample_size >= 1 AND sample_size <= 1000);