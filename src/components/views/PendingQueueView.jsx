import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import * as pettyCashApi from "../../utils/pettyCashApi";
import { useAuth } from "../../context/AuthContext";
import RequestDetailsDialog from "../RequestDetailsDialog";

function formatAmount(n) {
  return (
    new Intl.NumberFormat("en-CA", { style: "decimal", minimumFractionDigits: 0 }).format(n) +
    " FCFA"
  );
}

function PendingQueueView() {
  const { role } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [detailsRequestId, setDetailsRequestId] = useState(null);

  const load = async () => {
    const { data } = await pettyCashApi.getPendingRequests?.().catch(() => ({ data: [] }));
    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (id) => {
    setApproving(id);
    const { error } = await pettyCashApi.updateRequestStatus?.(id, { status: "approved" });
    setApproving(null);
    if (error) {
      toast.error(error.message || "Failed to approve");
    } else {
      toast.success("Request approved");
      load();
    }
  };

  const handleRejectClick = (r) => setRejectTarget(r);
  const handleRejectCancel = () => {
    setRejectTarget(null);
    setRejectionReason("");
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget || !rejectionReason.trim()) return;
    setRejecting(true);
    const { error } = await pettyCashApi.updateRequestStatus?.(rejectTarget.id, {
      status: "rejected",
      rejection_reason: rejectionReason.trim()
    });
    setRejecting(false);
    setRejectTarget(null);
    setRejectionReason("");
    if (error) {
      toast.error(error.message || "Failed to reject");
    } else {
      toast.success("Request rejected");
      load();
    }
  };

  const handleDetailsApprove = async (id) => {
    const { error } = await pettyCashApi.updateRequestStatus?.(id, { status: "approved" });
    if (error) {
      toast.error(error.message || "Failed to approve");
      throw error;
    }
    toast.success("Request approved");
    load();
  };

  const handleDetailsReject = async (id, reason) => {
    const { error } = await pettyCashApi.updateRequestStatus?.(id, {
      status: "rejected",
      rejection_reason: reason
    });
    if (error) {
      toast.error(error.message || "Failed to reject");
      throw error;
    }
    toast.success("Request rejected");
    load();
  };

  const handleRequestClarification = async (id, message) => {
    const { error } = await pettyCashApi.requestClarification?.(id, { message });
    if (error) {
      toast.error(error.message || "Failed to send clarification request");
      throw error;
    }
    toast.success("Clarification request sent");
    load();
  };

  if (role !== "manager" && role !== "accountant" && role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-accent">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-lg font-semibold text-brand-dark">Pending Queue</h2>
      <p className="mb-6 text-accent">
        Approve, reject, or request clarification on PETTY SYNC requests. Rejections require a reason and are
        recorded in the audit trail.
      </p>

      {detailsRequestId && (
        <RequestDetailsDialog
          requestId={detailsRequestId}
          onClose={() => setDetailsRequestId(null)}
          role={role}
          onApprove={handleDetailsApprove}
          onReject={handleDetailsReject}
          onRequestClarification={handleRequestClarification}
        />
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="absolute inset-0"
            onClick={handleRejectCancel}
            onKeyDown={(e) => e.key === "Escape" && handleRejectCancel()}
            role="button"
            tabIndex={0}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md rounded-xl border border-slate-300 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-brand-dark">Reject Request</h3>
            <p className="mt-2 text-slate-600">
              Reject request from {rejectTarget.requester?.full_name ?? "unknown"} for{" "}
              {formatAmount(rejectTarget.amount)}?
            </p>
            <div className="mt-4">
              <label
                htmlFor="rejection-reason"
                className="block text-sm font-medium text-brand-dark"
              >
                Rejection reason (required)
              </label>
              <textarea
                id="rejection-reason"
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-brand-dark"
                placeholder="Enter reason for rejection"
                disabled={rejecting}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleRejectCancel}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={rejecting || !rejectionReason.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-300 bg-white shadow-md overflow-hidden">
        {requests.length === 0 ? (
          <p className="px-8 py-12 text-center text-accent">No pending requests</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                  Requester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                  Purpose
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setDetailsRequestId(r.id)}
                >
                  <td className="px-6 py-4 text-sm text-brand-dark">
                    {r.requester?.full_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-brand-dark">
                    {formatAmount(r.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-accent">{r.purpose ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-accent">{r.category ?? "—"}</td>
                  <td className="px-6 py-4">
                    {r.status === "clarification_requested" ? (
                      <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                        Awaiting clarification
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(r.id)}
                        disabled={approving === r.id}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {approving === r.id ? "Approving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectClick(r)}
                        disabled={approving === r.id}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailsRequestId(r.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PendingQueueView;
