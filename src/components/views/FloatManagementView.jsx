import React, { useState, useEffect, useCallback } from "react";
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

function FloatManagementView() {
  const { role } = useAuth();
  const [tab, setTab] = useState("float");
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const loadBalance = async () => {
    const { data } = await pettyCashApi.getCashFloat?.().catch(() => ({ data: null }));
    setBalance(typeof data === "number" ? data : 0);
    setLoading(false);
  };

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

  useEffect(() => {
    loadBalance();
  }, []);

  useEffect(() => {
    if (tab === "history") {
      loadHistory();
    }
  }, [tab, loadHistory]);

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const handleTopUp = async (e) => {
    e.preventDefault();
    const val = Number(amount);
    if (isNaN(val) || val <= 0) return;
    setSubmitting(true);
    const { error } = await pettyCashApi.updateCashFloat?.(val).catch((err) => ({
      error: err,
    }));
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Top-up failed");
      return;
    }
    toast.success("Float topped up");
    setAmount("");
    loadBalance();
    if (tab === "history") loadHistory();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-accent">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-brand-dark">Float Management</h2>
        <p className="mt-1 text-accent">
          Manage the cash float and review the PETTY SYNC activity log (disbursements, rejections, top-ups).
        </p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("float")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "float"
              ? "border-brand-dark text-brand-dark"
              : "border-transparent text-accent hover:text-brand-dark"
          }`}
        >
          Float & top-up
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "history"
              ? "border-brand-dark text-brand-dark"
              : "border-transparent text-accent hover:text-brand-dark"
          }`}
        >
          Activity log
        </button>
      </div>

      {tab === "float" && (
        <>
          <div className="mb-8 rounded-xl border border-slate-300 bg-white p-8 shadow-md">
            <p className="text-sm font-medium text-accent">Current Balance</p>
            <p className="mt-2 text-3xl font-semibold text-brand-dark">
              {formatAmount(balance ?? 0)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-300 bg-white p-6 shadow-md">
            <h3 className="mb-4 text-base font-medium text-brand-dark">Top up</h3>
            <form onSubmit={handleTopUp} className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-accent">Amount (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="mt-1 rounded-lg border border-slate-300 px-4 py-2 text-brand-dark"
                  disabled={submitting}
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !amount || Number(amount) <= 0}
                className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {submitting ? "Processing…" : "Top up"}
              </button>
            </form>
          </div>
        </>
      )}

      {tab === "history" && (
        <div className="rounded-xl border border-slate-300 bg-white shadow-md overflow-hidden">
          {historyLoading ? (
            <p className="px-8 py-12 text-center text-accent">Loading history…</p>
          ) : historyError ? (
            <p className="px-8 py-12 text-center text-red-600">{historyError}</p>
          ) : history.length === 0 ? (
            <p className="px-8 py-12 text-center text-accent">
              No entries yet. Top-ups, disbursements, and rejections will appear here.
            </p>
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
      )}
    </div>
  );
}

export default FloatManagementView;
