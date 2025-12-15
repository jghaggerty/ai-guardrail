-- ============================================================================
-- Multi-Tenant B2B RLS Migration - Phase 1: Companies Infrastructure
-- ============================================================================
-- This migration creates the foundation for company-level tenant isolation.
-- Companies are the hard security boundary, with teams nested within.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create companies table
-- ----------------------------------------------------------------------------
CREATE TABLE public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE, -- Optional: for company-specific subdomains
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone -- Soft delete
);

-- Create index for slug lookups (excluding soft-deleted)
CREATE INDEX idx_companies_slug ON public.companies(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_deleted_at ON public.companies(id) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Create company_user_roles table (company-level admin roles)
-- ----------------------------------------------------------------------------
CREATE TABLE public.company_user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL DEFAULT 'company_admin' CHECK (role = 'company_admin'),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE (user_id, company_id)
);

-- Create indexes for lookups
CREATE INDEX idx_company_user_roles_company_id ON public.company_user_roles(company_id);
CREATE INDEX idx_company_user_roles_user_id ON public.company_user_roles(user_id);

-- Enable RLS
ALTER TABLE public.company_user_roles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. Add company_id to teams table
-- ----------------------------------------------------------------------------
ALTER TABLE public.teams
    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    ADD COLUMN description text,
    ADD COLUMN deleted_at timestamp with time zone;

-- Create indexes for teams
CREATE INDEX idx_teams_company_id ON public.teams(company_id);
CREATE INDEX idx_teams_company_id_not_deleted ON public.teams(company_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4. Add company_id and active_team_id to profiles
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    ADD COLUMN active_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Create indexes for profiles
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_profiles_active_team_id ON public.profiles(active_team_id);

-- ----------------------------------------------------------------------------
-- 5. Add soft metadata columns to evaluations
-- ----------------------------------------------------------------------------
ALTER TABLE public.evaluations
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS tags text[],
    ADD COLUMN IF NOT EXISTS title text;

-- Comment: title can default to ai_system_name if not set

-- ============================================================================
-- End of Phase 1 Migration
-- ============================================================================
