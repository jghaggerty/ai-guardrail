import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AES-256-GCM encryption with PBKDF2 key derivation
async function encryptApiKey(apiKey: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Generate a random salt for PBKDF2
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Import the secret as key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive an AES-256 key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  // Generate a random IV for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the API key
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(apiKey)
  );
  
  // Combine salt + iv + encrypted data for storage
  // Format: [16 bytes salt][12 bytes iv][encrypted data]
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  // Convert to base64 for safe storage
  return btoa(String.fromCharCode(...combined));
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

    // Encrypt the API key using AES-256-GCM
    const encryptedKey = await encryptApiKey(apiKey, encryptionSecret);
    console.log(`Encrypting API key for config ${configId} using AES-256-GCM`);

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
      JSON.stringify({ success: true, message: 'API key stored securely with AES-256-GCM encryption' }),
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
