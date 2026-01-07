-- Fix the overly permissive RLS policy on evaluation_progress
-- Drop the existing policy that allows all roles to access the table
DROP POLICY IF EXISTS "Service role can manage progress" ON public.evaluation_progress;

-- Recreate the policy scoped to service_role only
-- This ensures only server-side code with service role credentials can manage progress
CREATE POLICY "Service role can manage progress"
ON public.evaluation_progress
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);