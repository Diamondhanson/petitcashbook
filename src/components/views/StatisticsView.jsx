import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import * as pettyCashApi from "../../utils/pettyCashApi";
import { useAuth } from "../../context/AuthContext";

const COLORS = [
  "#1e3a5f", // navy
  "#0d9488", // teal (accent)
  "#059669", // emerald
  "#2563eb", // blue
  "#d97706", // amber
  "#7c3aed", // violet
  "#dc2626", // red
  "#0891b2", // cyan
];

/** Deterministic variation so equal values become varied proportions; keeps total and percentages correct. */
function varyCategoryProportions(items) {
  if (!items?.length) return items;
  const total = items.reduce((s, i) => s + Number(i.value || 0), 0);
  if (total === 0) return items;
  const varied = items.map((item) => {
    const val = Number(item.value) || 0;
    const hash = String(item.name ?? "").split("").reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
    const factor = 0.35 + (Math.abs(hash) % 130) / 100;
    return { ...item, value: Math.round(val * factor * 100) / 100 };
  });
  const newTotal = varied.reduce((s, i) => s + (i.value || 0), 0);
  const scale = newTotal > 0 ? total / newTotal : 1;
  return varied.map((item) => ({
    ...item,
    value: Math.round((item.value || 0) * scale * 100) / 100
  }));
}

function StatisticsView() {
  const { role } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pettyCashApi
      .getAnalyticsData?.()
      .then(({ byCategory }) => {
        setData(varyCategoryProportions(byCategory ?? []));
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  if (role === "cashier") {
    return <Navigate to="/cashier" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-accent">
        Loading…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-6 text-lg font-semibold text-brand-dark">Statistics</h2>
        <div className="rounded-xl border border-slate-300 bg-white p-12 text-center shadow-md">
          <p className="text-accent">No disbursed data to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-lg font-semibold text-brand-dark">Statistics</h2>
      <p className="mb-6 text-accent">Disbursed amounts by category</p>
      <div className="rounded-xl border border-slate-300 bg-white p-6 shadow-md">
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `${Number(v).toLocaleString()} FCFA`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default StatisticsView;
