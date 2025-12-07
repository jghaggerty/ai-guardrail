-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view team members profiles" ON public.profiles;

-- Create updated policy with explicit authentication check
CREATE POLICY "Users can view team members profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (team_id = get_user_team_id(auth.uid()) OR id = auth.uid())
);