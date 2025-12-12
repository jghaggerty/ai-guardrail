-- Move pg_net extension from public to extensions schema
-- First, ensure extensions schema exists (it should on Supabase)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop and recreate the extension in the extensions schema
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net SCHEMA extensions;