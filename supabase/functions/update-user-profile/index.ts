import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Input validation schema
const UpdateProfileSchema = z.object({
  targetUserId: z.string().uuid({ message: "targetUserId must be a valid UUID" }),
  fullName: z.string().min(1).max(255, { message: "fullName must be between 1 and 255 characters" }).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate input with zod schema
    let body;
    try {
      const rawBody = await req.json();
      body = UpdateProfileSchema.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid input format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { targetUserId, fullName } = body;

    // If editing own profile, allow
    const isOwnProfile = user.id === targetUserId;

    if (!isOwnProfile) {
      // Check if requesting user is a company admin
      const { data: requestingUserProfile } = await supabaseClient
        .from("profiles")
        .select("team_id")
        .eq("id", user.id)
        .single();

      if (!requestingUserProfile?.team_id) {
        return new Response(JSON.stringify({ error: "User has no team" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: team } = await supabaseClient
        .from("teams")
        .select("company_id")
        .eq("id", requestingUserProfile.team_id)
        .single();

      if (!team?.company_id) {
        return new Response(JSON.stringify({ error: "No company found" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: companyRole } = await supabaseClient
        .from("company_user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("company_id", team.company_id)
        .eq("role", "company_admin")
        .single();

      if (!companyRole) {
        return new Response(JSON.stringify({ error: "Only company admins can edit other profiles" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update the profile
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", targetUserId);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
