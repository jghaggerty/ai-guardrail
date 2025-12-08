-- Add organization-related fields to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS company_size text,
ADD COLUMN IF NOT EXISTS industry text[],
ADD COLUMN IF NOT EXISTS headquarters_country text,
ADD COLUMN IF NOT EXISTS headquarters_state text,
ADD COLUMN IF NOT EXISTS dpa_accepted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS dpa_version text;

-- Add job_title to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS tos_accepted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Allow users to update their team's organization info
CREATE POLICY "Team members can update their team"
ON public.teams
FOR UPDATE
USING (id = get_user_team_id(auth.uid()))
WITH CHECK (id = get_user_team_id(auth.uid()));