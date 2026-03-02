import { supabase, supabaseUrl } from "./supabaseClient";

/**
 * Fetch the next employee ID (admin only). Sequential. For backward compatibility.
 */
export async function getNextEmployeeId() {
  const { data, error } = await supabase.rpc("get_next_employee_id");
  if (error) return { data: null, error };
  return { data: data ?? 10000, error: null };
}

/**
 * Fetch a random unique employee ID (admin only). For Add User form.
 */
export async function getUniqueRandomEmployeeId() {
  const { data, error } = await supabase.rpc("get_unique_random_employee_id");
  if (error) return { data: null, error };
  return { data: data ?? null, error: null };
}

/**
 * Create a new user (admin only). Calls the create-user Edge Function.
 * @param {Object} params
 * @param {number} [params.employee_id] - Optional. Pre-generated 5-digit ID.
 */
export async function createUser({ email, password, full_name, role, employee_id }) {
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
      body: JSON.stringify({
        email,
        password,
        full_name,
        role,
        ...(employee_id != null && { employee_id }),
      }),
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

/**
 * Delete a user (admin only). Calls the delete-user Edge Function.
 * @param {string} userId - UUID of the user to delete
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function deleteUser(userId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !supabaseUrl) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });

    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6d7802c7-d21a-4e95-90af-01c0ab23108d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'userApi.js:deleteUser',message:'Delete response',data:{status:res.status,ok:res.ok,parsedError:parsed?.error,parsedMessage:parsed?.message,rawText:text?.slice(0,200)},hypothesisId:'A',timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (!res.ok) {
      const msg =
        parsed?.error ||
        parsed?.message ||
        (res.status === 403 && "Admin role required") ||
        (res.status === 401 && "Session expired — please log in again") ||
        (res.status === 404 && "Edge Function not deployed") ||
        (res.status >= 500 && "Server error — check Edge Function logs") ||
        `Request failed (${res.status})`;
      return { data: null, error: new Error(msg) };
    }

    if (parsed?.error) {
      return { data: null, error: new Error(parsed.error) };
    }

    return { data: parsed || {}, error: null };
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return { data: null, error: new Error("Network error — check your connection and CORS") };
    }
    return { data: null, error: new Error(msg) };
  }
}
