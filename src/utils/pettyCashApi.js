import { supabase } from "./supabaseClient";

const RECEIPTS_BUCKET = "receipts";
const REQUEST_CATEGORIES = [
  "Office",
  "Travel",
  "Food",
  "Supplies",
  "Utilities",
  "Miscellaneous"
];

/**
 * Upload a receipt file and return its public URL.
 * @param {File} file - Receipt image/file to upload
 * @param {string} requestId - Optional prefix for unique filename
 * @returns {Promise<{url: string, error: Error|null}>}
 */
async function uploadReceipt(file, requestId = "") {
  const ext = file.name.split(".").pop();
  const fileName = `${requestId || Date.now()}_${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(fileName, file, { upsert: false });

  if (error) return { url: null, error };

  const {
    data: { publicUrl }
  } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(data.path);
  return { url: publicUrl, error: null };
}

/**
 * Create a petty cash request (employee function).
 * @param {Object} params
 * @param {number} params.amount - Request amount in FCFA
 * @param {string} params.purpose - Reason for the request
 * @param {string} params.category - One of REQUEST_CATEGORIES
 * @param {File} [params.receiptFile] - Optional receipt file to upload
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function createRequest({
  amount,
  purpose,
  category,
  receiptFile = null
}) {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: null, error: authError || new Error("Not authenticated") };
  }

  if (!amount || !purpose || !category) {
    return {
      data: null,
      error: new Error("amount, purpose, and category are required")
    };
  }

  if (!REQUEST_CATEGORIES.includes(category)) {
    return {
      data: null,
      error: new Error(`category must be one of: ${REQUEST_CATEGORIES.join(", ")}`)
    };
  }

  let receiptUrl = null;
  if (receiptFile && receiptFile instanceof File) {
    const { url, error: uploadError } = await uploadReceipt(receiptFile);
    if (uploadError) {
      return { data: null, error: uploadError };
    }
    receiptUrl = url;
  }

  const { data, error } = await supabase
    .from("requests")
    .insert({
      requester_id: user.id,
      amount: Number(amount),
      purpose: purpose.trim(),
      category,
      receipt_url: receiptUrl,
      status: "pending"
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Update request status (manager approval/rejection or accountant disbursement).
 * For managers: creates audit_trail record on approval/rejection.
 * @param {string} requestId - Request UUID
 * @param {Object} updates
 * @param {'approved'|'rejected'|'disbursed'} updates.status
 * @param {string} [updates.rejection_reason] - Required when status is 'rejected'
 * @param {string} [updates.manager_comment] - Optional comment
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function updateRequestStatus(requestId, updates) {
  const { status, rejection_reason, manager_comment } = updates;

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: null, error: authError || new Error("Not authenticated") };
  }

  const validStatuses = ["approved", "rejected", "disbursed"];
  if (!validStatuses.includes(status)) {
    return {
      data: null,
      error: new Error(`status must be one of: ${validStatuses.join(", ")}`)
    };
  }

  if (status === "rejected" && !rejection_reason?.trim()) {
    return {
      data: null,
      error: new Error("rejection_reason is required when status is 'rejected'")
    };
  }

  const payload = { status, updated_at: new Date().toISOString() };

  if (status === "approved" || status === "rejected") {
    payload.manager_id = user.id;
    if (rejection_reason) payload.rejection_reason = rejection_reason.trim();
    if (manager_comment) payload.manager_comment = manager_comment.trim();
  }

  const { data: request, error } = await supabase
    .from("requests")
    .update(payload)
    .eq("id", requestId)
    .select()
    .single();

  if (error) return { data: null, error };

  if (status === "approved" || status === "rejected") {
    const { error: auditError } = await supabase.from("audit_trail").insert({
      request_id: requestId,
      action: status,
      performed_by: user.id,
      details:
        status === "rejected"
          ? { rejection_reason, manager_comment }
          : { manager_comment }
    });
    if (auditError) {
      console.error("Audit trail insert failed:", auditError);
    }
  }

  return { data: request, error: null };
}

/**
 * Get analytics data for charts: group by category (pie) and by date (trend).
 * Only includes disbursed requests.
 * @param {Object} [options]
 * @param {string} [options.startDate] - ISO date string
 * @param {string} [options.endDate] - ISO date string
 * @returns {Promise<{byCategory: Array, byDate: Array, error: Error|null}>}
 */
export async function getAnalyticsData(options = {}) {
  const { startDate, endDate } = options;

  let query = supabase
    .from("requests")
    .select("id, amount, category, created_at")
    .eq("status", "disbursed");

  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  const { data: rows, error } = await query;

  if (error) {
    return { byCategory: [], byDate: [], error };
  }

  const byCategoryMap = {};
  const byDateMap = {};

  for (const r of rows || []) {
    const cat = r.category || "Uncategorized";
    byCategoryMap[cat] = (byCategoryMap[cat] || 0) + Number(r.amount);

    const d = r.created_at?.slice(0, 10) || "unknown";
    byDateMap[d] = (byDateMap[d] || 0) + Number(r.amount);
  }

  const byCategory = Object.entries(byCategoryMap).map(([name, value]) => ({
    name,
    value
  }));

  const byDate = Object.entries(byDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));

  return { byCategory, byDate, error: null };
}

/**
 * Fetch the current user's profile including role.
 * @returns {Promise<{data: {full_name: string, role: string}|null, error: Error|null}>}
 */
export async function getProfile() {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: null, error: authError || new Error("Not authenticated") };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return { data, error };
}

/**
 * Fetch pending requests for managers (with requester profile).
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function getPendingRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select(
      `
      *,
      requester:profiles!requester_id(full_name, role)
    `
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return { data: data || [], error };
}

/**
 * Fetch current user's requests (employee view).
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function getMyRequests() {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: [], error: authError || new Error("Not authenticated") };
  }

  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false });

  return { data: data || [], error };
}

/**
 * Fetch disbursed requests for export (accountant).
 * @param {Object} [options] - startDate, endDate (ISO strings)
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function getDisbursedRequestsForExport(options = {}) {
  const { startDate, endDate } = options;

  let query = supabase
    .from("requests")
    .select(
      `
      *,
      requester:profiles!requester_id(full_name),
      manager:profiles!manager_id(full_name)
    `
    )
    .eq("status", "disbursed")
    .order("created_at", { ascending: false });

  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);

  const { data, error } = await query;
  return { data: data || [], error };
}

export { REQUEST_CATEGORIES };
