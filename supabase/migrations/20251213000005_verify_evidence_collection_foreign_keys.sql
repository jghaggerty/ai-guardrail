-- Verify and document foreign key constraints for evidence collection tables
-- All foreign keys should have appropriate cascade delete rules

-- Verify evidence_collection_configs.team_id foreign key
-- This constraint is already defined in the table creation:
-- team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL
-- When a team is deleted, all evidence collection configs for that team are automatically deleted

-- Verify evidence_references.evaluation_id foreign key  
-- This constraint is already defined in the table creation:
-- evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE
-- When an evaluation is deleted, all evidence references for that evaluation are automatically deleted

-- Add constraint names for better management (optional but good practice)
-- Note: PostgreSQL auto-generates constraint names, but we can verify they exist
DO $$
BEGIN
    -- Verify foreign key constraint exists on evidence_collection_configs.team_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.evidence_collection_configs'::regclass
        AND confrelid = 'public.teams'::regclass
        AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'Foreign key constraint missing on evidence_collection_configs.team_id';
    END IF;

    -- Verify foreign key constraint exists on evidence_references.evaluation_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.evidence_references'::regclass
        AND confrelid = 'public.evaluations'::regclass
        AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'Foreign key constraint missing on evidence_references.evaluation_id';
    END IF;
END $$;

