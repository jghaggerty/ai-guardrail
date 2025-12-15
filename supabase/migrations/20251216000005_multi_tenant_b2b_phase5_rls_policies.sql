-- ============================================================================
-- Multi-Tenant B2B RLS Migration - Phase 5: Updated RLS Policies
-- ============================================================================
-- This migration drops all existing RLS policies and creates new ones
-- that implement the company-level tenant isolation with team-scoped access.
-- ============================================================================

-- ############################################################################
-- SECTION 1: DROP EXISTING POLICIES
-- ############################################################################

-- Companies (new table, no existing policies)

-- Teams
DROP POLICY IF EXISTS "Users can view their team" ON public.teams;
DROP POLICY IF EXISTS "Users can update their team" ON public.teams;

-- Profiles
DROP POLICY IF EXISTS "Users can view team members profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- User Roles
DROP POLICY IF EXISTS "Users can view roles in their team" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their team" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles in their team" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles in their team" ON public.user_roles;

-- Team Invitations
DROP POLICY IF EXISTS "Team members can view their team invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Admins can create team invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Admins can delete team invitations" ON public.team_invitations;

-- Evaluations
DROP POLICY IF EXISTS "Team members can view evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Authenticated users can create evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Owners can update their evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Owners can delete their evaluations" ON public.evaluations;

-- Heuristic Findings
DROP POLICY IF EXISTS "Team members can view heuristic findings" ON public.heuristic_findings;
DROP POLICY IF EXISTS "Evaluation owners can create findings" ON public.heuristic_findings;
DROP POLICY IF EXISTS "Evaluation owners can update findings" ON public.heuristic_findings;
DROP POLICY IF EXISTS "Evaluation owners can delete findings" ON public.heuristic_findings;

-- Recommendations
DROP POLICY IF EXISTS "Team members can view recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Evaluation owners can create recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Evaluation owners can update recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Evaluation owners can delete recommendations" ON public.recommendations;

-- Baselines
DROP POLICY IF EXISTS "Team members can view baselines" ON public.baselines;
DROP POLICY IF EXISTS "Authenticated users can create baselines" ON public.baselines;
DROP POLICY IF EXISTS "Owners can update their baselines" ON public.baselines;
DROP POLICY IF EXISTS "Owners can delete their baselines" ON public.baselines;

-- LLM Configurations
DROP POLICY IF EXISTS "Team members can view LLM configs" ON public.llm_configurations;
DROP POLICY IF EXISTS "Admins can view full LLM configs" ON public.llm_configurations;
DROP POLICY IF EXISTS "Team members can create LLM configs" ON public.llm_configurations;
DROP POLICY IF EXISTS "Team members can update LLM configs" ON public.llm_configurations;
DROP POLICY IF EXISTS "Team members can delete LLM configs" ON public.llm_configurations;

-- Evaluation Settings
DROP POLICY IF EXISTS "Team members can view evaluation settings" ON public.evaluation_settings;
DROP POLICY IF EXISTS "Admins can create evaluation settings" ON public.evaluation_settings;
DROP POLICY IF EXISTS "Admins can update evaluation settings" ON public.evaluation_settings;
DROP POLICY IF EXISTS "Admins can delete evaluation settings" ON public.evaluation_settings;

-- Evidence Collection Configs
DROP POLICY IF EXISTS "Team members can view evidence configs" ON public.evidence_collection_configs;
DROP POLICY IF EXISTS "Team members can create evidence configs" ON public.evidence_collection_configs;
DROP POLICY IF EXISTS "Team members can update evidence configs" ON public.evidence_collection_configs;
DROP POLICY IF EXISTS "Team members can delete evidence configs" ON public.evidence_collection_configs;

-- Evidence References
DROP POLICY IF EXISTS "Team members can view evidence references" ON public.evidence_references;
DROP POLICY IF EXISTS "System can create evidence references" ON public.evidence_references;

-- Evaluation Progress
DROP POLICY IF EXISTS "Team members can view evaluation progress" ON public.evaluation_progress;
DROP POLICY IF EXISTS "System can manage evaluation progress" ON public.evaluation_progress;

