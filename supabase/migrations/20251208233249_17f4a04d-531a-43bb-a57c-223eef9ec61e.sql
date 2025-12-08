-- Create LLM configurations table
CREATE TABLE public.llm_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model_name text NOT NULL,
  model_version text,
  display_name text NOT NULL,
  api_key_encrypted text,
  base_url text,
  environment text DEFAULT 'development' CHECK (environment IN ('development', 'production')),
  is_connected boolean DEFAULT false,
  last_tested_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (team_id, provider, model_name)
);

-- Create evaluation settings table
CREATE TABLE public.evaluation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL UNIQUE,
  test_suites text[] DEFAULT ARRAY['cognitive_bias'],
  protected_attributes text[] DEFAULT ARRAY[]::text[],
  sample_size integer DEFAULT 500 CHECK (sample_size >= 100 AND sample_size <= 1000),
  confidence_interval numeric DEFAULT 0.95 CHECK (confidence_interval IN (0.90, 0.95, 0.99)),
  temperature numeric DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  keep_temperature_constant boolean DEFAULT true,
  schedule_frequency text DEFAULT 'manual' CHECK (schedule_frequency IN ('manual', 'hourly', 'daily', 'weekly', 'biweekly', 'monthly')),
  schedule_day integer,
  schedule_time text DEFAULT '02:00',
  alert_threshold text DEFAULT 'moderate' CHECK (alert_threshold IN ('conservative', 'moderate', 'aggressive')),
  alert_emails text[] DEFAULT ARRAY[]::text[],
  report_emails text[] DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.llm_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for llm_configurations
CREATE POLICY "Team members can view LLM configs"
ON public.llm_configurations FOR SELECT
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create LLM configs"
ON public.llm_configurations FOR INSERT
WITH CHECK (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update LLM configs"
ON public.llm_configurations FOR UPDATE
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can delete LLM configs"
ON public.llm_configurations FOR DELETE
USING (team_id = get_user_team_id(auth.uid()));

-- RLS policies for evaluation_settings
CREATE POLICY "Team members can view evaluation settings"
ON public.evaluation_settings FOR SELECT
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create evaluation settings"
ON public.evaluation_settings FOR INSERT
WITH CHECK (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update evaluation settings"
ON public.evaluation_settings FOR UPDATE
USING (team_id = get_user_team_id(auth.uid()));