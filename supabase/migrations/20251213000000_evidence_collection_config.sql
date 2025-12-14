-- Create enum type for evidence storage types
CREATE TYPE evidence_storage_type AS ENUM ('s3', 'splunk', 'elk');

-- Create evidence collection configurations table
CREATE TABLE public.evidence_collection_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  storage_type evidence_storage_type NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  credentials_encrypted text,
  configuration jsonb DEFAULT '{}'::jsonb,
  last_tested_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (team_id)
);

-- Add comment to table
COMMENT ON TABLE public.evidence_collection_configs IS 'Stores evidence collection configuration for teams using customer-side evidence capture';

-- Add comments to columns
COMMENT ON COLUMN public.evidence_collection_configs.storage_type IS 'Type of storage system: s3, splunk, or elk';
COMMENT ON COLUMN public.evidence_collection_configs.is_enabled IS 'Whether collector mode is enabled for this team';
COMMENT ON COLUMN public.evidence_collection_configs.credentials_encrypted IS 'Encrypted credentials for the storage system';
COMMENT ON COLUMN public.evidence_collection_configs.configuration IS 'Storage-specific configuration settings (bucket name, endpoint, index, etc.)';

-- Enable Row Level Security
ALTER TABLE public.evidence_collection_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies for evidence_collection_configs
-- Team members can view their team's evidence collection config
CREATE POLICY "Team members can view evidence collection configs"
ON public.evidence_collection_configs FOR SELECT
USING (team_id = get_user_team_id(auth.uid()));

-- Team members can create evidence collection configs for their team
CREATE POLICY "Team members can create evidence collection configs"
ON public.evidence_collection_configs FOR INSERT
WITH CHECK (team_id = get_user_team_id(auth.uid()));

-- Team members can update their team's evidence collection config
CREATE POLICY "Team members can update evidence collection configs"
ON public.evidence_collection_configs FOR UPDATE
USING (team_id = get_user_team_id(auth.uid()));

-- Team members can delete their team's evidence collection config
CREATE POLICY "Team members can delete evidence collection configs"
ON public.evidence_collection_configs FOR DELETE
USING (team_id = get_user_team_id(auth.uid()));