-- Signing Keys
DROP POLICY IF EXISTS "Team members can view signing keys" ON public.signing_keys;
DROP POLICY IF EXISTS "Team members can create signing keys" ON public.signing_keys;
DROP POLICY IF EXISTS "Team members can update signing keys" ON public.signing_keys;
DROP POLICY IF EXISTS "Team members can rotate signing keys" ON public.signing_keys;

-- Team Signing Configs
DROP POLICY IF EXISTS "Team members can view signing configs" ON public.team_signing_configs;
DROP POLICY IF EXISTS "Team members can upsert signing configs" ON public.team_signing_configs;
DROP POLICY IF EXISTS "Team members can modify signing configs" ON public.team_signing_configs;

-- ############################################################################
-- SECTION 2: COMPANY POLICIES
-- ############################################################################

-- Company admins can view their company
CREATE POLICY "Company admins can view their company"
ON public.companies FOR SELECT
TO authenticated
USING (
    is_company_admin(auth.uid(), id)
    OR is_company_member(auth.uid(), id)
);

-- Company admins can update their company
CREATE POLICY "Company admins can update their company"
ON public.companies FOR UPDATE
TO authenticated
USING (is_company_admin(auth.uid(), id));

-- ############################################################################
-- SECTION 3: COMPANY USER ROLES POLICIES
-- ############################################################################

-- Company admins can view company roles
CREATE POLICY "Company admins can view company roles"
ON public.company_user_roles FOR SELECT
TO authenticated
USING (is_company_admin(auth.uid(), company_id));

-- Company admins can create company roles
CREATE POLICY "Company admins can create company roles"
ON public.company_user_roles FOR INSERT
TO authenticated
WITH CHECK (is_company_admin(auth.uid(), company_id));

-- Company admins can update company roles
CREATE POLICY "Company admins can update company roles"
ON public.company_user_roles FOR UPDATE
TO authenticated
USING (is_company_admin(auth.uid(), company_id));

-- Company admins can delete company roles
CREATE POLICY "Company admins can delete company roles"
ON public.company_user_roles FOR DELETE
TO authenticated
USING (is_company_admin(auth.uid(), company_id));

-- ############################################################################
-- SECTION 4: TEAMS POLICIES
-- ############################################################################

-- Users can view teams in their company
CREATE POLICY "Users can view teams in their company"
ON public.teams FOR SELECT
TO authenticated
USING (
    company_id = get_user_company_id(auth.uid())
    AND deleted_at IS NULL
);

-- Company admins and team admins can create teams
CREATE POLICY "Admins can create teams"
ON public.teams FOR INSERT
TO authenticated
WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND (
        is_company_admin(auth.uid(), company_id)
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.teams t ON ur.team_id = t.id
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'team_admin'
              AND t.company_id = teams.company_id
        )
    )
);

-- Company admins can update any team, team admins can update own team
CREATE POLICY "Admins can update teams"
ON public.teams FOR UPDATE
TO authenticated
USING (
    company_id = get_user_company_id(auth.uid())
    AND (
        is_company_admin(auth.uid(), company_id)
        OR can_admin_team(auth.uid(), id)
    )
);

-- Company admins can delete any team, team admins can delete own team
CREATE POLICY "Admins can delete teams"
ON public.teams FOR DELETE
TO authenticated
USING (
    company_id = get_user_company_id(auth.uid())
    AND (
        is_company_admin(auth.uid(), company_id)
        OR can_admin_team(auth.uid(), id)
    )
);

-- ############################################################################
-- SECTION 5: PROFILES POLICIES
-- ############################################################################

-- Users can view profiles of users in their company
CREATE POLICY "Users can view company profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
    company_id = get_user_company_id(auth.uid())
    OR id = auth.uid()
);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- ############################################################################
-- SECTION 6: USER ROLES POLICIES
-- ############################################################################

-- Users can view roles in their teams or company admins can view all
CREATE POLICY "Users can view team roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
    is_team_member(auth.uid(), team_id)
    OR is_company_admin(auth.uid(), get_team_company_id(team_id))
);

