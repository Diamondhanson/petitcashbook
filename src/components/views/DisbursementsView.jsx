import React, { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import * as pettyCashApi from "../../utils/pettyCashApi";
import { useAuth } from "../../context/AuthContext";

function formatAmount(n) {
  return (
    new Intl.NumberFormat("en-CA", { style: "decimal", minimumFractionDigits: 0 }).format(n) +
    " FCFA"
  );
}

function DisbursementsView() {
  const { role } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disbursing, setDisbursing] = useState(null);
  const [refFilter, setRefFilter] = useState("");

  const load = async () => {
    const { data } = await pettyCashApi.getApprovedRequests?.().catch(() => ({ data: [] }));
    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRequests = useMemo(() => {
    const q = refFilter.trim().toUpperCase();
    if (!q) return requests;
    return requests.filter((r) =>
      String(r.reference_code || "")
        .toUpperCase()
        .includes(q)
    );
  }, [requests, refFilter]);

  const handlePaidOut = async (id) => {
    if (!id) return;
    setDisbursing(id);
    try {
      const { error } = await pettyCashApi.updateRequestStatus?.(id, { status: "disbursed" });
      setDisbursing(null);
      if (error) {
        toast.error(error.message || "Failed to mark as paid out");
        return;
      }
      toast.success("Marked as paid out");
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "disbursed" } : r))
      );
    } catch (err) {
      setDisbursing(null);
      toast.error(err?.message || "Failed to mark as paid out");
    }
  };

  if (role !== "admin") {
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
      <h2 className="mb-6 text-lg font-semibold text-brand-dark">Paid out (admin)</h2>
      <p className="mb-6 text-accent">
        Override: approved requests ready for payout. Use the cash desk for normal payouts. Click
        &quot;Paid out&quot; after cash has been handed over.
      </p>
      <div className="mb-4">
        <label htmlFor="admin-ref-filter" className="sr-only">
          Filter by reference
        </label>
        <input
          id="admin-ref-filter"
          type="text"
          value={refFilter}
          onChange={(e) => setRefFilter(e.target.value)}
          placeholder="Filter by reference…"
          className="w-full max-w-md rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm text-brand-dark"
        />
      </div>
      <div className="rounded-xl border border-slate-300 bg-white shadow-md overflow-hidden">
        {filteredRequests.length === 0 ? (
          <p className="px-8 py-12 text-center text-accent">
            {requests.length === 0 ? "No approved requests" : "No rows match this filter."}
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                  Requester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                  Purpose
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRequests.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-sm font-medium text-brand-dark">
                    {r.reference_code ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-brand-dark">
                    {r.requester?.full_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-accent">{r.purpose}</td>
                  <td className="px-6 py-4 text-sm text-accent">{r.category}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-brand-dark">
                    {formatAmount(r.amount)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handlePaidOut(r.id)}
                      disabled={disbursing === r.id || r.status === "disbursed"}
                      className={
                        r.status === "disbursed"
                          ? "rounded-lg bg-slate-300 px-4 py-2 text-sm font-medium text-slate-600 cursor-not-allowed"
                          : "rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                      }
                    >
                      {disbursing === r.id
                        ? "Processing…"
                        : r.status === "disbursed"
                          ? "Paid out"
                          : "Paid out"}
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

export default DisbursementsView;
