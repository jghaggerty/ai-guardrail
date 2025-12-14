-- Create indexes for evidence collection query performance

-- Index on evidence_collection_configs.team_id for fast lookups by team
CREATE INDEX idx_evidence_collection_configs_team_id ON public.evidence_collection_configs(team_id);

-- Index on evaluations.evidence_reference_id for fast lookups by reference ID
CREATE INDEX idx_evaluations_evidence_reference_id ON public.evaluations(evidence_reference_id);

