import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple XOR-based encryption with base64 encoding
// In production, consider using Web Crypto API for AES encryption
function encryptApiKey(apiKey: string, secret: string): string {
  const keyBytes = new TextEncoder().encode(apiKey);
  const secretBytes = new TextEncoder().encode(secret);
  
  const encrypted = new Uint8Array(keyBytes.length);
  for (let i = 0; i < keyBytes.length; i++) {
    encrypted[i] = keyBytes[i] ^ secretBytes[i % secretBytes.length];
  }
  
  // Convert to base64 for safe storage
  return btoa(String.fromCharCode(...encrypted));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const encryptionSecret = Deno.env.get('API_KEY_ENCRYPTION_SECRET');
    if (!encryptionSecret) {
      console.error('API_KEY_ENCRYPTION_SECRET not configured');
      throw new Error('Server configuration error');
    }

    // Get the authorization header to authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with the user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { configId, apiKey, teamId } = body;

    if (!configId || !apiKey || !teamId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: configId, apiKey, teamId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that the user belongs to this team
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || profile.team_id !== teamId) {
      console.error('Team validation error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: team mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encrypt the API key
    const encryptedKey = encryptApiKey(apiKey, encryptionSecret);
    console.log(`Encrypting API key for config ${configId}`);

    // Use service role to update the encrypted key (bypasses RLS for this specific update)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await adminClient
      .from('llm_configurations')
      .update({ 
        api_key_encrypted: encryptedKey,
        last_tested_at: new Date().toISOString()
      })
      .eq('id', configId)
      .eq('team_id', teamId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to store API key');
    }

    console.log(`Successfully stored encrypted API key for config ${configId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'API key stored securely' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in store-api-key function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
