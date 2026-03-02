import React, { useState, useEffect } from "react";
import * as pettyCashApi from "../../utils/pettyCashApi";

const DEFAULT_CARDS = [
  { label: "Total Balance", value: "FCFA 0", trend: null },
  { label: "Pending", value: "FCFA 0", trend: null },
  { label: "Disbursed (Month)", value: "FCFA 0", trend: null },
];

function formatAmount(n) {
  return new Intl.NumberFormat("en-CA", {
    style: "decimal",
    minimumFractionDigits: 0,
  }).format(n) + " FCFA";
}

function OverviewView() {
  const [cards, setCards] = useState(DEFAULT_CARDS);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [floatRes, pendingRes, analyticsRes] = await Promise.all([
        pettyCashApi.getCashFloat?.().catch(() => ({ data: 0 })),
        pettyCashApi.getPendingRequests?.().catch(() => ({ data: [] })),
        pettyCashApi.getAnalyticsData?.({
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          endDate: new Date().toISOString(),
        }).catch(() => ({ byCategory: [], byDate: [], error: null })),
      ]);

      if (!mounted) return;

      const balance = (floatRes?.data != null && !floatRes?.error) ? floatRes.data : 0;
      const pending = (pendingRes?.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const disbursed = (analyticsRes?.byDate ?? []).reduce((s, d) => s + Number(d.amount || 0), 0);

      setCards([
        { label: "Total Balance", value: formatAmount(balance), trend: null },
        { label: "Pending", value: formatAmount(pending), trend: null },
        { label: "Disbursed (Month)", value: formatAmount(disbursed), trend: null },
      ]);

      const approved = await pettyCashApi.getApprovedRequests?.().catch(() => ({ data: [] })) ?? { data: [] };
      const recent = ((approved && approved.data) ? approved.data : []).slice(0, 15).map((r) => ({
        id: r.id,
        description: r.purpose,
        amount: `-${formatAmount(r.amount)}`,
        date: r.created_at?.slice(0, 10) ?? "",
      }));
      setTransactions(recent);
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <section className="mb-12">
        <h2 className="mb-6 text-lg font-semibold text-brand-dark">Overview</h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="mt-4 text-2xl font-semibold text-brand-dark">{card.value}</p>
              {card.trend && (
                <span
                  className={`mt-2 inline-block text-sm ${
                    card.trend.startsWith("+") ? "text-emerald-600" : "text-slate-600"
                  }`}
                >
                  {card.trend} vs last month
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-lg font-semibold text-brand-dark">Recent Activity</h2>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {transactions.length === 0 ? (
            <p className="px-8 py-12 text-center text-slate-500">No recent activity</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between px-8 py-6"
                >
                  <div>
                    <p className="font-medium text-brand-dark">{tx.description}</p>
                    <p className="text-sm text-slate-500">{tx.date}</p>
                  </div>
                  <span className="font-medium text-brand-dark">{tx.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default OverviewView;
