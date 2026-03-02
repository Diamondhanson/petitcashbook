import React, { useState, useEffect } from "react";
import * as pettyCashApi from "../utils/pettyCashApi";

function formatAmount(n) {
  return (
    new Intl.NumberFormat("en-CA", { style: "decimal", minimumFractionDigits: 0 }).format(n) +
    " FCFA"
  );
}

const STATUS_LABELS = {
  pending: "Pending",
  clarification_requested: "Awaiting clarification",
  approved: "Approved",
  rejected: "Rejected",
  disbursed: "Disbursed"
};

const STATUS_CLASSES = {
  pending: "bg-amber-100 text-amber-800",
  clarification_requested: "bg-orange-100 text-orange-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  disbursed: "bg-slate-100 text-slate-700"
};

const EVENT_LABELS = {
  created: "Request created",
  clarification_requested: "Clarification requested",
  clarification_provided: "Clarification provided",
  approved: "Approved",
  rejected: "Rejected"
};

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function RequestDetailsDialog({
  requestId,
  onClose,
  role,
  onApprove,
  onReject,
  onRequestClarification,
  onProvideClarification
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [clarifyMessage, setClarifyMessage] = useState("");
  const [showProvideForm, setShowProvideForm] = useState(false);
  const [provideResponse, setProvideResponse] = useState("");
  const [provideFiles, setProvideFiles] = useState([]);

  const refreshTimeline = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: d, error: e } = await pettyCashApi.getRequestTimeline(requestId);
    setLoading(false);
    if (e) setError(e);
    else setData(d);
  }, [requestId]);

  useEffect(() => {
    refreshTimeline();
  }, [refreshTimeline]);

  const handleApprove = async () => {
    setActionLoading("approve");
    try {
      await onApprove?.(requestId);
      await refreshTimeline();
      onClose?.();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) return;
    setActionLoading("reject");
    try {
      await onReject?.(requestId, rejectionReason.trim());
      await refreshTimeline();
      setShowRejectModal(false);
      setRejectionReason("");
      onClose?.();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestClarifySubmit = async () => {
    if (!clarifyMessage.trim()) return;
    setActionLoading("clarify");
    try {
      await onRequestClarification?.(requestId, clarifyMessage.trim());
      await refreshTimeline();
      setShowClarifyModal(false);
      setClarifyMessage("");
    } finally {
      setActionLoading(null);
    }
  };

  const handleProvideClarifySubmit = async () => {
    if (!provideResponse.trim()) return;
    setActionLoading("provide");
    try {
      await onProvideClarification?.(requestId, {
        response: provideResponse.trim(),
        attachmentFiles: provideFiles.length ? provideFiles : undefined
      });
      await refreshTimeline();
      setShowProvideForm(false);
      setProvideResponse("");
      setProvideFiles([]);
    } finally {
      setActionLoading(null);
    }
  };

  const r = data?.request;
  const timeline = data?.timeline ?? [];
  const isManager = role === "manager" || role === "admin";
  const status = r?.status ?? "";
  const canApproveRejectClarify =
    isManager && (status === "pending" || status === "clarification_requested");
  const needsClarification = status === "clarification_requested" && !isManager;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose?.()}
        role="button"
        tabIndex={0}
        aria-label="Close"
      />
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-brand-dark">Request Details</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {loading && (
            <p className="py-8 text-center text-slate-500">Loading…</p>
          )}
          {error && (
            <p className="py-8 text-center text-red-600">{error.message ?? "Failed to load"}</p>
          )}
          {!loading && !error && r && (
            <>
              <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-brand-dark">
                    {r.requester?.full_name ?? "—"}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_CLASSES[status] ?? "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-medium text-brand-dark">{formatAmount(r.amount)}</span>
                  {" · "}
                  {r.category ?? "—"}
                </div>
                <p className="text-sm text-slate-600">{r.purpose ?? "—"}</p>
                {r.receipt_url && (
                  <a
                    href={r.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-dark underline hover:text-slate-700"
                  >
                    View receipt
                  </a>
                )}
              </div>

              <h4 className="mt-6 mb-3 text-sm font-semibold text-brand-dark">Timeline</h4>
              <ul className="space-y-4">
                {timeline.map((evt, i) => (
                  <li key={evt.id ?? `created-${i}`} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-slate-300" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-brand-dark">
                        {EVENT_LABELS[evt.event_type] ?? evt.event_type}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(evt.created_at)}
                      </div>
                      {evt.event_type === "clarification_requested" && evt.payload?.message && (
                        <p className="mt-2 rounded border border-slate-100 bg-white p-2 text-sm text-slate-700">
                          {evt.payload.message}
                        </p>
                      )}
                      {evt.event_type === "clarification_provided" && (
                        <>
                          {evt.payload?.response && (
                            <p className="mt-2 rounded border border-slate-100 bg-white p-2 text-sm text-slate-700">
                              {evt.payload.response}
                            </p>
                          )}
                          {evt.payload?.attachment_urls?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {evt.payload.attachment_urls.map((url, j) => (
                                <a
                                  key={j}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-brand-dark underline hover:text-slate-700"
                                >
                                  Attachment {j + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {evt.event_type === "rejected" && evt.payload?.rejection_reason && (
                        <p className="mt-2 rounded border border-red-50 bg-red-50/50 p-2 text-sm text-red-800">
                          {evt.payload.rejection_reason}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {canApproveRejectClarify && status === "pending" && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={!!actionLoading}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actionLoading === "approve" ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={!!actionLoading}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClarifyModal(true)}
                    disabled={!!actionLoading}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Request clarification
                  </button>
                </div>
              )}

              {canApproveRejectClarify && status === "clarification_requested" && (
                <p className="mt-6 text-sm text-slate-600">
                  Awaiting employee clarification. You can approve or reject once they respond.
                </p>
              )}

              {needsClarification && !showProvideForm && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setShowProvideForm(true)}
                    disabled={!!actionLoading}
                    className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Provide clarification
                  </button>
                </div>
              )}

              {needsClarification && showProvideForm && (
                <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="text-sm font-semibold text-brand-dark">Provide clarification</h4>
                  <label className="mt-3 block text-sm font-medium text-brand-dark">
                    Response (required)
                  </label>
                  <textarea
                    rows={4}
                    value={provideResponse}
                    onChange={(e) => setProvideResponse(e.target.value)}
                    placeholder="Enter your clarification response"
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-brand-dark"
                    disabled={!!actionLoading}
                  />
                  <label className="mt-3 block text-sm font-medium text-brand-dark">
                    Attachments (optional)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setProvideFiles(Array.from(e.target.files || []))}
                    className="mt-1 block w-full text-sm text-slate-600"
                    disabled={!!actionLoading}
                  />
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={handleProvideClarifySubmit}
                      disabled={!!actionLoading || !provideResponse.trim()}
                      className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {actionLoading === "provide" ? "Submitting…" : "Submit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProvideForm(false);
                        setProvideResponse("");
                        setProvideFiles([]);
                      }}
                      disabled={!!actionLoading}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {showRejectModal && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/95 p-6">
            <div className="w-full max-w-md">
              <h4 className="text-lg font-semibold text-brand-dark">Reject Request</h4>
              <p className="mt-2 text-sm text-slate-600">
                Provide a reason for rejection (required).
              </p>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection"
                className="mt-3 block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-brand-dark"
                disabled={!!actionLoading}
              />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleRejectSubmit}
                  disabled={!!actionLoading || !rejectionReason.trim()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading === "reject" ? "Rejecting…" : "Reject"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason("");
                  }}
                  disabled={!!actionLoading}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showClarifyModal && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/95 p-6">
            <div className="w-full max-w-md">
              <h4 className="text-lg font-semibold text-brand-dark">Request Clarification</h4>
              <p className="mt-2 text-sm text-slate-600">
                Send a message to the employee requesting additional information.
              </p>
              <textarea
                rows={4}
                value={clarifyMessage}
                onChange={(e) => setClarifyMessage(e.target.value)}
                placeholder="Enter your clarification message"
                className="mt-3 block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-brand-dark"
                disabled={!!actionLoading}
              />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleRequestClarifySubmit}
                  disabled={!!actionLoading || !clarifyMessage.trim()}
                  className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {actionLoading === "clarify" ? "Sending…" : "Send"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowClarifyModal(false);
                    setClarifyMessage("");
                  }}
                  disabled={!!actionLoading}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RequestDetailsDialog;
