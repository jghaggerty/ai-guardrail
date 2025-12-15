-- Create signing_mode enum to track whether BiasLens or customer keys are active
CREATE TYPE public.signing_mode AS ENUM ('biaslens', 'customer');

-- Create signing_key_status enum to track lifecycle/rotation
CREATE TYPE public.signing_key_status AS ENUM ('active', 'inactive', 'rotated');

-- Table for storing encrypted signing keys and metadata
CREATE TABLE public.signing_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signing_authority text NOT NULL DEFAULT 'customer',
  signing_key_id text NOT NULL,
  public_key text NOT NULL,
  private_key_encrypted text NOT NULL,
  status public.signing_key_status NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  rotated_at timestamp with time zone,
  UNIQUE(team_id, signing_key_id, signing_authority)
);

COMMENT ON TABLE public.signing_keys IS 'Stores customer-provided signing keys encrypted at rest for reproducibility packs';
COMMENT ON COLUMN public.signing_keys.signing_authority IS 'Identifies who owns the key (customer or BiasLens for defaults)';
COMMENT ON COLUMN public.signing_keys.signing_key_id IS 'External identifier for the signing key to support rotation/lookup';
COMMENT ON COLUMN public.signing_keys.public_key IS 'Public key material used by verifiers to validate signatures';
COMMENT ON COLUMN public.signing_keys.private_key_encrypted IS 'Private key encrypted at rest using SIGNING_KEY_ENCRYPTION_SECRET';
COMMENT ON COLUMN public.signing_keys.status IS 'Lifecycle status for rotation and key history tracking';

CREATE INDEX idx_signing_keys_team_status ON public.signing_keys(team_id, status);

-- Table to track which signing mode is active per team and the currently active key
CREATE TABLE public.team_signing_configs (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  signing_mode public.signing_mode NOT NULL DEFAULT 'biaslens',
  active_signing_key_id uuid REFERENCES public.signing_keys(id),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_mode_requires_key CHECK (
    signing_mode <> 'customer' OR active_signing_key_id IS NOT NULL
  )
);

COMMENT ON TABLE public.team_signing_configs IS 'Tracks per-team signing mode and active customer key for reproducibility pack signatures';
COMMENT ON COLUMN public.team_signing_configs.signing_mode IS 'Determines whether BiasLens-managed or customer-provided keys are used';
COMMENT ON COLUMN public.team_signing_configs.active_signing_key_id IS 'Current active signing key when customer mode is enabled';

CREATE INDEX idx_team_signing_configs_active_key ON public.team_signing_configs(active_signing_key_id);

-- Seed configs for existing teams with BiasLens as the default
INSERT INTO public.team_signing_configs (team_id, signing_mode)
SELECT id, 'biaslens'::public.signing_mode FROM public.teams
ON CONFLICT (team_id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.signing_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_signing_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies for signing_keys
CREATE POLICY "Team members can view signing keys"
ON public.signing_keys FOR SELECT
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create signing keys"
ON public.signing_keys FOR INSERT
WITH CHECK (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update signing keys"
ON public.signing_keys FOR UPDATE
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can rotate signing keys"
ON public.signing_keys FOR DELETE
USING (team_id = get_user_team_id(auth.uid()));

-- RLS policies for team_signing_configs
CREATE POLICY "Team members can view signing configs"
ON public.team_signing_configs FOR SELECT
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can upsert signing configs"
ON public.team_signing_configs FOR INSERT
WITH CHECK (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can modify signing configs"
ON public.team_signing_configs FOR UPDATE
USING (team_id = get_user_team_id(auth.uid()));
