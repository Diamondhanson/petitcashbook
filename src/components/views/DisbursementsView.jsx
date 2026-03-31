import React, { useState, useEffect, useMemo, useCallback } from "react";
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

const TABS = [
  { id: "disburse", label: "To disburse" },
  { id: "history", label: "History" },
];

function DisbursementsView() {
  const { role } = useAuth();
  const [tab, setTab] = useState("disburse");
  const [toDisburse, setToDisburse] = useState([]);
  const [awaitingCashier, setAwaitingCashier] = useState([]);
  const [paidOut, setPaidOut] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [refFilter, setRefFilter] = useState("");

  const loadToDisburse = useCallback(async () => {
    const { data } = await pettyCashApi.getAwaitingDisbursementRequests?.().catch(() => ({ data: [] }));
    setToDisburse(data ?? []);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const [rel, dis] = await Promise.all([
      pettyCashApi.getReleasedForPayoutRequests?.().catch(() => ({ data: [] })),
      pettyCashApi.getDisbursedRequestsRecent?.({ limit: 500 }).catch(() => ({ data: [] })),
    ]);
    setAwaitingCashier(rel?.data ?? []);
    setPaidOut(dis?.data ?? []);
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await loadToDisburse();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [loadToDisburse]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  const filteredToDisburse = useMemo(() => {
    const q = refFilter.trim().toUpperCase();
    if (!q) return toDisburse;
    return toDisburse.filter((r) =>
      String(r.reference_code || "")
        .toUpperCase()
        .includes(q)
    );
  }, [toDisburse, refFilter]);

  const filteredAwaiting = useMemo(() => {
    const q = refFilter.trim().toUpperCase();
    if (!q) return awaitingCashier;
    return awaitingCashier.filter((r) =>
      String(r.reference_code || "")
        .toUpperCase()
        .includes(q)
    );
  }, [awaitingCashier, refFilter]);

  const filteredPaidOut = useMemo(() => {
    const q = refFilter.trim().toUpperCase();
    if (!q) return paidOut;
    return paidOut.filter((r) =>
      String(r.reference_code || "")
        .toUpperCase()
        .includes(q)
    );
  }, [paidOut, refFilter]);

  const handleDisburse = async (id) => {
    if (!id) return;
    setActionId(id);
    try {
      const { error } = await pettyCashApi.updateRequestStatus?.(id, { status: "released" });
      setActionId(null);
      if (error) {
        toast.error(error.message || "Could not disburse");
        return;
      }
      toast.success("Released for cash pickup");
      await loadToDisburse();
      if (tab === "history") await loadHistory();
    } catch (err) {
      setActionId(null);
      toast.error(err?.message || "Could not disburse");
    }
  };

  if (role !== "accountant" && role !== "admin") {
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
      <h2 className="mb-2 text-lg font-semibold text-brand-dark">Disbursements</h2>
      <p className="mb-6 text-accent">
        Release manager-approved requests to the cash desk. Cashiers can only pay out after you disburse
        here. Use <strong>History</strong> to see what is awaiting the cashier and what is already paid out.
      </p>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-brand-dark text-brand-dark"
                : "border-transparent text-accent hover:text-brand-dark"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <label htmlFor="disb-ref-filter" className="sr-only">
          Filter by reference
        </label>
        <input
          id="disb-ref-filter"
          type="text"
          value={refFilter}
          onChange={(e) => setRefFilter(e.target.value)}
          placeholder="Filter by reference…"
          className="w-full max-w-md rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm text-brand-dark"
        />
      </div>

      {tab === "disburse" && (
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
          {filteredToDisburse.length === 0 ? (
            <p className="px-8 py-12 text-center text-accent">
              {toDisburse.length === 0
                ? "No manager-approved requests waiting for disbursement."
                : "No rows match this filter."}
            </p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">Requester</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">Purpose</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredToDisburse.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-sm font-medium text-brand-dark">
                      {r.reference_code ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-brand-dark">{r.requester?.full_name ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-accent">{r.purpose}</td>
                    <td className="px-6 py-4 text-sm text-accent">{r.category}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-brand-dark">
                      {formatAmount(r.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDisburse(r.id)}
                        disabled={actionId === r.id}
                        className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        {actionId === r.id ? "Processing…" : "Disburse"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-10">
          {historyLoading ? (
            <p className="py-12 text-center text-accent">Loading history…</p>
          ) : (
            <>
              <section>
                <h3 className="mb-4 text-base font-medium text-brand-dark">Awaiting cashier</h3>
                <p className="mb-4 text-sm text-accent">
                  Released to the desk; cash has not been marked paid out yet.
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
                  {filteredAwaiting.length === 0 ? (
                    <p className="px-8 py-12 text-center text-accent">
                      {awaitingCashier.length === 0
                        ? "Nothing waiting at the cash desk."
                        : "No rows match this filter."}
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
                          <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredAwaiting.map((r) => (
                          <tr key={r.id}>
                            <td className="whitespace-nowrap px-6 py-4 font-mono text-sm font-medium text-brand-dark">
                              {r.reference_code ?? "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-brand-dark">
                              {r.requester?.full_name ?? "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-accent">{r.purpose}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-brand-dark">
                              {formatAmount(r.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-base font-medium text-brand-dark">Paid out</h3>
                <p className="mb-4 text-sm text-accent">Cashier completed payout (float was reduced).</p>
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
                  {filteredPaidOut.length === 0 ? (
                    <p className="px-8 py-12 text-center text-accent">
                      {paidOut.length === 0 ? "No paid-out requests yet." : "No rows match this filter."}
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
                          <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredPaidOut.map((r) => (
                          <tr key={r.id}>
                            <td className="whitespace-nowrap px-6 py-4 font-mono text-sm font-medium text-brand-dark">
                              {r.reference_code ?? "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-brand-dark">
                              {r.requester?.full_name ?? "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-accent">{r.purpose}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-brand-dark">
                              {formatAmount(r.amount)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-accent">
                              {r.created_at?.slice(0, 10) ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default DisbursementsView;
