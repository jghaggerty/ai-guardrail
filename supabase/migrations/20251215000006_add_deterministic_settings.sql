-- Add deterministic replay settings to evaluation_settings
ALTER TABLE public.evaluation_settings
ADD COLUMN IF NOT EXISTS deterministic_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS determinism_level text DEFAULT 'adaptive' CHECK (determinism_level IN ('full', 'near', 'adaptive')),
ADD COLUMN IF NOT EXISTS adaptive_iterations boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS min_iterations integer DEFAULT 3 CHECK (min_iterations >= 1),
ADD COLUMN IF NOT EXISTS max_iterations integer DEFAULT 20 CHECK (max_iterations >= 1),
ADD COLUMN IF NOT EXISTS stability_threshold numeric DEFAULT 0.9 CHECK (stability_threshold >= 0 AND stability_threshold <= 1),
ADD COLUMN IF NOT EXISTS fixed_iterations integer DEFAULT 5 CHECK (fixed_iterations >= 1);
