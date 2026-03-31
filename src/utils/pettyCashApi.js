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
 * Upload clarification attachment to receipts bucket.
 * @param {File} file
 * @param {string} requestId
 * @returns {Promise<{url: string, error: Error|null}>}
 */
async function uploadClarificationFile(file, requestId) {
  const ext = file.name.split(".").pop();
  const fileName = `clarifications/${requestId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

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
 * Create a PETTY SYNC request (employee function).
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
 * Update request status (manager approve/reject, accountant/admin release, cashier/admin paid out).
 * Writes audit_trail + request_timeline where applicable.
 * @param {string} requestId - Request UUID
 * @param {Object} updates
 * @param {'approved'|'rejected'|'released'|'disbursed'} updates.status
 * @param {string} [updates.rejection_reason] - Required when status is 'rejected'
 * @param {string} [updates.manager_comment] - Optional comment
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function updateRequestStatus(requestId, updates) {
  if (!requestId) {
    return {
      data: null,
      error: new Error("requestId is required for update")
    };
  }

  const { status, rejection_reason, manager_comment } = updates;

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: null, error: authError || new Error("Not authenticated") };
  }

  const validStatuses = ["approved", "rejected", "released", "disbursed"];
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

  const rpcParams = {
    p_request_id: requestId,
    p_status: status,
    p_manager_id: null,
    p_rejection_reason: null
  };
  if (status === "approved" || status === "rejected") {
    rpcParams.p_manager_id = user.id;
    if (rejection_reason) rpcParams.p_rejection_reason = rejection_reason.trim();
  }

  const { data: rawRows, error } = await supabase.rpc("update_requests_status", rpcParams);

  // Normalize: RPC RETURNS SETOF can be array or (in some cases) single object.
  const rows = Array.isArray(rawRows)
    ? rawRows
    : rawRows != null && typeof rawRows === "object" && !Array.isArray(rawRows)
      ? [rawRows]
      : [];

  if (error) {
    const msg = String(error.message || "");
    if (
      status === "released" &&
      /invalid status/i.test(msg) &&
      /released/i.test(msg)
    ) {
      return {
        data: null,
        error: new Error(
          "Your Supabase database does not have the latest payout RPC yet. Open the SQL Editor and run the full script in supabase/migrations/012_released_status_disburse_flow.sql (adds status ‘released’ and updates update_requests_status)."
        )
      };
    }
    if (status === "disbursed" && /invalid status/i.test(msg) && /disbursed/i.test(msg)) {
      return {
        data: null,
        error: new Error(
          "Your Supabase database does not have the latest payout RPC yet. Run supabase/migrations/012_released_status_disburse_flow.sql in the SQL Editor."
        )
      };
    }
    return { data: null, error };
  }

  const request = rows.length > 0 ? rows[0] : null;
  if (!request) return { data: null, error: new Error("Request not found or not updated") };

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

    const { error: timelineError } = await supabase
      .from("request_timeline")
      .insert({
        request_id: requestId,
        event_type: status,
        performed_by: user.id,
        payload:
          status === "rejected"
            ? { rejection_reason: rejection_reason.trim(), manager_comment: manager_comment?.trim() }
            : { manager_comment: manager_comment?.trim() }
      });
    if (timelineError) {
      console.error("Timeline insert failed:", timelineError);
    }
  }

  if (status === "released") {
    const { error: auditError } = await supabase.from("audit_trail").insert({
      request_id: requestId,
      action: "released",
      performed_by: user.id,
      details: {}
    });
    if (auditError) console.error("Audit trail insert failed:", auditError);

    const { error: timelineError } = await supabase.from("request_timeline").insert({
      request_id: requestId,
      event_type: "released",
      performed_by: user.id,
      payload: {}
    });
    if (timelineError) console.error("Timeline insert failed:", timelineError);
  }

  if (status === "disbursed") {
    const { error: auditError } = await supabase.from("audit_trail").insert({
      request_id: requestId,
      action: "disbursed",
      performed_by: user.id,
      details: {}
    });
    if (auditError) console.error("Audit trail insert failed:", auditError);

    const { error: timelineError } = await supabase.from("request_timeline").insert({
      request_id: requestId,
      event_type: "disbursed",
      performed_by: user.id,
      payload: {}
    });
    if (timelineError) console.error("Timeline insert failed:", timelineError);
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
 * Fetch pending requests for managers and accountants (with requester profile).
 * Includes both pending and clarification_requested.
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
    .in("status", ["pending", "clarification_requested"])
    .order("created_at", { ascending: false });

  return { data: data || [], error };
}

/**
 * Get single request with requester profile (for manager dialog).
 * @param {string} requestId
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function getRequestDetails(requestId) {
  const { data, error } = await supabase
    .from("requests")
    .select(
      `
      *,
      requester:profiles!requester_id(full_name, role)
    `
    )
    .eq("id", requestId)
    .single();

  return { data, error };
}

/**
 * Get request with timeline (merged chronological events).
 * First event is derived from request creation.
 * @param {string} requestId
 * @returns {Promise<{data: {request: object, timeline: Array}|null, error: Error|null}>}
 */
export async function getRequestTimeline(requestId) {
  const { data: request, error: reqError } = await supabase
    .from("requests")
    .select(
      `
      *,
      requester:profiles!requester_id(full_name, role)
    `
    )
    .eq("id", requestId)
    .single();

  if (reqError || !request) {
    return { data: null, error: reqError || new Error("Request not found") };
  }

  const { data: rows, error: tlError } = await supabase
    .from("request_timeline")
    .select("id, event_type, performed_by, created_at, payload")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (tlError) {
    // Fallback when request_timeline table doesn't exist (migration not applied)
    console.warn("request_timeline unavailable:", tlError.message);
    return { data: { request, timeline: [] }, error: null };
  }

  const timeline = [];
  timeline.push({
    event_type: "created",
    created_at: request.created_at,
    payload: {},
    performed_by: request.requester_id
  });

  for (const r of rows || []) {
    timeline.push({
      id: r.id,
      event_type: r.event_type,
      created_at: r.created_at,
      payload: r.payload || {},
      performed_by: r.performed_by
    });
  }

  timeline.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return {
    data: { request, timeline },
    error: null
  };
}

/**
 * Manager: request clarification from employee.
 * Inserts timeline row and sets request status to clarification_requested.
 * @param {string} requestId
 * @param {Object} params
 * @param {string} params.message - Required clarification message
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function requestClarification(requestId, { message }) {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: null, error: authError || new Error("Not authenticated") };
  }

  if (!message?.trim()) {
    return { data: null, error: new Error("message is required") };
  }

  const { error: tlError } = await supabase.from("request_timeline").insert({
    request_id: requestId,
    event_type: "clarification_requested",
    performed_by: user.id,
    payload: { message: message.trim() }
  });

  if (tlError) return { data: null, error: tlError };

  const { data, error } = await supabase
    .from("requests")
    .update({ status: "clarification_requested" })
    .eq("id", requestId)
    .select()
    .single();

  return { data, error };
}

/**
 * Employee: provide clarification (response + optional attachments).
 * Uploads files, inserts timeline row, sets status to pending.
 * @param {string} requestId
 * @param {Object} params
 * @param {string} params.response - Required clarification response
 * @param {File[]} [params.attachmentFiles] - Optional files to attach
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function provideClarification(requestId, { response, attachmentFiles }) {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: null, error: authError || new Error("Not authenticated") };
  }

  if (!response?.trim()) {
    return { data: null, error: new Error("response is required") };
  }

  const attachmentUrls = [];
  const files = Array.isArray(attachmentFiles)
    ? attachmentFiles
    : attachmentFiles
      ? [attachmentFiles]
      : [];

  for (const f of files) {
    if (f instanceof File) {
      const { url, error: uploadErr } = await uploadClarificationFile(f, requestId);
      if (uploadErr) return { data: null, error: uploadErr };
      if (url) attachmentUrls.push(url);
    }
  }

  const { error: tlError } = await supabase.from("request_timeline").insert({
    request_id: requestId,
    event_type: "clarification_provided",
    performed_by: user.id,
    payload: { response: response.trim(), attachment_urls: attachmentUrls }
  });

  if (tlError) return { data: null, error: tlError };

  const { data, error } = await supabase
    .from("requests")
    .update({ status: "pending" })
    .eq("id", requestId)
    .select()
    .single();

  return { data, error };
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

const payoutQueueSelect = `
  *,
  requester:profiles!requester_id(full_name)
`;

/**
 * Manager-approved requests waiting for accountant/admin to release to the cash desk.
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function getAwaitingDisbursementRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select(payoutQueueSelect)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  return { data: data || [], error };
}

/**
 * Released for pickup: cashier desk queue (after accountant/admin disbursed).
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function getReleasedForPayoutRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select(payoutQueueSelect)
    .eq("status", "released")
    .order("created_at", { ascending: false });

  return { data: data || [], error };
}

/**
 * Paid-out history (most recent first). For Disbursements history tab.
 * @param {Object} [options]
 * @param {number} [options.limit=500]
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function getDisbursedRequestsRecent(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 2000);
  const { data, error } = await supabase
    .from("requests")
    .select(payoutQueueSelect)
    .eq("status", "disbursed")
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data: data || [], error };
}

/**
 * Look up a released (ready for cash) request by human-readable reference (e.g. PC-100042).
 * @param {string} code
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function getReleasedRequestByReferenceCode(code) {
  const normalized = String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!normalized) {
    return { data: null, error: new Error("Reference is required") };
  }

  const { data, error } = await supabase
    .from("requests")
    .select(payoutQueueSelect)
    .eq("reference_code", normalized)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) {
    return { data: null, error: new Error("No request with this reference") };
  }
  if (data.status !== "released") {
    return {
      data: null,
      error: new Error(
        data.status === "approved"
          ? "This request is approved but not yet released for pickup — finance must disburse first."
          : "This reference is not ready for cash pickup at the desk."
      )
    };
  }
  return { data, error: null };
}

/**
 * Get current cash float balance (admin, accountant, cashier). Requires get_cash_float RPC.
 * @returns {Promise<{data: number|null, error: Error|null}>}
 */
export async function getCashFloat() {
  const { data, error } = await supabase.rpc("get_cash_float");
  if (error) return { data: null, error };
  return { data: data ?? 0, error: null };
}

/**
 * List float top-ups (admin or cashier). Requires list_float_topups RPC.
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function listFloatTopups() {
  const { data, error } = await supabase.rpc("list_float_topups");
  if (error) return { data: [], error };
  return { data: data ?? [], error: null };
}

/**
 * Top up cash float (admin or cashier). Requires update_cash_float RPC.
 * @param {number} amount - Amount in FCFA to add
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function updateCashFloat(amount) {
  const val = Number(amount);
  if (isNaN(val) || val <= 0) {
    return { data: null, error: new Error("Amount must be a positive number") };
  }
  const { data, error } = await supabase.rpc("update_cash_float", {
    amount_add: val,
  });
  if (error) return { data: null, error };
  return { data: data ?? null, error: null };
}

/**
 * Admin: combined activity log — float top-ups and closed requests (disbursed / rejected).
 * Requires migrations: list_float_topups, list_admin_closed_requests, float_topup_log.
 * @returns {Promise<{data: Array<{kind: string, at: string, amountSigned: number, title: string, detail: string, meta: object}>, error: Error|null}>}
 */
export async function getAdminCashbookHistory() {
  const [{ data: topRows, error: topErr }, { data: reqRows, error: reqErr }] =
    await Promise.all([
      supabase.rpc("list_float_topups"),
      supabase.rpc("list_admin_closed_requests"),
    ]);

  if (topErr?.code === "PGRST202" || reqErr?.code === "PGRST202") {
    return {
      data: [],
      error: new Error(
        "Activity log requires database migration 008 (list_float_topups, list_admin_closed_requests)."
      ),
    };
  }
  if (topErr) return { data: [], error: topErr };
  if (reqErr) return { data: [], error: reqErr };

  const entries = [];

  for (const row of topRows || []) {
    entries.push({
      kind: "float_topup",
      at: row.created_at,
      amountSigned: Number(row.amount_added),
      title: "Cash float top-up",
      detail: row.performer_name
        ? `By ${row.performer_name} · Balance after ${Number(row.balance_after).toLocaleString("en-CA")} FCFA`
        : `Balance after ${Number(row.balance_after).toLocaleString("en-CA")} FCFA`,
      meta: {
        balance_after: row.balance_after,
        performer_name: row.performer_name,
      },
    });
  }

  for (const r of reqRows || []) {
    if (r.status === "disbursed") {
      entries.push({
        kind: "disbursement",
        at: r.created_at,
        amountSigned: -Math.abs(Number(r.amount)),
        title: "Paid out",
        detail: [
          r.reference_code ? `Ref: ${r.reference_code}` : null,
          r.purpose,
          r.category,
          r.requester_name ? `Requester: ${r.requester_name}` : null
        ]
          .filter(Boolean)
          .join(" · "),
        meta: {
          request_id: r.id,
          requester_name: r.requester_name,
          category: r.category,
        },
      });
    } else if (r.status === "rejected") {
      entries.push({
        kind: "rejection",
        at: r.created_at,
        amountSigned: 0,
        title: "Request rejected",
        detail: [
          r.purpose,
          r.category,
          r.requester_name ? `Requester: ${r.requester_name}` : null,
          r.manager_name ? `Manager: ${r.manager_name}` : null,
          r.rejection_reason ? `Reason: ${r.rejection_reason}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        meta: {
          request_id: r.id,
          requested_amount: r.amount,
          requester_name: r.requester_name,
        },
      });
    }
  }

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { data: entries, error: null };
}

/**
 * List users for admin. Requires list_profiles RPC.
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function listUsers() {
  const { data, error } = await supabase.rpc("list_profiles");
  if (error) return { data: [], error };
  return { data: data ?? [], error: null };
}

/**
 * Update user role (admin). Requires update_user_role RPC.
 * @param {string} userId - Profile UUID
 * @param {string} newRole - One of employee, manager, accountant, admin, cashier
 * @returns {Promise<{data: object|null, error: Error|null}>}
 */
export async function updateUserRole(userId, newRole) {
  const valid = ["employee", "manager", "accountant", "admin", "cashier"];
  if (!valid.includes(newRole)) {
    return { data: null, error: new Error(`Role must be one of: ${valid.join(", ")}`) };
  }
  const { data, error } = await supabase.rpc("update_user_role", {
    target_user_id: userId,
    new_role: newRole,
  });
  if (error) return { data: null, error };
  return { data: data ?? null, error: null };
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
