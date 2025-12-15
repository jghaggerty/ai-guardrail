-- ============================================================================
-- Multi-Tenant B2B RLS Migration - Phase 6: Audit Logs
-- ============================================================================
-- This migration creates the audit_logs table for compliance tracking.
-- All CREATE, UPDATE, DELETE operations on domain objects are logged.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create audit_logs table
-- ----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    action text NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'READ')),
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX idx_audit_logs_team_id ON public.audit_logs(team_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Composite index for common query patterns
CREATE INDEX idx_audit_logs_company_created ON public.audit_logs(company_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. RLS Policies for audit_logs
-- ----------------------------------------------------------------------------

-- Only company admins can view audit logs for their company
CREATE POLICY "Company admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (is_company_admin(auth.uid(), company_id));

-- Audit logs are append-only - no INSERT policy for regular users
-- Inserts happen via triggers with SECURITY DEFINER

-- No UPDATE or DELETE allowed on audit logs (append-only)

-- ----------------------------------------------------------------------------
-- 3. Function to log audit entries
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_entry(
    _company_id uuid,
    _team_id uuid,
    _user_id uuid,
    _action text,
    _table_name text,
    _record_id uuid,
    _old_values jsonb DEFAULT NULL,
    _new_values jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _audit_id uuid;
BEGIN
    INSERT INTO public.audit_logs (
        company_id,
        team_id,
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
    )
    VALUES (
        _company_id,
        _team_id,
        _user_id,
        _action,
        _table_name,
        _record_id,
        _old_values,
        _new_values
    )
    RETURNING id INTO _audit_id;

    RETURN _audit_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Generic audit trigger function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _company_id uuid;
    _team_id uuid;
    _record_id uuid;
    _old_values jsonb;
    _new_values jsonb;
BEGIN
    -- Get the record ID
    IF TG_OP = 'DELETE' THEN
        _record_id := OLD.id;
    ELSE
        _record_id := NEW.id;
    END IF;

    -- Get company_id and team_id from the record if available
    IF TG_OP = 'DELETE' THEN
        _company_id := CASE WHEN TG_TABLE_NAME = 'companies' THEN OLD.id
                           ELSE OLD.company_id END;
        _team_id := CASE WHEN TG_TABLE_NAME IN ('companies', 'teams') THEN NULL
                        ELSE OLD.team_id END;
    ELSE
        _company_id := CASE WHEN TG_TABLE_NAME = 'companies' THEN NEW.id
                           ELSE NEW.company_id END;
        _team_id := CASE WHEN TG_TABLE_NAME IN ('companies', 'teams') THEN NULL
                        ELSE NEW.team_id END;
    END IF;

    -- Set old/new values based on operation
    CASE TG_OP
        WHEN 'INSERT' THEN
            _old_values := NULL;
            _new_values := to_jsonb(NEW);
        WHEN 'UPDATE' THEN
            _old_values := to_jsonb(OLD);
            _new_values := to_jsonb(NEW);
        WHEN 'DELETE' THEN
            _old_values := to_jsonb(OLD);
            _new_values := NULL;
    END CASE;

    -- Insert the audit log entry
    -- Skip if company_id is null (shouldn't happen, but be safe)
    IF _company_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (
            company_id,
            team_id,
            user_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values
        )
        VALUES (
            _company_id,
            _team_id,
            auth.uid(),
            TG_OP,
            TG_TABLE_NAME,
            _record_id,
            _old_values,
            _new_values
        );
    END IF;

    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Create audit triggers for key tables
-- Note: Triggers will be created after data migration to avoid logging
-- migration data. This section is commented out and should be enabled
-- after migration is complete.
-- ----------------------------------------------------------------------------

-- Evaluations audit trigger
CREATE TRIGGER audit_evaluations
    AFTER INSERT OR UPDATE OR DELETE ON public.evaluations
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Baselines audit trigger
CREATE TRIGGER audit_baselines
    AFTER INSERT OR UPDATE OR DELETE ON public.baselines
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- User roles audit trigger
CREATE TRIGGER audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Company user roles audit trigger
CREATE TRIGGER audit_company_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON public.company_user_roles
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Teams audit trigger (special handling - company_id is on teams table)
CREATE OR REPLACE FUNCTION public.audit_teams_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _record_id uuid;
    _company_id uuid;
    _old_values jsonb;
    _new_values jsonb;
BEGIN
    -- Get the record ID and company_id
    IF TG_OP = 'DELETE' THEN
        _record_id := OLD.id;
        _company_id := OLD.company_id;
        _old_values := to_jsonb(OLD);
        _new_values := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        _record_id := NEW.id;
        _company_id := NEW.company_id;
        _old_values := NULL;
        _new_values := to_jsonb(NEW);
    ELSE -- UPDATE
        _record_id := NEW.id;
        _company_id := NEW.company_id;
        _old_values := to_jsonb(OLD);
        _new_values := to_jsonb(NEW);
    END IF;

    -- Insert the audit log entry
    IF _company_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (
            company_id,
            team_id,
            user_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values
        )
        VALUES (
            _company_id,
            _record_id, -- team_id is the record itself
            auth.uid(),
            TG_OP,
            'teams',
            _record_id,
            _old_values,
            _new_values
        );
    END IF;

    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

CREATE TRIGGER audit_teams
    AFTER INSERT OR UPDATE OR DELETE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.audit_teams_trigger_function();

-- LLM configurations audit trigger
CREATE TRIGGER audit_llm_configurations
    AFTER INSERT OR UPDATE OR DELETE ON public.llm_configurations
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Signing keys audit trigger
CREATE TRIGGER audit_signing_keys
    AFTER INSERT OR UPDATE OR DELETE ON public.signing_keys
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- ============================================================================
-- End of Phase 6 Migration
-- ============================================================================
