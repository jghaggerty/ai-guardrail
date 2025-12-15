import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeReproPackHash, verifyReproPackSignature as verifySignature, stableStringify } from "../utils/repro-pack.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationRequest {
  reproPackId?: string;
  packContent?: Record<string, unknown>;
  signature?: string;
  expectedHash?: string;
  signingAuthority?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const defaultPublicKey = Deno.env.get('REPRO_PACK_SIGNING_PUBLIC_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Server configuration missing');
    }

    const body = await req.json() as VerificationRequest;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let packContent: Record<string, unknown> | undefined = body.packContent;
    let signature = body.signature;
    let expectedHash = body.expectedHash;
    let signingAuthority = body.signingAuthority;
    let customerEvidenceId: string | undefined;

    if (body.reproPackId) {
      const { data: record, error } = await supabase
        .from('repro_packs')
        .select('content_hash, signature, signing_authority, repro_pack_content')
        .eq('id', body.reproPackId)
        .maybeSingle();

      if (error || !record) {
        console.error('Failed to load repro pack', error);
        return new Response(JSON.stringify({ valid: false, message: 'Repro pack not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      packContent = packContent ?? record.repro_pack_content ?? undefined;
      signature = signature ?? record.signature ?? undefined;
      expectedHash = expectedHash ?? record.content_hash ?? undefined;
      signingAuthority = signingAuthority ?? record.signing_authority ?? undefined;
      customerEvidenceId = (record.repro_pack_content as Record<string, unknown> | null)?.evidence_reference_id as string | undefined;
    }

    if (!packContent) {
      return new Response(JSON.stringify({ valid: false, message: 'packContent is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!signature) {
      return new Response(JSON.stringify({ valid: false, message: 'Missing signature for verification' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { hash: computedHash, legacyHash } = await computeReproPackHash(packContent);
    const hashMatches = expectedHash ? (expectedHash === computedHash || expectedHash === legacyHash) : true;

    const signingBlock = (packContent.signing as { public_key?: string; authority?: string } | undefined);
    const publicKeyFromPack = signingBlock?.public_key;
    const authorityFromPack = signingBlock?.authority;

    const authority = signingAuthority ?? authorityFromPack;
    let publicKeyToUse = publicKeyFromPack;

    if (!publicKeyToUse && authority === 'BiasLens') {
      publicKeyToUse = defaultPublicKey || undefined;
    }

    if (!publicKeyToUse && authority) {
      const { data: signingKey, error } = await supabase
        .from('signing_keys')
        .select('public_key')
        .eq('signing_authority', authority)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch signing key', error);
      }

      publicKeyToUse = signingKey?.public_key ?? publicKeyToUse;
    }

    if (!publicKeyToUse) {
      return new Response(JSON.stringify({ valid: false, message: 'No public key available for verification', expectedHash, computedHash, hashMatches, signingAuthority: authority }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const signatureValid = await verifySignature(publicKeyToUse, computedHash, signature);
    const valid = signatureValid && hashMatches;

    const diagnostics = {
      valid,
      hashMatches,
      signatureValid,
      signingAuthority: authority,
      expectedHash,
      computedHash,
      legacyHash,
      message: valid ? 'Repro pack signature verified' : 'Repro pack failed verification',
      replayInstructions: packContent.replay_instructions,
      serializedPackPreview: stableStringify(packContent).slice(0, 5000),
      customerEvidenceId,
    };

    return new Response(JSON.stringify(diagnostics), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Verification error', error);
    const errorMessage = error instanceof Error ? error.message : 'Verification failed';
    return new Response(JSON.stringify({ valid: false, message: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
