-- Create repro_packs table for storing reproducibility package data
CREATE TABLE public.repro_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_run_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  signature text,
  signing_authority text,
  signing_key_id text,
  repro_pack_content jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(evaluation_run_id)
);

-- Enable RLS
ALTER TABLE public.repro_packs ENABLE ROW LEVEL SECURITY;

-- Service role can manage repro packs (edge functions use service role)
CREATE POLICY "Service role can manage repro packs"
ON public.repro_packs
FOR ALL
USING (true)
WITH CHECK (true);

-- Users can view repro packs for their team's evaluations
CREATE POLICY "Team members can view repro packs"
ON public.repro_packs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM evaluations e
  WHERE e.id = repro_packs.evaluation_run_id
  AND e.team_id = get_user_team_id(auth.uid())
));

-- Create index for faster lookups
CREATE INDEX idx_repro_packs_evaluation_run_id ON public.repro_packs(evaluation_run_id);