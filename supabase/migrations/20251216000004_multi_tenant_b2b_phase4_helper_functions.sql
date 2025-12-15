-- ============================================================================
-- Multi-Tenant B2B RLS Migration - Phase 4: Helper Functions for RLS
-- ============================================================================
-- These SECURITY DEFINER functions are used by RLS policies to check
-- company membership, admin status, team roles, etc.
-- They bypass RLS to avoid recursion while performing authorization checks.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. get_user_company_id - Get the company ID for a user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- First check company_id from profiles (denormalized for performance)
    SELECT COALESCE(
        (SELECT company_id FROM public.profiles WHERE id = _user_id),
        -- Fallback to deriving from team membership
        (SELECT DISTINCT t.company_id
         FROM public.user_roles ur
         JOIN public.teams t ON ur.team_id = t.id
         WHERE ur.user_id = _user_id
         LIMIT 1)
    )
$$;

-- ----------------------------------------------------------------------------
-- 2. is_company_admin - Check if user is a company admin
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_user_roles
        WHERE user_id = _user_id
          AND company_id = _company_id
          AND role = 'company_admin'
    )
$$;

-- ----------------------------------------------------------------------------
-- 3. is_company_admin_of_own_company - Check if user is admin of their company
-- Convenience function that doesn't require passing company_id
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_company_admin_of_own_company(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_user_roles cur
        JOIN public.profiles p ON cur.company_id = p.company_id
        WHERE cur.user_id = _user_id
          AND p.id = _user_id
          AND cur.role = 'company_admin'
    )
$$;

-- ----------------------------------------------------------------------------
-- 4. is_company_member - Check if user belongs to a company
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.teams t ON ur.team_id = t.id
        WHERE ur.user_id = _user_id
          AND t.company_id = _company_id
    )
$$;

-- ----------------------------------------------------------------------------
-- 5. has_team_role - Check if user has specific role in a team
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_team_role(_user_id uuid, _team_id uuid, _role_name text)
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
          AND team_id = _team_id
          AND role::text = _role_name
    )
$$;

-- ----------------------------------------------------------------------------
-- 6. has_team_role_or_higher - Check if user has role or higher in a team
-- Role hierarchy: team_admin > team_member > viewer
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_team_role_or_higher(_user_id uuid, _team_id uuid, _min_role text)
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
          AND team_id = _team_id
          AND (
            CASE _min_role
                WHEN 'viewer' THEN role IN ('viewer', 'team_member', 'team_admin')
                WHEN 'team_member' THEN role IN ('team_member', 'team_admin')
                WHEN 'team_admin' THEN role = 'team_admin'
                ELSE false
            END
          )
    )
$$;

-- ----------------------------------------------------------------------------
-- 7. is_team_member - Check if user is a member of a specific team
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
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
          AND team_id = _team_id
    )
$$;

-- ----------------------------------------------------------------------------
-- 8. get_user_active_team_id - Get user's active/current team
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_active_team_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT active_team_id
    FROM public.profiles
    WHERE id = _user_id
$$;

-- ----------------------------------------------------------------------------
-- 9. get_user_team_ids - Get all team IDs for a user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ARRAY_AGG(team_id)
    FROM public.user_roles
    WHERE user_id = _user_id
$$;

-- ----------------------------------------------------------------------------
-- 10. can_access_team - Check if user can access team data
-- User can access if they're a member OR a company admin
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        -- User is a member of the team
        EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = _user_id
              AND team_id = _team_id
        )
        OR
        -- User is a company admin of the team's company
        EXISTS (
            SELECT 1
            FROM public.teams t
            JOIN public.company_user_roles cur ON t.company_id = cur.company_id
            WHERE t.id = _team_id
              AND cur.user_id = _user_id
              AND cur.role = 'company_admin'
        )
$$;

-- ----------------------------------------------------------------------------
-- 11. can_write_to_team - Check if user can write to team (team_member+)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_write_to_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        -- User is team_member or team_admin in the team
        EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = _user_id
              AND team_id = _team_id
              AND role IN ('team_member', 'team_admin')
        )
        OR
        -- User is a company admin of the team's company
        EXISTS (
            SELECT 1
            FROM public.teams t
            JOIN public.company_user_roles cur ON t.company_id = cur.company_id
            WHERE t.id = _team_id
              AND cur.user_id = _user_id
              AND cur.role = 'company_admin'
        )
$$;

-- ----------------------------------------------------------------------------
-- 12. can_admin_team - Check if user can admin team (team_admin+)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_admin_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        -- User is team_admin in the team
        EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = _user_id
              AND team_id = _team_id
              AND role = 'team_admin'
        )
        OR
        -- User is a company admin of the team's company
        EXISTS (
            SELECT 1
            FROM public.teams t
            JOIN public.company_user_roles cur ON t.company_id = cur.company_id
            WHERE t.id = _team_id
              AND cur.user_id = _user_id
              AND cur.role = 'company_admin'
        )
$$;

-- ----------------------------------------------------------------------------
-- 13. get_team_company_id - Get company_id for a team
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_company_id(_team_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id
    FROM public.teams
    WHERE id = _team_id
$$;

-- ============================================================================
-- End of Phase 4 Migration
-- ============================================================================
