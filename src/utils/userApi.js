import { supabase, supabaseUrl } from "./supabaseClient";

/**
 * Fetch the next employee ID (admin only). For preview in Add User form.
 */
export async function getNextEmployeeId() {
  const { data, error } = await supabase.rpc("get_next_employee_id");
  if (error) return { data: null, error };
  return { data: data ?? 10000, error: null };
}

/**
 * Create a new user (admin only). Calls the create-user Edge Function.
 */
export async function createUser({ email, password, full_name, role }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !supabaseUrl) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, password, full_name, role }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg =
        data?.error ||
        data?.message ||
        (res.status === 403 && "Admin role required") ||
        (res.status === 401 && "Session expired — please log in again") ||
        (res.status === 404 && "Edge Function not deployed") ||
        (res.status >= 500 && "Server error — check Edge Function logs") ||
        `Request failed (${res.status})`;
      return { data: null, error: new Error(msg) };
    }

    if (data?.error) {
      return { data: null, error: new Error(data.error) };
    }

    return { data: data || {}, error: null };
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return { data: null, error: new Error("Network error — check your connection and CORS") };
    }
    return { data: null, error: new Error(msg) };
  }
}
