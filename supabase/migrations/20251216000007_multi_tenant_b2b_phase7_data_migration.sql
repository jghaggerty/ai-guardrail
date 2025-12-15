-- ============================================================================
-- Multi-Tenant B2B RLS Migration - Phase 7: Data Migration
-- ============================================================================
-- This migration migrates existing data to the new multi-tenant model:
-- 1. Creates companies for existing teams
-- 2. Assigns company_admin roles to former 'owner' users
-- 3. Backfills company_id on all domain objects
-- 4. Updates profiles with active_team_id and company_id
-- ============================================================================

-- Disable audit triggers temporarily during migration
ALTER TABLE public.evaluations DISABLE TRIGGER audit_evaluations;
ALTER TABLE public.baselines DISABLE TRIGGER audit_baselines;
ALTER TABLE public.user_roles DISABLE TRIGGER audit_user_roles;
ALTER TABLE public.company_user_roles DISABLE TRIGGER audit_company_user_roles;
ALTER TABLE public.teams DISABLE TRIGGER audit_teams;
ALTER TABLE public.llm_configurations DISABLE TRIGGER audit_llm_configurations;
ALTER TABLE public.signing_keys DISABLE TRIGGER audit_signing_keys;

-- ----------------------------------------------------------------------------
-- 1. Create companies for existing teams
-- ----------------------------------------------------------------------------
-- Strategy: Each existing team becomes part of a new company
-- Company name is derived from team name
-- If multiple teams share the same "owner" user, they go into the same company

-- First, create companies for teams where the owner has only one team
INSERT INTO public.companies (id, name, created_at)
SELECT
    gen_random_uuid(),
    t.name || ' Company',
    t.created_at
FROM public.teams t
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

-- For this migration, we'll create one company per team
-- (In production, you might want to group teams by owner)
DO $$
DECLARE
    team_rec RECORD;
    new_company_id uuid;
BEGIN
    -- Check if we need to migrate (companies table is empty)
    IF EXISTS (SELECT 1 FROM public.teams WHERE company_id IS NULL) THEN
        FOR team_rec IN SELECT * FROM public.teams WHERE company_id IS NULL LOOP
            -- Create a company for this team
            INSERT INTO public.companies (name, created_at)
            VALUES (team_rec.name || ' Company', team_rec.created_at)
            RETURNING id INTO new_company_id;

            -- Update the team with the company_id
            UPDATE public.teams
            SET company_id = new_company_id
            WHERE id = team_rec.id;
        END LOOP;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Create company_admin roles for former 'owner' users
-- ----------------------------------------------------------------------------
-- Users who had 'owner' role in the old system become company_admin
-- Note: The role column has already been migrated to 'team_admin' in Phase 3
-- We need to identify the original owners and give them company_admin access

-- Find users who were team_admin (formerly owner) and assign company_admin
INSERT INTO public.company_user_roles (user_id, company_id, role, created_by)
SELECT DISTINCT
    ur.user_id,
    t.company_id,
    'company_admin',
    ur.user_id -- They created themselves as admin
FROM public.user_roles ur
JOIN public.teams t ON ur.team_id = t.id
WHERE ur.role = 'team_admin'
  AND t.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.company_user_roles cur
    WHERE cur.user_id = ur.user_id AND cur.company_id = t.company_id
  )
-- Only the first team_admin per company becomes company_admin
-- (based on oldest role creation)
AND ur.created_at = (
    SELECT MIN(ur2.created_at)
    FROM public.user_roles ur2
    JOIN public.teams t2 ON ur2.team_id = t2.id
    WHERE ur2.role = 'team_admin'
      AND t2.company_id = t.company_id
);

-- ----------------------------------------------------------------------------
-- 3. Backfill company_id on all domain objects
-- ----------------------------------------------------------------------------

-- Evaluations
UPDATE public.evaluations e
SET company_id = t.company_id
FROM public.teams t
WHERE e.team_id = t.id
  AND e.company_id IS NULL;

-- Baselines
UPDATE public.baselines b
SET company_id = t.company_id
FROM public.teams t
WHERE b.team_id = t.id
  AND b.company_id IS NULL;

-- LLM Configurations
UPDATE public.llm_configurations l
SET company_id = t.company_id
FROM public.teams t
WHERE l.team_id = t.id
  AND l.company_id IS NULL;

-- Evaluation Settings
UPDATE public.evaluation_settings es
SET company_id = t.company_id
FROM public.teams t
WHERE es.team_id = t.id
  AND es.company_id IS NULL;

-- Evidence Collection Configs
UPDATE public.evidence_collection_configs ec
SET company_id = t.company_id
FROM public.teams t
WHERE ec.team_id = t.id
  AND ec.company_id IS NULL;

-- Signing Keys
UPDATE public.signing_keys sk
SET company_id = t.company_id
FROM public.teams t
WHERE sk.team_id = t.id
  AND sk.company_id IS NULL;