-- Company admins and team admins can assign roles
CREATE POLICY "Admins can create roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (can_admin_team(auth.uid(), team_id));

-- Company admins and team admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- Company admins and team admins can remove roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- ############################################################################
-- SECTION 7: TEAM INVITATIONS POLICIES
-- ############################################################################

-- Team members can view their team's invitations
CREATE POLICY "Team members can view invitations"
ON public.team_invitations FOR SELECT
TO authenticated
USING (can_access_team(auth.uid(), team_id));

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
ON public.team_invitations FOR INSERT
TO authenticated
WITH CHECK (
    can_admin_team(auth.uid(), team_id)
    OR
    -- Allow during initial setup when no roles exist yet
    NOT EXISTS (SELECT 1 FROM public.user_roles WHERE team_id = team_invitations.team_id)
);

-- Admins can delete invitations
CREATE POLICY "Admins can delete invitations"
ON public.team_invitations FOR DELETE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- ############################################################################
-- SECTION 8: EVALUATIONS POLICIES
-- ############################################################################

-- Users can view evaluations in their teams, company admins can view all
CREATE POLICY "Users can view evaluations"
ON public.evaluations FOR SELECT
TO authenticated
USING (
    is_company_admin(auth.uid(), company_id)
    OR is_team_member(auth.uid(), team_id)
);

-- Team members can create evaluations in their active team
CREATE POLICY "Team members can create evaluations"
ON public.evaluations FOR INSERT
TO authenticated
WITH CHECK (
    team_id = get_user_active_team_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND user_id = auth.uid()
    AND can_write_to_team(auth.uid(), team_id)
);

-- Team members can update soft metadata, team admins can update all
CREATE POLICY "Users can update evaluations"
ON public.evaluations FOR UPDATE
TO authenticated
USING (
    can_write_to_team(auth.uid(), team_id)
    OR is_company_admin(auth.uid(), company_id)
);
-- Note: Soft metadata restriction (notes, tags, title only for team_member)
-- should be enforced at the application layer or via column-level security

-- Team admins and company admins can delete evaluations
CREATE POLICY "Admins can delete evaluations"
ON public.evaluations FOR DELETE
TO authenticated
USING (
    is_company_admin(auth.uid(), company_id)
    OR can_admin_team(auth.uid(), team_id)
);

-- ############################################################################
-- SECTION 9: HEURISTIC FINDINGS POLICIES
-- ############################################################################

-- Users can view findings for evaluations in their teams
CREATE POLICY "Users can view findings"
ON public.heuristic_findings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND (
            is_company_admin(auth.uid(), e.company_id)
            OR is_team_member(auth.uid(), e.team_id)
        )
    )
);

-- Team members can create findings for their evaluations
CREATE POLICY "Team members can create findings"
ON public.heuristic_findings FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND can_write_to_team(auth.uid(), e.team_id)
    )
);

-- Team members can update findings
CREATE POLICY "Team members can update findings"
ON public.heuristic_findings FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND can_write_to_team(auth.uid(), e.team_id)
    )
);

-- Team admins can delete findings
CREATE POLICY "Admins can delete findings"
ON public.heuristic_findings FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND (
            is_company_admin(auth.uid(), e.company_id)
            OR can_admin_team(auth.uid(), e.team_id)
        )
    )
);

-- ############################################################################
-- SECTION 10: RECOMMENDATIONS POLICIES
-- ############################################################################

-- Users can view recommendations for evaluations in their teams
CREATE POLICY "Users can view recommendations"
ON public.recommendations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND (
            is_company_admin(auth.uid(), e.company_id)
            OR is_team_member(auth.uid(), e.team_id)
        )
    )
);

-- Team members can create recommendations
CREATE POLICY "Team members can create recommendations"
ON public.recommendations FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND can_write_to_team(auth.uid(), e.team_id)
    )
);

-- Team members can update recommendations
CREATE POLICY "Team members can update recommendations"
ON public.recommendations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND can_write_to_team(auth.uid(), e.team_id)
    )
);

