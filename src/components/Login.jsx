import React, { useState } from "react";
import { supabase } from "../utils/supabaseClient";

/**
 * Login form - no sign-up. Users are created by admin.
 * Admin: email + password only (managers, accountants, admins).
 * Employee: User ID + email + password — verifies employee_id matches after auth (employees and cashiers).
 */
function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState("employee"); // "admin" | "employee"
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let authUser;
    let authError;
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      authUser = result.data?.user;
      authError = result.error;
    } catch (err) {
      setLoading(false);
      const msg = err?.message || String(err);
      const isNetworkError =
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Load failed") ||
        msg.includes("Network request failed");
      setError(
        isNetworkError
          ? "Cannot reach the server. If you just unpaused your Supabase project, wait 1–2 minutes and try again."
          : msg
      );
      return;
    }

    if (authError) {
      setLoading(false);
      const msg = authError.message || "";
      const isNetworkError =
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Load failed") ||
        msg.includes("Network request failed");
      setError(
        isNetworkError
          ? "Cannot reach the server. If you just unpaused your Supabase project, wait 1–2 minutes and try again."
          : msg
      );
      return;
    }

    if (mode === "employee") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", authUser.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setLoading(false);
        setError("Could not verify user. Please try again.");
        return;
      }

      const enteredId = parseInt(userId.trim(), 10);
      if (profile.employee_id == null || profile.employee_id !== enteredId) {
        await supabase.auth.signOut();
        setLoading(false);
        setError("User ID does not match");
        return;
      }
    }

    setLoading(false);
    onLoginSuccess?.();
  };

  return (
    <div className="min-h-screen bg-surface font-sans text-brand-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-300 bg-white p-8 shadow-md">
          <h1 className="text-2xl font-semibold tracking-tight text-brand-dark">
            Petit Cash Book
          </h1>
          <p className="mt-2 text-sm text-accent">
            Sign in with your credentials
          </p>

          <div className="mt-6 flex rounded-lg border border-slate-300 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("admin")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === "admin"
                  ? "bg-white text-brand-dark shadow-sm"
                  : "text-slate-600 hover:text-brand-dark"
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setMode("employee")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === "employee"
                  ? "bg-white text-brand-dark shadow-sm"
                  : "text-slate-600 hover:text-brand-dark"
              }`}
            >
              Employee
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}

            {mode === "employee" && (
              <div>
                <label
                  htmlFor="userId"
                  className="block text-sm font-medium text-brand-dark"
                >
                  User ID
                </label>
                <input
                  id="userId"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required={mode === "employee"}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-brand-dark placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  placeholder="12345"
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-brand-dark"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-brand-dark placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-brand-dark"
              >
                Password
              </label>
              <div className="relative mt-2">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-brand-dark placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                      aria-hidden
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                      aria-hidden
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-dark px-4 py-3 font-medium text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
