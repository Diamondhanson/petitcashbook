import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return jsonResponse({ error: "Forbidden: admin role required" }, 403);
    }

    const body = await req.json();
    const { user_id: targetUserId } = body;
    if (!targetUserId || typeof targetUserId !== "string") {
      return jsonResponse({ error: "user_id is required" }, 400);
    }

    if (targetUserId === user.id) {
      return jsonResponse({ error: "Cannot delete your own account" }, 400);
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 400);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error(err);
    return jsonResponse(
      { error: String(err?.message ?? err ?? "Internal server error") },
      500
    );
  }
});
