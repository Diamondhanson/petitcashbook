import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import * as pettyCashApi from "../../utils/pettyCashApi";
import { useAuth } from "../../context/AuthContext";

function formatAmount(n) {
  return (
    new Intl.NumberFormat("en-CA", { style: "decimal", minimumFractionDigits: 0 }).format(n) +
    " FCFA"
  );
}

function FloatManagementView() {
  const { role } = useAuth();
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await pettyCashApi.getCashFloat?.().catch(() => ({ data: null }));
    setBalance(typeof data === "number" ? data : 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const handleTopUp = async (e) => {
    e.preventDefault();
    const val = Number(amount);
    if (isNaN(val) || val <= 0) return;
    setSubmitting(true);
    await pettyCashApi.updateCashFloat?.(val);
    setSubmitting(false);
    setAmount("");
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-lg font-semibold text-brand-dark">Float Management</h2>
      <p className="mb-6 text-slate-600">
        View current cash float balance and add top-ups.
      </p>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Current Balance</p>
        <p className="mt-2 text-3xl font-semibold text-brand-dark">
          {formatAmount(balance ?? 0)}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-medium text-brand-dark">Top up</h3>
        <form onSubmit={handleTopUp} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600">Amount (FCFA)</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50000"
              className="mt-1 rounded-lg border border-slate-200 px-4 py-2 text-brand-dark"
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
    </div>
  );
}

export default FloatManagementView;
