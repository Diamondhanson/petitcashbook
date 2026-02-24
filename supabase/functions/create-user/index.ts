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

    const { email, password, full_name, role } = await req.json();
    if (!email || !password || !full_name || !role) {
      return jsonResponse({ error: "email, password, full_name, and role are required" }, 400);
    }

    const validRoles = ["employee", "manager", "accountant", "admin"];
    if (!validRoles.includes(role)) {
      return jsonResponse({ error: "role must be employee, manager, accountant, or admin" }, 400);
    }

    const { data: maxRows } = await supabaseAdmin
      .from("profiles")
      .select("employee_id")
      .not("employee_id", "is", null)
      .order("employee_id", { ascending: false })
      .limit(1);

    const maxId = maxRows?.[0]?.employee_id;
    const nextEmployeeId = maxId != null
      ? Math.min(99999, maxId + 1)
      : 10000;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return jsonResponse({ error: createError.message }, 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name,
        role,
        employee_id: nextEmployeeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newUser.user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
    }

    return jsonResponse({
      user_id: newUser.user.id,
      employee_id: nextEmployeeId,
      email: newUser.user.email,
      full_name,
      role,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: String(err?.message ?? err ?? "Internal server error") }, 500);
  }
});
