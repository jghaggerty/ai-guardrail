-- Create teams table for multi-tenant B2B
CREATE TABLE public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create profiles table linking users to teams
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    full_name text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add team_id and user_id columns to existing tables
ALTER TABLE public.evaluations 
    ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.baselines 
    ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create function to get user's team_id (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT team_id FROM public.profiles WHERE id = _user_id
$$;

-- Create function to check if user owns a row
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT _user_id = auth.uid()
$$;

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
    RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Drop existing public policies on evaluations
DROP POLICY IF EXISTS "Allow public read access on evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow public insert on evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow public update on evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow public delete on evaluations" ON public.evaluations;

-- Drop existing public policies on heuristic_findings
DROP POLICY IF EXISTS "Allow public read access on heuristic_findings" ON public.heuristic_findings;
DROP POLICY IF EXISTS "Allow public insert on heuristic_findings" ON public.heuristic_findings;
DROP POLICY IF EXISTS "Allow public update on heuristic_findings" ON public.heuristic_findings;
DROP POLICY IF EXISTS "Allow public delete on heuristic_findings" ON public.heuristic_findings;

-- Drop existing public policies on recommendations
DROP POLICY IF EXISTS "Allow public read access on recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Allow public insert on recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Allow public update on recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Allow public delete on recommendations" ON public.recommendations;

-- Drop existing public policies on baselines
DROP POLICY IF EXISTS "Allow public read access on baselines" ON public.baselines;
DROP POLICY IF EXISTS "Allow public insert on baselines" ON public.baselines;
DROP POLICY IF EXISTS "Allow public update on baselines" ON public.baselines;
DROP POLICY IF EXISTS "Allow public delete on baselines" ON public.baselines;

-- Teams policies: users can view their own team
CREATE POLICY "Users can view their team"
    ON public.teams FOR SELECT TO authenticated
    USING (id = public.get_user_team_id(auth.uid()));

-- Profiles policies
CREATE POLICY "Users can view team members profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (team_id = public.get_user_team_id(auth.uid()) OR id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Evaluations: team can read all, owner can modify
CREATE POLICY "Team members can view evaluations"
    ON public.evaluations FOR SELECT TO authenticated
    USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Authenticated users can create evaluations"
    ON public.evaluations FOR INSERT TO authenticated
    WITH CHECK (
        team_id = public.get_user_team_id(auth.uid()) 
        AND user_id = auth.uid()
    );

CREATE POLICY "Owners can update their evaluations"
    ON public.evaluations FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Owners can delete their evaluations"
    ON public.evaluations FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Heuristic findings: inherit access from parent evaluation
CREATE POLICY "Team members can view heuristic findings"
    ON public.heuristic_findings FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.evaluations e 
            WHERE e.id = evaluation_id 
            AND e.team_id = public.get_user_team_id(auth.uid())
        )
    );

CREATE POLICY "Evaluation owners can create findings"
    ON public.heuristic_findings FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.evaluations e 
            WHERE e.id = evaluation_id 
            AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "Evaluation owners can update findings"
    ON public.heuristic_findings FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.evaluations e 
            WHERE e.id = evaluation_id 
            AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "Evaluation owners can delete findings"
    ON public.heuristic_findings FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.evaluations e 
            WHERE e.id = evaluation_id 
            AND e.user_id = auth.uid()
        )
    );

-- Recommendations: inherit access from parent evaluation
CREATE POLICY "Team members can view recommendations"
    ON public.recommendations FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.evaluations e 
            WHERE e.id = evaluation_id 
            AND e.team_id = public.get_user_team_id(auth.uid())
        )
    );

CREATE POLICY "Evaluation owners can create recommendations"
    ON public.recommendations FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.evaluations e 
            WHERE e.id = evaluation_id 
            AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "Evaluation owners can update recommendations"
    ON public.recommendations FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.evaluations e 
            WHERE e.id = evaluation_id 
            AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "Evaluation owners can delete recommendations"
    ON public.recommendations FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.evaluations e 
            WHERE e.id = evaluation_id 
            AND e.user_id = auth.uid()
        )
    );

-- Baselines: team can read all, owner can modify
CREATE POLICY "Team members can view baselines"
    ON public.baselines FOR SELECT TO authenticated
    USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Authenticated users can create baselines"
    ON public.baselines FOR INSERT TO authenticated
    WITH CHECK (
        team_id = public.get_user_team_id(auth.uid()) 
        AND user_id = auth.uid()
    );

CREATE POLICY "Owners can update their baselines"
    ON public.baselines FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Owners can delete their baselines"
    ON public.baselines FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX idx_evaluations_team_id ON public.evaluations(team_id);
CREATE INDEX idx_evaluations_user_id ON public.evaluations(user_id);
CREATE INDEX idx_baselines_team_id ON public.baselines(team_id);
CREATE INDEX idx_baselines_user_id ON public.baselines(user_id);