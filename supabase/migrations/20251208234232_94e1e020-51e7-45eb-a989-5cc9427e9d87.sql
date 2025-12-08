-- Drop and recreate the view with SECURITY INVOKER (default, but explicit)
DROP VIEW IF EXISTS public.llm_configurations_safe;

CREATE VIEW public.llm_configurations_safe 
WITH (security_invoker = true) AS
SELECT 
  id,
  team_id,
  user_id,
  provider,
  model_name,
  model_version,
  display_name,
  base_url,
  environment,
  is_connected,
  last_tested_at,
  created_at,
  updated_at
FROM public.llm_configurations
WHERE team_id = get_user_team_id(auth.uid());

-- Grant access to authenticated users
GRANT SELECT ON public.llm_configurations_safe TO authenticated;