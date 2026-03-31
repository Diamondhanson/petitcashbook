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
  released: "Ready for pickup",
  rejected: "Rejected",
  disbursed: "Paid out"
};

const STATUS_CLASSES = {
  pending: "bg-amber-100 text-amber-800",
  clarification_requested: "bg-orange-100 text-orange-800",
  approved: "bg-emerald-100 text-emerald-800",
  released: "bg-sky-100 text-sky-800",
  rejected: "bg-red-100 text-red-800",
  disbursed: "bg-slate-100 text-slate-700"
};

const EVENT_LABELS = {
  created: "Request created",
  clarification_requested: "Clarification requested",
  clarification_provided: "Clarification provided",
  approved: "Approved",
  rejected: "Rejected",
  released: "Released for pickup (finance)",
  disbursed: "Paid out (cashier)"
};

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short"
  });
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
function isImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const path = url.split("?")[0].toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext));
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
  const [provideResponse, setProvideResponse] = useState("");
  const [provideFiles, setProvideFiles] = useState([]);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

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

  useEffect(() => {
    if (!previewImageUrl) return;
    const onEscape = (e) => {
      if (e.key === "Escape") setPreviewImageUrl(null);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [previewImageUrl]);

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
      setProvideResponse("");
      setProvideFiles([]);
    } finally {
      setActionLoading(null);
    }
  };

  const r = data?.request;
  const timeline = data?.timeline ?? [];
  const canModerateQueue =
    role === "manager" || role === "accountant" || role === "admin";
  const status = r?.status ?? "";
  const canApproveRejectClarify =
    canModerateQueue && (status === "pending" || status === "clarification_requested");
  // Show reply area for employees whenever request is not yet resolved (pending or awaiting clarification).
  const showReplyAreaForEmployee =
    !canModerateQueue &&
    (status === "pending" || status === "clarification_requested");

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
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="z-10 flex-shrink-0 border-b border-slate-300 bg-white px-6 py-4">
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {loading && (
              <p className="py-8 text-center text-accent">Loading…</p>
            )}
            {error && (
              <p className="py-8 text-center text-red-600">{error.message ?? "Failed to load"}</p>
            )}
            {!loading && !error && r && (
              <>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-100 p-4">
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
                  {r.reference_code && (
                    <p className="font-mono text-sm font-semibold text-brand-dark">
                      Reference: {r.reference_code}
                      {status === "approved" && (
                        <span className="mt-1 block text-xs font-normal text-accent sm:mt-0 sm:ml-2 sm:inline">
                          Awaiting finance disbursement before cash pickup.
                        </span>
                      )}
                      {status === "released" && (
                        <span className="mt-1 block text-xs font-normal text-accent sm:mt-0 sm:ml-2 sm:inline">
                          Give this code to the cashier when collecting cash.
                        </span>
                      )}
                    </p>
                  )}
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
                        <div className="text-xs text-accent">
                          {formatDate(evt.created_at)}
                        </div>
                        {evt.event_type === "clarification_requested" && evt.payload?.message && (
                          <p className="mt-2 rounded border border-slate-200 bg-orange-50/80 p-2 text-sm text-slate-700">
                            {evt.payload.message}
                          </p>
                        )}
                        {evt.event_type === "clarification_provided" && (
                          <>
                            {evt.payload?.response && (
                              <p className="mt-2 rounded border border-slate-200 bg-emerald-50/80 p-2 text-sm text-slate-700">
                                {evt.payload.response}
                              </p>
                            )}
                            {evt.payload?.attachment_urls?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-4">
                                {evt.payload.attachment_urls.map((url, j) => {
                                  const image = isImageUrl(url);
                                  const label = `Attachment ${j + 1}`;
                                  return (
                                    <div
                                      key={j}
                                      className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/80 p-2"
                                    >
                                      {image ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => setPreviewImageUrl(url)}
                                            className="focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-1 rounded overflow-hidden"
                                          >
                                            <img
                                              src={url}
                                              alt={label}
                                              className="h-32 w-auto max-w-full object-contain bg-white rounded"
                                            />
                                          </button>
                                          <p className="mt-1 text-xs text-slate-600 text-center">
                                            {label}
                                          </p>
                                        </>
                                      ) : (
                                        <p className="text-sm font-medium text-slate-700 py-2">
                                          {label}
                                        </p>
                                      )}
                                      <div className="mt-1 flex flex-wrap gap-2 justify-center">
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-brand-dark underline hover:text-slate-700"
                                        >
                                          {image ? "Open in new tab" : "View"}
                                        </a>
                                        <a
                                          href={url}
                                          download
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-brand-dark underline hover:text-slate-700"
                                        >
                                          Download
                                        </a>
                                      </div>
                                    </div>
                                  );
                                })}
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
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
              </>
            )}
          </div>

          {showReplyAreaForEmployee && (
            <div
              className="flex-shrink-0 border-t border-slate-200 bg-white px-6 py-4"
              role="region"
              aria-label="Your response"
            >
              <h4 className="text-sm font-semibold text-brand-dark">Your response</h4>
              <p className="mt-1 text-xs text-slate-500">
                Add your clarification and attach receipts, images, or PDFs for the manager.
              </p>
              <label className="mt-3 block text-sm font-medium text-brand-dark">
                Response (required)
              </label>
              <textarea
                rows={3}
                value={provideResponse}
                onChange={(e) => setProvideResponse(e.target.value)}
                placeholder="Enter your clarification response"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-brand-dark"
                disabled={!!actionLoading}
                aria-required="true"
              />
              <label className="mt-3 block text-sm font-medium text-brand-dark">
                Attachments (optional) — images or PDF
              </label>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => setProvideFiles(Array.from(e.target.files || []))}
                className="mt-1 block w-full text-sm text-slate-600"
                disabled={!!actionLoading}
                aria-describedby="clarification-attachments-hint"
              />
              <p id="clarification-attachments-hint" className="sr-only">
                You can attach receipts, images, or PDF files
              </p>
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
                    setProvideResponse("");
                    setProvideFiles([]);
                  }}
                  disabled={!!actionLoading}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {showRejectModal && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-inner">
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
                className="mt-3 block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-brand-dark"
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
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showClarifyModal && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-inner">
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
                className="mt-3 block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-brand-dark"
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
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {previewImageUrl && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPreviewImageUrl(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            <div
              className="relative max-h-[90vh] max-w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImageUrl}
                alt="Attachment preview"
                className="max-h-[90vh] max-w-full object-contain rounded shadow-xl"
              />
              <div className="mt-2 flex justify-center gap-2">
                <a
                  href={previewImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-white"
                >
                  Open in new tab
                </a>
                <a
                  href={previewImageUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-white"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="rounded bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-white"
                >
                  Close
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
