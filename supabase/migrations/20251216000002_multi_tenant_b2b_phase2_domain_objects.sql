-- ============================================================================
-- Multi-Tenant B2B RLS Migration - Phase 2: Add company_id to Domain Objects
-- ============================================================================
-- This migration adds company_id to all team-scoped domain objects for
-- efficient RLS queries and company-level reporting.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add company_id to evaluations
-- ----------------------------------------------------------------------------
ALTER TABLE public.evaluations
    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX idx_evaluations_company_id ON public.evaluations(company_id);
CREATE INDEX idx_evaluations_company_team ON public.evaluations(company_id, team_id);

-- ----------------------------------------------------------------------------
-- 2. Add company_id to baselines
-- ----------------------------------------------------------------------------
ALTER TABLE public.baselines
    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX idx_baselines_company_id ON public.baselines(company_id);

-- ----------------------------------------------------------------------------
-- 3. Add company_id to llm_configurations
-- ----------------------------------------------------------------------------
ALTER TABLE public.llm_configurations
    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX idx_llm_configurations_company_id ON public.llm_configurations(company_id);

-- ----------------------------------------------------------------------------
-- 4. Add company_id to evaluation_settings
-- ----------------------------------------------------------------------------
ALTER TABLE public.evaluation_settings
    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX idx_evaluation_settings_company_id ON public.evaluation_settings(company_id);

-- ----------------------------------------------------------------------------
-- 5. Add company_id to evidence_collection_configs
-- ----------------------------------------------------------------------------
ALTER TABLE public.evidence_collection_configs
    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX idx_evidence_collection_configs_company_id ON public.evidence_collection_configs(company_id);

-- ----------------------------------------------------------------------------
-- 6. Add company_id to signing_keys
-- ----------------------------------------------------------------------------
ALTER TABLE public.signing_keys
    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX idx_signing_keys_company_id ON public.signing_keys(company_id);

-- ----------------------------------------------------------------------------
-- 7. Add company_id to team_signing_configs
-- ----------------------------------------------------------------------------
ALTER TABLE public.team_signing_configs
    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX idx_team_signing_configs_company_id ON public.team_signing_configs(company_id);

-- ============================================================================
-- End of Phase 2 Migration
-- ============================================================================
