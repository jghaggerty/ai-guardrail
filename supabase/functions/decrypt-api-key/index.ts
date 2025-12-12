import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AES-256-GCM decryption with PBKDF2 key derivation (reverse of store-api-key)
async function decryptApiKey(encryptedData: string, secret: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  
  // Decode base64 to get combined data
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  // Extract salt (16 bytes), iv (12 bytes), and encrypted data
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);
  
  // Import the secret as key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive the same AES-256 key using PBKDF2 with same parameters
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
    ['decrypt']
  );
  
  // Decrypt the API key
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return decoder.decode(decrypted);
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
    const { configId } = body;

    if (!configId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: configId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that the user belongs to the team that owns this config
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to fetch the encrypted API key (bypasses RLS)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: config, error: configError } = await adminClient
      .from('llm_configurations')
      .select('api_key_encrypted, team_id, provider, model_name, base_url')
      .eq('id', configId)
      .maybeSingle();

    if (configError || !config) {
      console.error('Config fetch error:', configError);
      return new Response(
        JSON.stringify({ error: 'Configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify team membership
    if (config.team_id !== profile.team_id) {
      console.error('Team mismatch: user team', profile.team_id, 'config team', config.team_id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: team mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if API key exists
    if (!config.api_key_encrypted) {
      return new Response(
        JSON.stringify({ error: 'No API key configured for this model' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt the API key
    const apiKey = await decryptApiKey(config.api_key_encrypted, encryptionSecret);
    
    console.log(`Successfully decrypted API key for config ${configId} (provider: ${config.provider})`);

    return new Response(
      JSON.stringify({ 
        apiKey,
        provider: config.provider,
        model_name: config.model_name,
        base_url: config.base_url
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in decrypt-api-key function:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to decrypt API key' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
