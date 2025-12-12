-- Create evaluation_progress table for real-time progress tracking
CREATE TABLE public.evaluation_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  current_phase TEXT NOT NULL DEFAULT 'initializing',
  current_heuristic TEXT,
  tests_completed INTEGER DEFAULT 0,
  tests_total INTEGER DEFAULT 0,
  message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evaluation_progress ENABLE ROW LEVEL SECURITY;

-- Allow team members to view progress
CREATE POLICY "Team members can view evaluation progress"
ON public.evaluation_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.id = evaluation_progress.evaluation_id
    AND e.team_id = get_user_team_id(auth.uid())
  )
);

-- Allow evaluation owners to create/update progress
CREATE POLICY "Service role can manage progress"
ON public.evaluation_progress
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluation_progress;

-- Use REPLICA IDENTITY FULL for complete row data in realtime updates
ALTER TABLE public.evaluation_progress REPLICA IDENTITY FULL;

-- Create index for fast lookups
CREATE INDEX idx_evaluation_progress_evaluation_id ON public.evaluation_progress(evaluation_id);

-- Create function to update progress timestamp
CREATE OR REPLACE FUNCTION public.update_evaluation_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_evaluation_progress_timestamp
BEFORE UPDATE ON public.evaluation_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_evaluation_progress_timestamp();