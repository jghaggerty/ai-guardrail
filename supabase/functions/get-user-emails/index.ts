import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Input validation schema - limit array size to prevent abuse
const GetUserEmailsSchema = z.object({
  userIds: z.array(z.string().uuid({ message: "Each userId must be a valid UUID" }))
    .min(1, { message: "userIds array must have at least 1 item" })
    .max(100, { message: "userIds array cannot exceed 100 items" }),
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

    // Get the user from the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user
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
      body = GetUserEmailsSchema.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid input format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { userIds } = body;

    // Check if requesting user is a company admin (can see emails of org members)
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

    // Get user's company
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

    // Check if user is company admin
    const { data: companyRole } = await supabaseClient
      .from("company_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", team.company_id)
      .eq("role", "company_admin")
      .single();

    if (!companyRole) {
      return new Response(JSON.stringify({ error: "Only company admins can view emails" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch emails from auth.users using admin client
    const { data: users, error: usersError } = await supabaseClient.auth.admin.listUsers();

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return new Response(JSON.stringify({ error: "Failed to fetch users" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to only requested user IDs and build email map
    const emailMap: Record<string, string> = {};
    for (const u of users.users) {
      if (userIds.includes(u.id) && u.email) {
        emailMap[u.id] = u.email;
      }
    }

    return new Response(JSON.stringify({ emails: emailMap }), {
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
