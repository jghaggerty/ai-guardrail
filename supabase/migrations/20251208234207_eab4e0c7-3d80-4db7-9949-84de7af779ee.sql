-- Create a security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create a function to check if user is admin or owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'owner')
  )
$$;

-- Create a safe view that excludes the encrypted API key
CREATE OR REPLACE VIEW public.llm_configurations_safe AS
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
FROM public.llm_configurations;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Team members can view LLM configs" ON public.llm_configurations;

-- Create new SELECT policy that only allows admins/owners to see full table (including encrypted keys)
CREATE POLICY "Admins can view full LLM configs" 
ON public.llm_configurations 
FOR SELECT 
USING (
  team_id = get_user_team_id(auth.uid()) 
  AND is_admin_or_owner(auth.uid())
);

-- Enable RLS on the view (views inherit from base table, but we grant access)
GRANT SELECT ON public.llm_configurations_safe TO authenticated;