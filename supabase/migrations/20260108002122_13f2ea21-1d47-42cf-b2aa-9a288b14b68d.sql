-- Update default sample_size from 100 to 5 for evaluation_settings
ALTER TABLE public.evaluation_settings ALTER COLUMN sample_size SET DEFAULT 5;

-- Create evaluation_checkpoints table for resumable processing
CREATE TABLE public.evaluation_checkpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  current_heuristic_index integer NOT NULL DEFAULT 0,
  current_test_case_index integer NOT NULL DEFAULT 0,
  current_iteration integer NOT NULL DEFAULT 0,
  partial_findings jsonb DEFAULT '[]'::jsonb,
  partial_scores jsonb DEFAULT '{}'::jsonb,
  captured_evidence jsonb DEFAULT '[]'::jsonb,
  repro_capture_entries jsonb DEFAULT '[]'::jsonb,
  last_heartbeat_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id)
);

-- Enable RLS
ALTER TABLE public.evaluation_checkpoints ENABLE ROW LEVEL SECURITY;

-- Service role can manage checkpoints (edge functions use service role)
CREATE POLICY "Service role can manage checkpoints"
ON public.evaluation_checkpoints
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_evaluation_checkpoints_evaluation_id ON public.evaluation_checkpoints(evaluation_id);
CREATE INDEX idx_evaluation_checkpoints_heartbeat ON public.evaluation_checkpoints(last_heartbeat_at);

-- Add trigger for updated_at
CREATE TRIGGER update_evaluation_checkpoints_updated_at
BEFORE UPDATE ON public.evaluation_checkpoints
FOR EACH ROW
EXECUTE FUNCTION public.update_evaluation_progress_timestamp();

-- Enable realtime for checkpoints to allow monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluation_checkpoints;