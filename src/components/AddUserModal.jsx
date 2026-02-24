import React, { useState, useEffect } from "react";
import { createUser, getNextEmployeeId } from "../utils/userApi";

const ROLES = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "admin", label: "Admin" },
];

function AddUserModal({ isOpen, onClose, onSuccess }) {
  const [employeeId, setEmployeeId] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("employee");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [idLoading, setIdLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("employee");
    setIdLoading(true);
    setEmployeeId(null);

    getNextEmployeeId()
      .then(({ data }) => {
        setEmployeeId(data ?? 10000);
      })
      .catch(() => setEmployeeId(10000))
      .finally(() => setIdLoading(false));
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: err } = await createUser({
      email,
      password,
      full_name: fullName.trim(),
      role,
    });

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSuccess?.(data);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-brand-dark">Add new user</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create a user account with email and password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-brand-dark">
              User ID
            </label>
            <div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-brand-dark">
              {idLoading ? (
                <span className="text-slate-500">Generating…</span>
              ) : (
                <span className="font-mono font-medium">{employeeId}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Auto-generated 5-digit code
            </p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-brand-dark">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-brand-dark placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              placeholder="user@company.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-brand-dark">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-brand-dark placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              placeholder="••••••••"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-slate-500">Minimum 6 characters</p>
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-brand-dark">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-brand-dark placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              placeholder="John Doe"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-brand-dark">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-brand-dark focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              disabled={loading}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || idLoading}
              className="flex-1 rounded-lg bg-brand-dark px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddUserModal;
