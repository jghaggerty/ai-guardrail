-- Fix the is_owner function to have a fixed search_path
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT _user_id = auth.uid()
$$;

-- Update handle_new_user to auto-create a personal team for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    RETURN new;
END;
$$;