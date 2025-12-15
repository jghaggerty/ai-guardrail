-- ============================================================================
-- Multi-Tenant B2B RLS Migration - Phase 8: New User Trigger
-- ============================================================================
-- This migration updates the handle_new_user trigger to support the new
-- multi-tenant model with companies, teams, and roles.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Update handle_new_user function for new multi-tenant model
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_company_id uuid;
    new_team_id uuid;
    user_full_name text;
    company_name text;
    team_name text;
BEGIN
    -- Get user's full name from metadata
    user_full_name := COALESCE(new.raw_user_meta_data ->> 'full_name', 'User');
    company_name := user_full_name || '''s Company';
    team_name := 'Default Team';

    -- 1. Create a new company for this user
    INSERT INTO public.companies (name)
    VALUES (company_name)
    RETURNING id INTO new_company_id;

    -- 2. Create a default team for the user within the company
    INSERT INTO public.teams (name, company_id, description)
    VALUES (team_name, new_company_id, 'Default team created on signup')
    RETURNING id INTO new_team_id;

    -- 3. Create the user profile linked to company and team
    INSERT INTO public.profiles (id, full_name, company_id, active_team_id)
    VALUES (new.id, user_full_name, new_company_id, new_team_id);

    -- 4. Assign Company Admin role to the new user
    INSERT INTO public.company_user_roles (user_id, company_id, role, created_by)
    VALUES (new.id, new_company_id, 'company_admin', new.id);

    -- 5. Assign Team Admin role to the new user for the default team
    INSERT INTO public.user_roles (user_id, team_id, role)
    VALUES (new.id, new_team_id, 'team_admin');

    -- 6. Create default team signing config (BiasLens mode)
    INSERT INTO public.team_signing_configs (team_id, company_id, signing_mode)
    VALUES (new_team_id, new_company_id, 'biaslens')
    ON CONFLICT (team_id) DO NOTHING;

    RETURN new;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Function to handle user joining a team via invitation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_invitation_acceptance(
    _invitation_id uuid,
    _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invitation_record RECORD;
    team_company_id uuid;
    user_company_id uuid;
BEGIN
    -- Get the invitation details
    SELECT * INTO invitation_record
    FROM public.team_invitations
    WHERE id = _invitation_id
      AND accepted_at IS NULL
      AND expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found or expired';
    END IF;

    -- Get the team's company
    SELECT company_id INTO team_company_id
    FROM public.teams
    WHERE id = invitation_record.team_id;

    -- Get the user's current company (if any)
    SELECT company_id INTO user_company_id
    FROM public.profiles
    WHERE id = _user_id;

    -- Validate company consistency
    -- If user already has a company, they can only join teams in that company
    IF user_company_id IS NOT NULL AND user_company_id != team_company_id THEN
        RAISE EXCEPTION 'Cannot join teams in different companies';
    END IF;

    -- If user doesn't have a company yet, update their profile
    IF user_company_id IS NULL THEN
        UPDATE public.profiles
        SET company_id = team_company_id,
            active_team_id = COALESCE(active_team_id, invitation_record.team_id)
        WHERE id = _user_id;
    END IF;

    -- Create the user role
    INSERT INTO public.user_roles (user_id, team_id, role)
    VALUES (_user_id, invitation_record.team_id, invitation_record.role)
    ON CONFLICT (user_id, team_id) DO UPDATE
    SET role = EXCLUDED.role;

    -- Mark invitation as accepted
    UPDATE public.team_invitations
    SET accepted_at = now()
    WHERE id = _invitation_id;

    RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Function to switch user's active team
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.switch_active_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    team_company_id uuid;
    user_company_id uuid;
BEGIN
    -- Get team's company
    SELECT company_id INTO team_company_id
    FROM public.teams
    WHERE id = _team_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found';
    END IF;

    -- Get user's company
    SELECT company_id INTO user_company_id
    FROM public.profiles
    WHERE id = _user_id;

    -- Validate user is a member of the team or company admin
    IF NOT (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = _user_id AND team_id = _team_id
        )
        OR
        EXISTS (
            SELECT 1 FROM public.company_user_roles
            WHERE user_id = _user_id
              AND company_id = team_company_id
              AND role = 'company_admin'
        )
    ) THEN
        RAISE EXCEPTION 'User is not a member of this team';
    END IF;

    -- Validate team is in user's company
    IF user_company_id != team_company_id THEN
        RAISE EXCEPTION 'Team is not in user''s company';
    END IF;

    -- Update active team
    UPDATE public.profiles
    SET active_team_id = _team_id
    WHERE id = _user_id;

    RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Function to create a new team
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_team(
    _name text,
    _description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_company_id uuid;
    new_team_id uuid;
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();

    -- Get user's company
    SELECT company_id INTO user_company_id
    FROM public.profiles
    WHERE id = current_user_id;

    IF user_company_id IS NULL THEN
        RAISE EXCEPTION 'User does not belong to a company';
    END IF;

    -- Verify user has permission to create teams (company admin or team admin)
    IF NOT (
        is_company_admin(current_user_id, user_company_id)
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = current_user_id
              AND role = 'team_admin'
        )
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to create teams';
    END IF;

    -- Create the team
    INSERT INTO public.teams (name, company_id, description)
    VALUES (_name, user_company_id, _description)
    RETURNING id INTO new_team_id;

    -- Assign creator as team admin
    INSERT INTO public.user_roles (user_id, team_id, role)
    VALUES (current_user_id, new_team_id, 'team_admin');

    -- Create default team signing config
    INSERT INTO public.team_signing_configs (team_id, company_id, signing_mode)
    VALUES (new_team_id, user_company_id, 'biaslens')
    ON CONFLICT (team_id) DO NOTHING;

    RETURN new_team_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Function to remove the legacy team_id from profiles
-- This should be run after confirming migration success
-- ----------------------------------------------------------------------------
-- Note: We keep team_id for now for backward compatibility
-- Uncomment the following to remove it after migration is verified:

-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS team_id;

-- ============================================================================
-- End of Phase 8 Migration
-- ============================================================================
