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

function statusLabel(s) {
  const map = {
    pending: "Pending",
    clarification_requested: "Clarification needed",
    approved: "Approved",
    rejected: "Rejected",
    disbursed: "Disbursed"
  };
  return map[s] ?? s;
}

function statusClass(s) {
  const map = {
    pending: "bg-amber-100 text-amber-800",
    clarification_requested: "bg-orange-100 text-orange-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    disbursed: "bg-slate-100 text-slate-700"
  };
  return map[s] ?? "bg-slate-100 text-slate-700";
}

function MyRequestsView() {
  const { role } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsRequestId, setDetailsRequestId] = useState(null);

  const load = async () => {
    const { data } = await pettyCashApi.getMyRequests?.().catch(() => ({ data: [] }));
    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleProvideClarification = async (id, { response, attachmentFiles }) => {
    const { error } = await pettyCashApi.provideClarification?.(id, {
      response,
      attachmentFiles
    });
    if (error) {
      toast.error(error.message || "Failed to submit clarification");
      throw error;
    }
    toast.success("Clarification submitted");
    load();
  };

  if (role !== "employee") {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-lg font-semibold text-brand-dark">My Requests</h2>

      {detailsRequestId && (
        <RequestDetailsDialog
          requestId={detailsRequestId}
          onClose={() => setDetailsRequestId(null)}
          role="employee"
          onProvideClarification={handleProvideClarification}
        />
      )}
      <p className="mb-6 text-slate-600">
        View the status of your petty cash requests.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <p className="px-8 py-12 text-center text-slate-500">No requests yet</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Purpose
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Receipt
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {r.created_at?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-brand-dark">
                    {formatAmount(r.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{r.purpose ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{r.category ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(
                        r.status
                      )}`}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {r.receipt_url ? (
                      <a
                        href={r.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-dark underline hover:text-slate-700"
                      >
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setDetailsRequestId(r.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View details
                    </button>
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

export default MyRequestsView;
