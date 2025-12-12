import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AES-256-GCM decryption (same as decrypt-api-key)
async function decryptApiKey(encryptedData: string, secret: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return decoder.decode(decrypted);
}

// Simple connection test for each provider
async function testOpenAI(apiKey: string, baseUrl: string, model: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      try {
        const errorJson = JSON.parse(errorBody);
        return { success: false, message: errorJson.error?.message || `HTTP ${response.status}` };
      } catch {
        return { success: false, message: `HTTP ${response.status}` };
      }
    }

    return { success: true, message: 'Connection successful' };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Connection failed' };
  }
}

async function testAnthropic(apiKey: string, baseUrl: string, model: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      try {
        const errorJson = JSON.parse(errorBody);
        return { success: false, message: errorJson.error?.message || `HTTP ${response.status}` };
      } catch {
        return { success: false, message: `HTTP ${response.status}` };
      }
    }

    return { success: true, message: 'Connection successful' };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Connection failed' };
  }
}

async function testGoogle(apiKey: string, baseUrl: string, model: string): Promise<{ success: boolean; message: string }> {
  try {
    const modelMap: Record<string, string> = {
      'gemini-pro': 'gemini-pro',
      'gemini-ultra': 'gemini-ultra',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'palm-2': 'text-bison-001',
    };
    const apiModel = modelMap[model] || model;
    
    const url = `${baseUrl}/models/${apiModel}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
        generationConfig: { maxOutputTokens: 10, temperature: 0 },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      try {
        const errorJson = JSON.parse(errorBody);
        return { success: false, message: errorJson.error?.message || `HTTP ${response.status}` };
      } catch {
        return { success: false, message: `HTTP ${response.status}` };
      }
    }

    return { success: true, message: 'Connection successful' };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Connection failed' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const encryptionSecret = Deno.env.get('API_KEY_ENCRYPTION_SECRET');
    if (!encryptionSecret) {
      throw new Error('Server configuration error');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { configId } = body;

    if (!configId) {
      return new Response(
        JSON.stringify({ error: 'Missing configId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate team membership
    const { data: profile } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch config with service role
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: config, error: configError } = await adminClient
      .from('llm_configurations')
      .select('api_key_encrypted, team_id, provider, model_name, base_url')
      .eq('id', configId)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (config.team_id !== profile.team_id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.api_key_encrypted) {
      return new Response(
        JSON.stringify({ success: false, message: 'No API key configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt API key
    const apiKey = await decryptApiKey(config.api_key_encrypted, encryptionSecret);
    
    // Test connection based on provider
    let result: { success: boolean; message: string };
    
    const baseUrls: Record<string, string> = {
      'OpenAI': config.base_url || 'https://api.openai.com/v1',
      'Anthropic': config.base_url || 'https://api.anthropic.com/v1',
      'Google': config.base_url || 'https://generativelanguage.googleapis.com/v1beta',
      'Azure': config.base_url || '',
      'Custom': config.base_url || '',
    };

    const baseUrl = baseUrls[config.provider] || config.base_url || '';

    switch (config.provider) {
      case 'OpenAI':
      case 'Azure':
      case 'Custom':
        result = await testOpenAI(apiKey, baseUrl, config.model_name);
        break;
      case 'Anthropic':
        result = await testAnthropic(apiKey, baseUrl, config.model_name);
        break;
      case 'Google':
        result = await testGoogle(apiKey, baseUrl, config.model_name);
        break;
      default:
        result = { success: false, message: `Unsupported provider: ${config.provider}` };
    }

    // Update last_tested_at and is_connected
    await adminClient
      .from('llm_configurations')
      .update({ 
        is_connected: result.success,
        last_tested_at: new Date().toISOString()
      })
      .eq('id', configId);

    console.log(`Connection test for ${configId}: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message}`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in test-connection:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Connection test failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
