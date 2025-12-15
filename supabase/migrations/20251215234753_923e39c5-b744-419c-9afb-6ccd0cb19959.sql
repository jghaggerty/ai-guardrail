-- ============================================================================
-- PHASE 1: MULTI-TENANT B2B DATABASE SCHEMA
-- ============================================================================
-- This migration implements company-level multi-tenancy on top of the existing
-- team-based structure, following the PRD for multi-tenant RLS.

-- ============================================================================
-- Step 1: Create companies table
-- ============================================================================
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  billing_email text,
  billing_contact_name text,
  industry text[],
  company_size text,
  headquarters_country text,
  headquarters_state text,
  dpa_accepted_at timestamp with time zone,
  dpa_version text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 2: Add company_id to teams table
-- ============================================================================
ALTER TABLE public.teams ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- ============================================================================
-- Step 3: Create company_user_roles table for Company Admin role
-- ============================================================================
CREATE TABLE public.company_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'company_admin' CHECK (role = 'company_admin'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

-- Enable RLS on company_user_roles
ALTER TABLE public.company_user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 4: Add active_team_id to profiles for team switching
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN active_team_id uuid REFERENCES public.teams(id);

-- ============================================================================
-- Step 5: Create helper functions for multi-tenant RLS
-- ============================================================================

-- Get user's company ID (from their team membership)
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.company_id 
  FROM public.teams t
  JOIN public.profiles p ON p.team_id = t.id
  WHERE p.id = _user_id
  LIMIT 1
$$;

-- Check if user is a company admin
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

-- Check if user is a member of a company (through any team)
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
    JOIN public.teams t ON t.id = ur.team_id
    WHERE ur.user_id = _user_id
      AND t.company_id = _company_id
  )
$$;

-- Get user's active team ID (for team switching)
CREATE OR REPLACE FUNCTION public.get_user_active_team_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT active_team_id FROM public.profiles WHERE id = _user_id),
    (SELECT team_id FROM public.profiles WHERE id = _user_id)
  )
$$;

-- Get all team IDs a user belongs to
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.user_roles WHERE user_id = _user_id
$$;

-- ============================================================================
-- Step 6: RLS Policies for companies table
-- ============================================================================

-- Company admins can view their company
CREATE POLICY "Company admins can view their company"
ON public.companies
FOR SELECT
USING (
  is_company_admin(auth.uid(), id) OR is_company_member(auth.uid(), id)
);

-- Company admins can update their company
CREATE POLICY "Company admins can update their company"
ON public.companies
FOR UPDATE
USING (is_company_admin(auth.uid(), id))
WITH CHECK (is_company_admin(auth.uid(), id));

-- ============================================================================
-- Step 7: RLS Policies for company_user_roles table
-- ============================================================================

-- Company members can view company roles
CREATE POLICY "Company members can view company roles"
ON public.company_user_roles
FOR SELECT
USING (is_company_member(auth.uid(), company_id));

-- Company admins can manage company roles
CREATE POLICY "Company admins can manage company roles"
ON public.company_user_roles
FOR INSERT
WITH CHECK (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Company admins can update company roles"
ON public.company_user_roles
FOR UPDATE
USING (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Company admins can delete company roles"
ON public.company_user_roles
FOR DELETE
USING (is_company_admin(auth.uid(), company_id));

-- ============================================================================
-- Step 8: Update teams RLS to include company boundaries
-- ============================================================================

-- Drop existing teams policies
DROP POLICY IF EXISTS "Users can view their team" ON public.teams;
DROP POLICY IF EXISTS "Team members can update their team" ON public.teams;

-- New policies with company admin override
CREATE POLICY "Users can view teams in their company"
ON public.teams
FOR SELECT
USING (
  id = get_user_team_id(auth.uid()) 
  OR is_company_admin(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.team_id = id)
);

CREATE POLICY "Company admins can create teams"
ON public.teams
FOR INSERT
WITH CHECK (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Team admins can update their team"
ON public.teams
FOR UPDATE
USING (
  (id = get_user_team_id(auth.uid()) AND is_admin_or_owner(auth.uid()))
  OR is_company_admin(auth.uid(), company_id)
);

CREATE POLICY "Company admins can delete teams"
ON public.teams
FOR DELETE
USING (is_company_admin(auth.uid(), company_id));

-- ============================================================================
-- Step 9: Data Migration - Create companies for existing teams
-- ============================================================================

-- Create a company for each existing team that doesn't have one
INSERT INTO public.companies (id, name, billing_email, billing_contact_name, industry, company_size, headquarters_country, headquarters_state, dpa_accepted_at, dpa_version)
SELECT 
  gen_random_uuid(),
  t.name,
  t.billing_email,
  t.billing_contact_name,
  t.industry,
  t.company_size,
  t.headquarters_country,
  t.headquarters_state,
  t.dpa_accepted_at,
  t.dpa_version
FROM public.teams t
WHERE t.company_id IS NULL;

-- Update teams to point to their newly created company
UPDATE public.teams t
SET company_id = (
  SELECT c.id 
  FROM public.companies c 
  WHERE c.name = t.name 
    AND c.created_at >= t.created_at - interval '1 minute'
  LIMIT 1
)
WHERE t.company_id IS NULL;

-- ============================================================================
-- Step 10: Grant company_admin role to existing team owners
-- ============================================================================

INSERT INTO public.company_user_roles (user_id, company_id, role)
SELECT DISTINCT ur.user_id, t.company_id, 'company_admin'
FROM public.user_roles ur
JOIN public.teams t ON t.id = ur.team_id
WHERE ur.role = 'owner'
  AND t.company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- ============================================================================
-- Step 11: Update handle_new_user function to create company on signup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_company_id uuid;
    new_team_id uuid;
BEGIN
    -- Create a company for the new user
    INSERT INTO public.companies (name)
    VALUES (COALESCE(new.raw_user_meta_data ->> 'full_name', 'Personal') || '''s Company')
    RETURNING id INTO new_company_id;

    -- Create a personal team under the company
    INSERT INTO public.teams (name, company_id)
    VALUES (COALESCE(new.raw_user_meta_data ->> 'full_name', 'Personal Team'), new_company_id)
    RETURNING id INTO new_team_id;

    -- Create the profile with the team assignment
    INSERT INTO public.profiles (id, full_name, team_id)
    VALUES (new.id, new.raw_user_meta_data ->> 'full_name', new_team_id);

    -- Assign owner role to the new user for the team
    INSERT INTO public.user_roles (user_id, team_id, role)
    VALUES (new.id, new_team_id, 'owner');

    -- Assign company_admin role to the new user
    INSERT INTO public.company_user_roles (user_id, company_id, role)
    VALUES (new.id, new_company_id, 'company_admin');

    RETURN new;
END;
$$;

-- ============================================================================
-- Step 12: Create trigger for updated_at on companies
-- ============================================================================

CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_evaluation_progress_timestamp();