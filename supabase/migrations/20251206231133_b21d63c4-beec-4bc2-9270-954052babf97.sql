-- Create enum types
CREATE TYPE evaluation_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE zone_status AS ENUM ('green', 'yellow', 'red');
CREATE TYPE heuristic_type AS ENUM ('anchoring', 'loss_aversion', 'sunk_cost', 'confirmation_bias', 'availability_heuristic');
CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE impact_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE difficulty_level AS ENUM ('easy', 'moderate', 'complex');

-- Create evaluations table
CREATE TABLE public.evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ai_system_name TEXT NOT NULL,
  heuristic_types JSONB NOT NULL,
  iteration_count INTEGER NOT NULL,
  status evaluation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  overall_score DOUBLE PRECISION,
  zone_status zone_status
);

-- Create heuristic_findings table
CREATE TABLE public.heuristic_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  heuristic_type heuristic_type NOT NULL,
  severity severity_level NOT NULL,
  severity_score DOUBLE PRECISION NOT NULL,
  confidence_level DOUBLE PRECISION NOT NULL,
  detection_count INTEGER NOT NULL,
  example_instances JSONB NOT NULL,
  pattern_description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create baselines table
CREATE TABLE public.baselines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  green_zone_max DOUBLE PRECISION NOT NULL,
  yellow_zone_max DOUBLE PRECISION NOT NULL,
  statistical_params JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recommendations table
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  heuristic_type TEXT NOT NULL,
  priority INTEGER NOT NULL,
  action_title TEXT NOT NULL,
  technical_description TEXT NOT NULL,
  simplified_description TEXT NOT NULL,
  estimated_impact impact_level NOT NULL,
  implementation_difficulty difficulty_level NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_heuristic_findings_evaluation_id ON public.heuristic_findings(evaluation_id);
CREATE INDEX idx_recommendations_evaluation_id ON public.recommendations(evaluation_id);
CREATE INDEX idx_evaluations_status ON public.evaluations(status);
CREATE INDEX idx_evaluations_ai_system ON public.evaluations(ai_system_name);

-- Enable Row Level Security (public access for now - no auth required)
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heuristic_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a diagnostic tool)
CREATE POLICY "Allow public read access on evaluations" ON public.evaluations FOR SELECT USING (true);
CREATE POLICY "Allow public insert on evaluations" ON public.evaluations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on evaluations" ON public.evaluations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on evaluations" ON public.evaluations FOR DELETE USING (true);

CREATE POLICY "Allow public read access on heuristic_findings" ON public.heuristic_findings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on heuristic_findings" ON public.heuristic_findings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on heuristic_findings" ON public.heuristic_findings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on heuristic_findings" ON public.heuristic_findings FOR DELETE USING (true);

CREATE POLICY "Allow public read access on baselines" ON public.baselines FOR SELECT USING (true);
CREATE POLICY "Allow public insert on baselines" ON public.baselines FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on baselines" ON public.baselines FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on baselines" ON public.baselines FOR DELETE USING (true);

CREATE POLICY "Allow public read access on recommendations" ON public.recommendations FOR SELECT USING (true);
CREATE POLICY "Allow public insert on recommendations" ON public.recommendations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on recommendations" ON public.recommendations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on recommendations" ON public.recommendations FOR DELETE USING (true);