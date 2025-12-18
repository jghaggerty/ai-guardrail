-- Add missing columns to evaluations table
ALTER TABLE public.evaluations
ADD COLUMN IF NOT EXISTS determinism_mode text,
ADD COLUMN IF NOT EXISTS seed_value integer,
ADD COLUMN IF NOT EXISTS iterations_run integer,
ADD COLUMN IF NOT EXISTS achieved_level text,
ADD COLUMN IF NOT EXISTS parameters_used jsonb,
ADD COLUMN IF NOT EXISTS confidence_intervals jsonb;

-- Create evidence_collection_configs table
CREATE TABLE IF NOT EXISTS public.evidence_collection_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  storage_type text NOT NULL DEFAULT 'none',
  credentials_encrypted text,
  storage_path text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

-- Enable RLS on evidence_collection_configs
ALTER TABLE public.evidence_collection_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for evidence_collection_configs
CREATE POLICY "Users can view their team's evidence config"
ON public.evidence_collection_configs
FOR SELECT
USING (team_id IN (SELECT get_user_team_ids(auth.uid())));

CREATE POLICY "Admins can manage their team's evidence config"
ON public.evidence_collection_configs
FOR ALL
USING (team_id IN (SELECT get_user_team_ids(auth.uid())) AND is_admin_or_owner(auth.uid()))
WITH CHECK (team_id IN (SELECT get_user_team_ids(auth.uid())) AND is_admin_or_owner(auth.uid()));