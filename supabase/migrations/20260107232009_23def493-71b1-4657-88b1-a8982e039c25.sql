-- Update the default sample_size from 500 to 100 to prevent edge function timeouts
ALTER TABLE public.evaluation_settings 
ALTER COLUMN sample_size SET DEFAULT 100;

-- Also update existing settings that still have 500 to use 100
UPDATE public.evaluation_settings 
SET sample_size = 100 
WHERE sample_size = 500;