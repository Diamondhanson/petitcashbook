import React, { useState, useEffect } from "react";
import * as pettyCashApi from "../../utils/pettyCashApi";

function formatAmount(n) {
  return (
    new Intl.NumberFormat("en-CA", { style: "decimal", minimumFractionDigits: 0 }).format(n) +
    " FCFA"
  );
}

function DisbursementsView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disbursing, setDisbursing] = useState(null);

  const load = async () => {
    const { data } = await pettyCashApi.getApprovedRequests?.().catch(() => ({ data: [] }));
    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDisburse = async (id) => {
    setDisbursing(id);
    const { error } = await pettyCashApi.updateRequestStatus?.(id, { status: "disbursed" });
    setDisbursing(null);
    if (!error) load();
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
      <h2 className="mb-6 text-lg font-semibold text-brand-dark">Disbursements</h2>
      <p className="mb-6 text-slate-600">
        Approved requests ready for disbursement. Click &quot;Disburse&quot; to mark as paid.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <p className="px-8 py-12 text-center text-slate-500">No approved requests</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Requester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Purpose
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-4 text-sm text-brand-dark">
                    {r.requester?.full_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{r.purpose}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{r.category}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-brand-dark">
                    {formatAmount(r.amount)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDisburse(r.id)}
                      disabled={disbursing === r.id}
                      className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {disbursing === r.id ? "Processing…" : "Disburse"}
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
