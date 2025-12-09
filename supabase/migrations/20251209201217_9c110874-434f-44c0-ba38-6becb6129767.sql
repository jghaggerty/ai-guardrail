-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Team members can create LLM configs" ON public.llm_configurations;

-- Create a PERMISSIVE INSERT policy (default behavior)
CREATE POLICY "Team members can create LLM configs"
ON public.llm_configurations
FOR INSERT
TO authenticated
WITH CHECK (team_id = get_user_team_id(auth.uid()));