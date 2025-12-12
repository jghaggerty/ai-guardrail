-- Add selected_heuristics column to evaluation_settings
ALTER TABLE public.evaluation_settings 
ADD COLUMN selected_heuristics text[] DEFAULT ARRAY['anchoring', 'loss_aversion', 'confirmation_bias']::text[];