-- Team admins can delete recommendations
CREATE POLICY "Admins can delete recommendations"
ON public.recommendations FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND (
            is_company_admin(auth.uid(), e.company_id)
            OR can_admin_team(auth.uid(), e.team_id)
        )
    )
);

-- ############################################################################
-- SECTION 11: BASELINES POLICIES
-- ############################################################################

-- Users can view baselines in their teams
CREATE POLICY "Users can view baselines"
ON public.baselines FOR SELECT
TO authenticated
USING (
    is_company_admin(auth.uid(), company_id)
    OR is_team_member(auth.uid(), team_id)
);

-- Team members can create baselines
CREATE POLICY "Team members can create baselines"
ON public.baselines FOR INSERT
TO authenticated
WITH CHECK (
    team_id = get_user_active_team_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND user_id = auth.uid()
    AND can_write_to_team(auth.uid(), team_id)
);

-- Team members can update baselines
CREATE POLICY "Team members can update baselines"
ON public.baselines FOR UPDATE
TO authenticated
USING (can_write_to_team(auth.uid(), team_id));

-- Team admins can delete baselines
CREATE POLICY "Admins can delete baselines"
ON public.baselines FOR DELETE
TO authenticated
USING (
    is_company_admin(auth.uid(), company_id)
    OR can_admin_team(auth.uid(), team_id)
);

-- ############################################################################
-- SECTION 12: LLM CONFIGURATIONS POLICIES
-- ############################################################################

-- Admins can view full LLM configs (including encrypted keys)
CREATE POLICY "Admins can view LLM configs"
ON public.llm_configurations FOR SELECT
TO authenticated
USING (
    (is_company_admin(auth.uid(), company_id) OR can_admin_team(auth.uid(), team_id))
);

-- Team members can create LLM configs
CREATE POLICY "Team members can create LLM configs"
ON public.llm_configurations FOR INSERT
TO authenticated
WITH CHECK (
    team_id = get_user_active_team_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND can_write_to_team(auth.uid(), team_id)
);

-- Team members can update LLM configs
CREATE POLICY "Team members can update LLM configs"
ON public.llm_configurations FOR UPDATE
TO authenticated
USING (can_write_to_team(auth.uid(), team_id));

-- Team admins can delete LLM configs
CREATE POLICY "Admins can delete LLM configs"
ON public.llm_configurations FOR DELETE
TO authenticated
USING (
    is_company_admin(auth.uid(), company_id)
    OR can_admin_team(auth.uid(), team_id)
);

-- ############################################################################
-- SECTION 13: EVALUATION SETTINGS POLICIES
-- ############################################################################

-- Team members can view evaluation settings
CREATE POLICY "Users can view evaluation settings"
ON public.evaluation_settings FOR SELECT
TO authenticated
USING (
    is_company_admin(auth.uid(), company_id)
    OR is_team_member(auth.uid(), team_id)
);

-- Team admins can create evaluation settings
CREATE POLICY "Admins can create evaluation settings"
ON public.evaluation_settings FOR INSERT
TO authenticated
WITH CHECK (
    team_id = get_user_active_team_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND can_admin_team(auth.uid(), team_id)
);

-- Team admins can update evaluation settings
CREATE POLICY "Admins can update evaluation settings"
ON public.evaluation_settings FOR UPDATE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- Team admins can delete evaluation settings
CREATE POLICY "Admins can delete evaluation settings"
ON public.evaluation_settings FOR DELETE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- ############################################################################
-- SECTION 14: EVIDENCE COLLECTION CONFIGS POLICIES
-- ############################################################################

-- Team members can view evidence configs
CREATE POLICY "Users can view evidence configs"
ON public.evidence_collection_configs FOR SELECT
TO authenticated
USING (
    is_company_admin(auth.uid(), company_id)
    OR is_team_member(auth.uid(), team_id)
);

-- Team admins can create evidence configs
CREATE POLICY "Admins can create evidence configs"
ON public.evidence_collection_configs FOR INSERT
TO authenticated
WITH CHECK (
    team_id = get_user_active_team_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND can_admin_team(auth.uid(), team_id)
);

