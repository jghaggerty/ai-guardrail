-- ============================================================================
-- Multi-Tenant B2B RLS Migration - Phase 3: Update Roles System
-- ============================================================================
-- This migration updates the role system from the old 4-role model
-- (owner, admin, evaluator, viewer) to the new B2B model:
-- - Company-level: company_admin (in company_user_roles table)
-- - Team-level: team_admin, team_member, viewer (in user_roles table)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create new app_role enum with updated values
-- ----------------------------------------------------------------------------
-- Note: PostgreSQL doesn't allow direct enum value removal/rename,
-- so we create a new enum type and migrate.

-- Create the new enum type
CREATE TYPE public.app_role_v2 AS ENUM ('team_admin', 'team_member', 'viewer');

-- ----------------------------------------------------------------------------
-- 2. Update user_roles table to use new enum
-- ----------------------------------------------------------------------------
-- Add a temporary column with the new enum type
ALTER TABLE public.user_roles
    ADD COLUMN role_v2 public.app_role_v2;

-- Migrate existing roles to new values
-- owner -> team_admin (company_admin will be handled separately)
-- admin -> team_admin
-- evaluator -> team_member
-- viewer -> viewer
UPDATE public.user_roles
SET role_v2 = CASE
    WHEN role::text = 'owner' THEN 'team_admin'::public.app_role_v2
    WHEN role::text = 'admin' THEN 'team_admin'::public.app_role_v2
    WHEN role::text = 'evaluator' THEN 'team_member'::public.app_role_v2
    WHEN role::text = 'viewer' THEN 'viewer'::public.app_role_v2
END;

-- Drop the old role column and rename
ALTER TABLE public.user_roles DROP COLUMN role;
ALTER TABLE public.user_roles RENAME COLUMN role_v2 TO role;

-- Make role NOT NULL with default
ALTER TABLE public.user_roles
    ALTER COLUMN role SET NOT NULL,
    ALTER COLUMN role SET DEFAULT 'viewer'::public.app_role_v2;

-- ----------------------------------------------------------------------------
-- 3. Update team_invitations table to use new enum
-- ----------------------------------------------------------------------------
-- Add a temporary column with the new enum type
ALTER TABLE public.team_invitations
    ADD COLUMN role_v2 public.app_role_v2;

-- Migrate existing invitation roles
UPDATE public.team_invitations
SET role_v2 = CASE
    WHEN role::text = 'owner' THEN 'team_admin'::public.app_role_v2
    WHEN role::text = 'admin' THEN 'team_admin'::public.app_role_v2
    WHEN role::text = 'evaluator' THEN 'team_member'::public.app_role_v2
    WHEN role::text = 'viewer' THEN 'viewer'::public.app_role_v2
END;

-- Drop the old role column and rename
ALTER TABLE public.team_invitations DROP COLUMN role;
ALTER TABLE public.team_invitations RENAME COLUMN role_v2 TO role;

-- Make role NOT NULL with default
ALTER TABLE public.team_invitations
    ALTER COLUMN role SET NOT NULL,
    ALTER COLUMN role SET DEFAULT 'team_member'::public.app_role_v2;

-- ----------------------------------------------------------------------------
-- 4. Drop old enum type and rename new one
-- ----------------------------------------------------------------------------
DROP TYPE public.app_role;
ALTER TYPE public.app_role_v2 RENAME TO app_role;

-- ----------------------------------------------------------------------------
-- 5. Update has_role function to use new enum
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

-- ----------------------------------------------------------------------------
-- 6. Update is_admin_or_owner to is_team_admin_or_company_admin
-- Keep old function for backward compatibility during transition
-- ----------------------------------------------------------------------------
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
          AND role = 'team_admin'::public.app_role
    )
    OR EXISTS (
        SELECT 1
        FROM public.company_user_roles
        WHERE user_id = _user_id
          AND role = 'company_admin'
    )
$$;

-- ============================================================================
-- End of Phase 3 Migration
-- ============================================================================
