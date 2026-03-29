import React, { useState, useEffect, useCallback, useMemo } from "react";
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

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const TABS = [
  { id: "payout", label: "Pay out" },
  { id: "topup", label: "Top up" },
  { id: "history", label: "Cash book" },
];

function CashierView() {
  const { role } = useAuth();
  const [tab, setTab] = useState("payout");
  const [balance, setBalance] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [refFilter, setRefFilter] = useState("");
  const [lookupRef, setLookupRef] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [topups, setTopups] = useState([]);
  const [topupsLoading, setTopupsLoading] = useState(false);
  const [topupsError, setTopupsError] = useState(null);

  const loadBalance = useCallback(async () => {
    const { data } = await pettyCashApi.getCashFloat?.().catch(() => ({ data: null }));
    setBalance(typeof data === "number" ? data : 0);
  }, []);

  const loadRequests = useCallback(async () => {
    const { data } = await pettyCashApi.getApprovedRequests?.().catch(() => ({ data: [] }));
    setRequests(data ?? []);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryError(null);
    setHistoryLoading(true);
    const { data, error } = await pettyCashApi.getAdminCashbookHistory?.().catch((err) => ({
      data: [],
      error: err,
    }));
    setHistoryLoading(false);
    if (error) {
      setHistoryError(error.message || "Failed to load history");
      setHistory([]);
      return;
    }
    setHistory(data ?? []);
  }, []);

  const loadTopups = useCallback(async () => {
    setTopupsError(null);
    setTopupsLoading(true);
    const { data, error } = await pettyCashApi.listFloatTopups?.().catch((err) => ({
      data: [],
      error: err,
    }));
    setTopupsLoading(false);
    if (error) {
      setTopupsError(error.message || "Failed to load top-ups");
      setTopups([]);
      return;
    }
    setTopups(data ?? []);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadBalance(), loadRequests(), loadHistory()]);
  }, [loadBalance, loadRequests, loadHistory]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadBalance(), loadRequests()]);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [loadBalance, loadRequests]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  useEffect(() => {
    if (tab === "topup") loadTopups();
  }, [tab, loadTopups]);

  const filteredRequests = useMemo(() => {
    const q = refFilter.trim().toUpperCase();
    if (!q) return requests;
    return requests.filter((r) =>
      String(r.reference_code || "")
        .toUpperCase()
        .includes(q)
    );
  }, [requests, refFilter]);

  const handleLookup = async (e) => {
    e?.preventDefault?.();
    setLookupError(null);
    setLookupResult(null);
    const code = lookupRef.trim();
    if (!code) {
      setLookupError("Enter a reference code");
      return;
    }
    setLookupLoading(true);
    const { data, error } = await pettyCashApi.getApprovedRequestByReferenceCode(code);
    setLookupLoading(false);
    if (error) {
      setLookupError(error.message || "Lookup failed");
      return;
    }
    setLookupResult(data);
  };

  const handlePaidOut = async (id) => {
    if (!id) return;
    setPayingId(id);
    try {
      const { error } = await pettyCashApi.updateRequestStatus?.(id, { status: "disbursed" });
      setPayingId(null);
      if (error) {
        toast.error(error.message || "Could not mark as paid out");
        return;
      }
      toast.success("Marked as paid out");
      setLookupResult((prev) => (prev?.id === id ? null : prev));
      await Promise.all([loadBalance(), loadRequests()]);
      if (tab === "history") await loadHistory();
    } catch (err) {
      setPayingId(null);
      toast.error(err?.message || "Could not mark as paid out");
    }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    const val = Number(topupAmount);
    if (isNaN(val) || val <= 0) return;
    setTopupSubmitting(true);
    const { error } = await pettyCashApi.updateCashFloat?.(val).catch((err) => ({ error: err }));
    setTopupSubmitting(false);
    if (error) {
      toast.error(error.message || "Top-up failed");
      return;
    }
    toast.success("Float topped up");
    setTopupAmount("");
    await loadBalance();
    await loadTopups();
  };

  if (role !== "cashier") {
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
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-brand-dark">Cash desk</h2>
        <p className="mt-1 text-accent">
          Verify references, mark paid out, top up the float, or review the cash book.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
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

      {tab === "payout" && (
        <>
          <section className="rounded-xl border border-slate-300 bg-white p-8 shadow-md">
            <p className="text-sm font-medium text-accent">Current balance</p>
            <p className="mt-2 text-3xl font-semibold text-brand-dark">
              {formatAmount(balance ?? 0)}
            </p>
          </section>

          <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-md">
            <h3 className="mb-4 text-base font-medium text-brand-dark">Look up by reference</h3>
            <form onSubmit={handleLookup} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="lookup-ref" className="block text-sm font-medium text-accent">
                  Reference (e.g. PC-100042)
                </label>
                <input
                  id="lookup-ref"
                  type="text"
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono text-brand-dark uppercase"
                  placeholder="PC-100042"
                  disabled={lookupLoading}
                />
              </div>
              <button
                type="submit"
                disabled={lookupLoading}
                className="rounded-lg bg-brand-dark px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {lookupLoading ? "Checking…" : "Verify"}
              </button>
            </form>
            {lookupError && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {lookupError}
              </p>
            )}
            {lookupResult && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-brand-dark">
                  Match: {lookupResult.reference_code}
                </p>
                <p className="mt-1 text-sm text-accent">
                  {lookupResult.requester?.full_name ?? "—"} · {formatAmount(lookupResult.amount)}
                </p>
                <p className="mt-1 text-sm text-accent">{lookupResult.purpose}</p>
                <button
                  type="button"
                  onClick={() => handlePaidOut(lookupResult.id)}
                  disabled={payingId === lookupResult.id}
                  className="mt-4 rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {payingId === lookupResult.id ? "Processing…" : "Paid out"}
                </button>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-4 text-base font-medium text-brand-dark">Approved — ready to pay out</h3>
            <div className="mb-4">
              <label htmlFor="filter-ref" className="sr-only">
                Filter by reference
              </label>
              <input
                id="filter-ref"
                type="text"
                value={refFilter}
                onChange={(e) => setRefFilter(e.target.value)}
                placeholder="Filter list by reference…"
                className="w-full max-w-md rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm text-brand-dark"
              />
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
              {filteredRequests.length === 0 ? (
                <p className="px-8 py-12 text-center text-accent">
                  {requests.length === 0
                    ? "No approved requests waiting for payout."
                    : "No rows match this filter."}
                </p>
              ) : (
                <div className="overflow-x-auto">
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
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-brand-dark">
                            {formatAmount(r.amount)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handlePaidOut(r.id)}
                              disabled={payingId === r.id}
                              className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                            >
                              {payingId === r.id ? "Processing…" : "Paid out"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "topup" && (
        <>
          <section className="rounded-xl border border-slate-300 bg-white p-8 shadow-md">
            <p className="text-sm font-medium text-accent">Current balance</p>
            <p className="mt-2 text-3xl font-semibold text-brand-dark">
              {formatAmount(balance ?? 0)}
            </p>
          </section>

          <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-md">
            <h3 className="mb-4 text-base font-medium text-brand-dark">Add cash to the float</h3>
            <form onSubmit={handleTopUp} className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="topup-amt" className="block text-sm font-medium text-accent">
                  Amount (FCFA)
                </label>
                <input
                  id="topup-amt"
                  type="number"
                  min="1"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="mt-1 rounded-lg border border-slate-300 px-4 py-2 text-brand-dark"
                  disabled={topupSubmitting}
                />
              </div>
              <button
                type="submit"
                disabled={topupSubmitting || !topupAmount || Number(topupAmount) <= 0}
                className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {topupSubmitting ? "Processing…" : "Top up"}
              </button>
            </form>
          </section>

          <section>
            <h3 className="mb-4 text-base font-medium text-brand-dark">Recent top-ups</h3>
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
              {topupsLoading ? (
                <p className="px-8 py-12 text-center text-accent">Loading…</p>
              ) : topupsError ? (
                <p className="px-8 py-12 text-center text-red-600">{topupsError}</p>
              ) : topups.length === 0 ? (
                <p className="px-8 py-12 text-center text-accent">No top-ups recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                          By
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">
                          Added
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">
                          Balance after
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {topups.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-accent">
                            {formatDateTime(row.created_at)}
                          </td>
                          <td className="px-6 py-4 text-sm text-brand-dark">
                            {row.performer_name ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-emerald-700">
                            +{formatAmount(Number(row.amount_added))}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-brand-dark">
                            {formatAmount(Number(row.balance_after))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "history" && (
        <section>
          <h3 className="mb-4 text-base font-medium text-brand-dark">Petty cash book (history)</h3>
          <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
            {historyLoading ? (
              <p className="px-8 py-12 text-center text-accent">Loading history…</p>
            ) : historyError ? (
              <p className="px-8 py-12 text-center text-red-600">{historyError}</p>
            ) : history.length === 0 ? (
              <p className="px-8 py-12 text-center text-accent">No history entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-accent">
                        Details
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-accent">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {history.map((row, idx) => (
                      <tr key={`${row.kind}-${row.at}-${idx}`}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-accent">
                          {formatDateTime(row.at)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-brand-dark">{row.title}</td>
                        <td className="max-w-md px-6 py-4 text-sm text-accent">{row.detail}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          {row.kind === "rejection" ? (
                            <span className="text-slate-500">
                              {formatAmount(Math.abs(Number(row.meta?.requested_amount ?? 0)))}{" "}
                              <span className="text-xs font-normal">(not paid)</span>
                            </span>
                          ) : row.amountSigned > 0 ? (
                            <span className="text-emerald-700">+{formatAmount(row.amountSigned)}</span>
                          ) : (
                            <span className="text-red-700">−{formatAmount(Math.abs(row.amountSigned))}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default CashierView;
