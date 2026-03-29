import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import * as pettyCashApi from "../../utils/pettyCashApi";
import { useAuth } from "../../context/AuthContext";

const REQUEST_CATEGORIES = pettyCashApi.REQUEST_CATEGORIES ?? [
  "Office",
  "Travel",
  "Food",
  "Supplies",
  "Utilities",
  "Miscellaneous"
];

function SubmitRequestView() {
  const { role } = useAuth();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [category, setCategory] = useState(REQUEST_CATEGORIES[0] ?? "Office");
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    if (!purpose.trim()) {
      setError("Purpose is required");
      return;
    }
    setSubmitting(true);
    const { data, error: err } = await pettyCashApi.createRequest?.({
      amount: amt,
      purpose: purpose.trim(),
      category,
      receiptFile: receiptFile || null
    });
    setSubmitting(false);
    if (err) {
      setError(err.message || "Failed to submit request");
      return;
    }
    if (data?.reference_code) {
      toast.success(`Request submitted. Your reference: ${data.reference_code}`);
    } else {
      toast.success("Request submitted successfully");
    }
    setAmount("");
    setPurpose("");
    setCategory(REQUEST_CATEGORIES[0] ?? "Office");
    setReceiptFile(null);
  };

  if (role !== "employee") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-lg font-semibold text-brand-dark">Submit Request</h2>
      <p className="mb-6 text-accent">
        Submit a petty cash request. Attach a receipt if available.
      </p>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-300 bg-white p-6 shadow-md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-brand-dark">
              Amount (FCFA)
            </label>
            <input
              id="amount"
              type="number"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-brand-dark"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="purpose" className="block text-sm font-medium text-brand-dark">
              Purpose
            </label>
            <textarea
              id="purpose"
              rows={3}
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-brand-dark"
              placeholder="Describe the reason for this request"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-brand-dark">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-brand-dark"
              disabled={submitting}
            >
              {REQUEST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="receipt" className="block text-sm font-medium text-brand-dark">
              Receipt (optional)
            </label>
            <input
              id="receipt"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-dark file:px-4 file:py-2 file:text-sm file:text-white"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-dark px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SubmitRequestView;