-- Team Signing Configs
UPDATE public.team_signing_configs tsc
SET company_id = t.company_id
FROM public.teams t
WHERE tsc.team_id = t.id
  AND tsc.company_id IS NULL;

-- ----------------------------------------------------------------------------
-- 4. Update profiles with active_team_id and company_id
-- ----------------------------------------------------------------------------

-- Set active_team_id to user's existing team_id (from the old direct link)
-- and set company_id from that team
UPDATE public.profiles p
SET
    active_team_id = COALESCE(p.active_team_id, p.team_id, (
        SELECT ur.team_id
        FROM public.user_roles ur
        WHERE ur.user_id = p.id
        ORDER BY ur.created_at ASC
        LIMIT 1
    )),
    company_id = COALESCE(p.company_id, (
        SELECT t.company_id
        FROM public.teams t
        WHERE t.id = COALESCE(p.team_id, (
            SELECT ur.team_id
            FROM public.user_roles ur
            WHERE ur.user_id = p.id
            ORDER BY ur.created_at ASC
            LIMIT 1
        ))
    ))
WHERE p.active_team_id IS NULL OR p.company_id IS NULL;

-- ----------------------------------------------------------------------------
-- 5. Make company_id NOT NULL on required tables
-- ----------------------------------------------------------------------------
-- Only do this after data migration is complete

-- Teams
DO $$
BEGIN
    -- Check if any teams still have null company_id
    IF NOT EXISTS (SELECT 1 FROM public.teams WHERE company_id IS NULL) THEN
        ALTER TABLE public.teams ALTER COLUMN company_id SET NOT NULL;
    END IF;
END $$;

-- Evaluations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.evaluations WHERE company_id IS NULL) THEN
        ALTER TABLE public.evaluations ALTER COLUMN company_id SET NOT NULL;
    END IF;
EXCEPTION WHEN others THEN
    -- Skip if there are null values
    NULL;
END $$;

-- Baselines
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.baselines WHERE company_id IS NULL) THEN
        ALTER TABLE public.baselines ALTER COLUMN company_id SET NOT NULL;
    END IF;
EXCEPTION WHEN others THEN
    NULL;
END $$;

-- LLM Configurations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.llm_configurations WHERE company_id IS NULL) THEN
        ALTER TABLE public.llm_configurations ALTER COLUMN company_id SET NOT NULL;
    END IF;
EXCEPTION WHEN others THEN
    NULL;
END $$;

-- Evaluation Settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.evaluation_settings WHERE company_id IS NULL) THEN
        ALTER TABLE public.evaluation_settings ALTER COLUMN company_id SET NOT NULL;
    END IF;
EXCEPTION WHEN others THEN
    NULL;
END $$;

-- Evidence Collection Configs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.evidence_collection_configs WHERE company_id IS NULL) THEN
        ALTER TABLE public.evidence_collection_configs ALTER COLUMN company_id SET NOT NULL;
    END IF;
EXCEPTION WHEN others THEN
    NULL;
END $$;

-- Signing Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.signing_keys WHERE company_id IS NULL) THEN
        ALTER TABLE public.signing_keys ALTER COLUMN company_id SET NOT NULL;
    END IF;
EXCEPTION WHEN others THEN
    NULL;
END $$;

-- Team Signing Configs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.team_signing_configs WHERE company_id IS NULL) THEN
        ALTER TABLE public.team_signing_configs ALTER COLUMN company_id SET NOT NULL;
    END IF;
EXCEPTION WHEN others THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Re-enable audit triggers
-- ----------------------------------------------------------------------------
ALTER TABLE public.evaluations ENABLE TRIGGER audit_evaluations;
ALTER TABLE public.baselines ENABLE TRIGGER audit_baselines;
ALTER TABLE public.user_roles ENABLE TRIGGER audit_user_roles;
ALTER TABLE public.company_user_roles ENABLE TRIGGER audit_company_user_roles;
ALTER TABLE public.teams ENABLE TRIGGER audit_teams;
ALTER TABLE public.llm_configurations ENABLE TRIGGER audit_llm_configurations;
ALTER TABLE public.signing_keys ENABLE TRIGGER audit_signing_keys;

-- ----------------------------------------------------------------------------
-- 7. Data validation queries (for manual verification)
-- ----------------------------------------------------------------------------
-- These are SELECT statements that can be run to verify data integrity

-- Check for teams without company
-- SELECT COUNT(*) AS teams_without_company FROM public.teams WHERE company_id IS NULL;

-- Check for evaluations without company
-- SELECT COUNT(*) AS evaluations_without_company FROM public.evaluations WHERE company_id IS NULL;

-- Check for companies without admin
-- SELECT c.id, c.name
-- FROM public.companies c
-- LEFT JOIN public.company_user_roles cur ON c.id = cur.company_id
-- WHERE cur.id IS NULL;

-- Check for profiles without company
-- SELECT COUNT(*) AS profiles_without_company FROM public.profiles WHERE company_id IS NULL;

-- ============================================================================
-- End of Phase 7 Migration
-- ============================================================================