-- Team admins can update evidence configs
CREATE POLICY "Admins can update evidence configs"
ON public.evidence_collection_configs FOR UPDATE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- Team admins can delete evidence configs
CREATE POLICY "Admins can delete evidence configs"
ON public.evidence_collection_configs FOR DELETE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- ############################################################################
-- SECTION 15: EVIDENCE REFERENCES POLICIES
-- ############################################################################

-- Users can view evidence references for evaluations in their teams
CREATE POLICY "Users can view evidence references"
ON public.evidence_references FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND (
            is_company_admin(auth.uid(), e.company_id)
            OR is_team_member(auth.uid(), e.team_id)
        )
    )
);

-- System (via service role) creates evidence references
-- No INSERT policy for authenticated users - handled by edge functions

-- Team admins can delete evidence references
CREATE POLICY "Admins can delete evidence references"
ON public.evidence_references FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND (
            is_company_admin(auth.uid(), e.company_id)
            OR can_admin_team(auth.uid(), e.team_id)
        )
    )
);

-- ############################################################################
-- SECTION 16: EVALUATION PROGRESS POLICIES
-- ############################################################################

-- Users can view progress for evaluations in their teams
CREATE POLICY "Users can view evaluation progress"
ON public.evaluation_progress FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.evaluations e
        WHERE e.id = evaluation_id
        AND (
            is_company_admin(auth.uid(), e.company_id)
            OR is_team_member(auth.uid(), e.team_id)
        )
    )
);

-- System (via service role) manages evaluation progress
-- No INSERT/UPDATE/DELETE policies for authenticated users

-- ############################################################################
-- SECTION 17: SIGNING KEYS POLICIES
-- ############################################################################

-- Team members can view signing keys
CREATE POLICY "Users can view signing keys"
ON public.signing_keys FOR SELECT
TO authenticated
USING (
    is_company_admin(auth.uid(), company_id)
    OR is_team_member(auth.uid(), team_id)
);

-- Team admins can create signing keys
CREATE POLICY "Admins can create signing keys"
ON public.signing_keys FOR INSERT
TO authenticated
WITH CHECK (
    team_id = get_user_active_team_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND can_admin_team(auth.uid(), team_id)
);

-- Team admins can update signing keys
CREATE POLICY "Admins can update signing keys"
ON public.signing_keys FOR UPDATE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- Team admins can delete signing keys
CREATE POLICY "Admins can delete signing keys"
ON public.signing_keys FOR DELETE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- ############################################################################
-- SECTION 18: TEAM SIGNING CONFIGS POLICIES
-- ############################################################################

-- Team members can view signing configs
CREATE POLICY "Users can view signing configs"
ON public.team_signing_configs FOR SELECT
TO authenticated
USING (
    is_company_admin(auth.uid(), company_id)
    OR is_team_member(auth.uid(), team_id)
);

-- Team admins can create signing configs
CREATE POLICY "Admins can create signing configs"
ON public.team_signing_configs FOR INSERT
TO authenticated
WITH CHECK (
    team_id = get_user_active_team_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND can_admin_team(auth.uid(), team_id)
);

-- Team admins can update signing configs
CREATE POLICY "Admins can update signing configs"
ON public.team_signing_configs FOR UPDATE
TO authenticated
USING (can_admin_team(auth.uid(), team_id));

-- ############################################################################
-- SECTION 19: UPDATE LLM CONFIGURATIONS SAFE VIEW
-- ############################################################################

-- Update the safe view to include company_id
DROP VIEW IF EXISTS public.llm_configurations_safe;

CREATE OR REPLACE VIEW public.llm_configurations_safe AS
SELECT
    id,
    team_id,
    company_id,
    user_id,
    provider,
    model_name,
    model_version,
    display_name,
    base_url,
    environment,
    is_connected,
    last_tested_at,
    created_at,
    updated_at
FROM public.llm_configurations;

-- Grant access to authenticated users (view is filtered by underlying RLS)
GRANT SELECT ON public.llm_configurations_safe TO authenticated;

-- ============================================================================
-- End of Phase 5 Migration
-- ============================================================================
