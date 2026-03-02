import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import * as pettyCashApi from "../../utils/pettyCashApi";

const COLORS = ["#475569", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0", "#f1f5f9"];

function StatisticsView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pettyCashApi
      .getAnalyticsData?.()
      .then(({ byCategory }) => {
        setData(byCategory ?? []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        Loading…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-6 text-lg font-semibold text-brand-dark">Statistics</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No disbursed data to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-lg font-semibold text-brand-dark">Statistics</h2>
      <p className="mb-6 text-slate-600">Disbursed amounts by category</p>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
