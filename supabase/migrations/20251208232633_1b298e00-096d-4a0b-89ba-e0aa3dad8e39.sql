-- Create role enum for team members
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'evaluator', 'viewer');

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_id)
);

-- Create team_invitations table for pending invites
CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'evaluator',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  UNIQUE (team_id, email)
);

-- Add billing contact to teams
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS billing_contact_name text;

-- Enable RLS on new tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Users can view roles in their team"
ON public.user_roles FOR SELECT
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Admins can manage roles in their team"
ON public.user_roles FOR INSERT
WITH CHECK (
  team_id = get_user_team_id(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.team_id = user_roles.team_id 
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can update roles in their team"
ON public.user_roles FOR UPDATE
USING (
  team_id = get_user_team_id(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.team_id = user_roles.team_id 
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can delete roles in their team"
ON public.user_roles FOR DELETE
USING (
  team_id = get_user_team_id(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.team_id = user_roles.team_id 
    AND ur.role IN ('owner', 'admin')
  )
);

-- RLS policies for team_invitations
CREATE POLICY "Team members can view their team invitations"
ON public.team_invitations FOR SELECT
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Admins can create team invitations"
ON public.team_invitations FOR INSERT
WITH CHECK (
  team_id = get_user_team_id(auth.uid()) AND
  (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.team_id = team_invitations.team_id 
      AND ur.role IN ('owner', 'admin')
    )
    OR
    -- Allow owner during initial setup (before roles are created)
    NOT EXISTS (SELECT 1 FROM public.user_roles WHERE team_id = team_invitations.team_id)
  )
);

CREATE POLICY "Admins can delete team invitations"
ON public.team_invitations FOR DELETE
USING (
  team_id = get_user_team_id(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.team_id = team_invitations.team_id 
    AND ur.role IN ('owner', 'admin')
  )
);

-- Function to assign owner role when team is created (update existing trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    new_team_id uuid;
BEGIN
    -- Create a personal team for the new user
    INSERT INTO public.teams (name)
    VALUES (COALESCE(new.raw_user_meta_data ->> 'full_name', 'Personal Team'))
    RETURNING id INTO new_team_id;

    -- Create the profile with the team assignment
    INSERT INTO public.profiles (id, full_name, team_id)
    VALUES (new.id, new.raw_user_meta_data ->> 'full_name', new_team_id);

    -- Assign owner role to the new user
    INSERT INTO public.user_roles (user_id, team_id, role)
    VALUES (new.id, new_team_id, 'owner');

    RETURN new;
END;
$$;