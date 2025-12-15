import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function encryptPrivateKey(privateKey: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(privateKey));

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const encryptionSecret = Deno.env.get('SIGNING_KEY_ENCRYPTION_SECRET');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Supabase environment not configured');
      throw new Error('Server configuration error');
    }

    if (!encryptionSecret) {
      console.error('SIGNING_KEY_ENCRYPTION_SECRET not configured');
      throw new Error('Server configuration error');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile?.team_id) {
      console.error('Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'Team context not found for user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teamId = profile.team_id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const path = url.pathname.replace('/signing-keys', '');

    // Rotate or create a new customer signing key
    if (req.method === 'POST' && path === '/rotate') {
      const body = await req.json();
      const { signingKeyId, privateKeyPem, publicKeyPem, signingAuthority = 'customer' } = body ?? {};

      if (!signingKeyId || !privateKeyPem || !publicKeyPem) {
        return new Response(JSON.stringify({ error: 'signingKeyId, privateKeyPem, and publicKeyPem are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const encryptedPrivateKey = await encryptPrivateKey(privateKeyPem, encryptionSecret);

      const { error: rotationError } = await adminClient
        .from('signing_keys')
        .update({ status: 'rotated', rotated_at: new Date().toISOString() })
        .eq('team_id', teamId)
        .eq('status', 'active')
        .eq('signing_authority', 'customer');

      if (rotationError) {
        console.error('Failed to mark previous keys as rotated', rotationError);
        throw new Error('Failed to rotate previous signing keys');
      }

      const { data: newKey, error: insertError } = await adminClient
        .from('signing_keys')
        .insert({
          team_id: teamId,
          created_by: user.id,
          signing_authority: signingAuthority,
          signing_key_id: signingKeyId,
          public_key: publicKeyPem,
          private_key_encrypted: encryptedPrivateKey,
          status: 'active',
        })
        .select()
        .single();

      if (insertError || !newKey) {
        console.error('Failed to store signing key', insertError);
        throw new Error('Failed to store signing key');
      }

      const { error: configError } = await adminClient
        .from('team_signing_configs')
        .upsert({
          team_id: teamId,
          signing_mode: 'customer',
          active_signing_key_id: newKey.id,
          updated_at: new Date().toISOString(),
        })
        .eq('team_id', teamId);

      if (configError) {
        console.error('Failed to update signing mode to customer', configError);
        throw new Error('Failed to set signing mode');
      }

      return new Response(
        JSON.stringify({
          signing_mode: 'customer',
          key: {
            id: newKey.id,
            signing_key_id: newKey.signing_key_id,
            signing_authority: newKey.signing_authority,
            public_key: newKey.public_key,
            status: newKey.status,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set signing mode for the team
    if (req.method === 'PATCH' && path === '/mode') {
      const body = await req.json();
      const { signingMode, activeSigningKeyId } = body ?? {};

      if (!['biaslens', 'customer'].includes(signingMode)) {
        return new Response(JSON.stringify({ error: 'signingMode must be biaslens or customer' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let keyIdToUse = activeSigningKeyId as string | undefined;

      if (signingMode === 'customer' && !keyIdToUse) {
        const { data: currentKey, error: keyError } = await adminClient
          .from('signing_keys')
          .select('id')
          .eq('team_id', teamId)
          .eq('status', 'active')
          .eq('signing_authority', 'customer')
          .maybeSingle();

        if (keyError) {
          console.error('Failed to look up active signing key', keyError);
          return new Response(JSON.stringify({ error: 'Unable to load active signing key' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        keyIdToUse = currentKey?.id;
      }

      if (signingMode === 'customer' && !keyIdToUse) {
        return new Response(JSON.stringify({ error: 'An active customer signing key is required for customer mode' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: config, error: configError } = await adminClient
        .from('team_signing_configs')
        .upsert({
          team_id: teamId,
          signing_mode: signingMode,
          active_signing_key_id: signingMode === 'customer' ? keyIdToUse : null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (configError || !config) {
        console.error('Failed to update signing mode', configError);
        throw new Error('Failed to update signing mode');
      }

      return new Response(JSON.stringify({ signing_mode: config.signing_mode, active_signing_key_id: config.active_signing_key_id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch active signing materials (encrypted private key stays encrypted)
    if (req.method === 'GET' && path === '/active') {
      const { data: config, error: configError } = await adminClient
        .from('team_signing_configs')
        .select('signing_mode, active_signing_key_id')
        .eq('team_id', teamId)
        .maybeSingle();

      if (configError) {
        console.error('Failed to load signing config', configError);
        return new Response(JSON.stringify({ error: 'Unable to load signing configuration' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (config?.signing_mode === 'customer' && config.active_signing_key_id) {
        const { data: activeKey, error: keyError } = await adminClient
          .from('signing_keys')
          .select('id, signing_key_id, signing_authority, public_key, private_key_encrypted, status')
          .eq('id', config.active_signing_key_id)
          .eq('team_id', teamId)
          .maybeSingle();

        if (keyError || !activeKey) {
          console.error('Active signing key not found', keyError);
          return new Response(JSON.stringify({ error: 'Active signing key not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({
            signing_mode: 'customer',
            signing_key_id: activeKey.signing_key_id,
            signing_authority: activeKey.signing_authority,
            public_key: activeKey.public_key,
            private_key_encrypted: activeKey.private_key_encrypted,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const signingAuthority = Deno.env.get('REPRO_PACK_SIGNING_AUTHORITY') || 'BiasLens';
      const signingKeyId = Deno.env.get('REPRO_PACK_SIGNING_KEY_ID') || 'default';
      const signingPublicKey = Deno.env.get('REPRO_PACK_SIGNING_PUBLIC_KEY') || null;

      return new Response(
        JSON.stringify({
          signing_mode: 'biaslens',
          signing_key_id: signingKeyId,
          signing_authority: signingAuthority,
          public_key: signingPublicKey,
          private_key_encrypted: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in signing-keys function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
