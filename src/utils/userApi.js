import { supabase } from "./supabaseClient";

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
  const { data, error } = await supabase.functions.invoke("create-user", {
    body: { email, password, full_name, role },
  });

  if (error) {
    return {
      data: null,
      error: new Error(error.message || "Failed to create user"),
    };
  }

  if (data?.error) {
    return { data: null, error: new Error(data.error) };
  }

  return { data: data || {}, error: null };
}
