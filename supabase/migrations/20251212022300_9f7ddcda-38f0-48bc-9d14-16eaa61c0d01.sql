-- Add schedule_frequency column to llm_configurations table
ALTER TABLE public.llm_configurations 
ADD COLUMN schedule_frequency text DEFAULT 'manual'::text;

-- Add comment for documentation
COMMENT ON COLUMN public.llm_configurations.schedule_frequency IS 'Frequency for automatic evaluation runs: manual, daily, weekly, monthly';