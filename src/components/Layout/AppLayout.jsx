import React from "react";
import { Outlet } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "./Sidebar";

function AppLayout() {
  const { role } = useAuth();

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";

  return (
    <div className="min-h-screen bg-surface font-sans text-brand-dark">
      <Sidebar />

      <header className="sticky top-0 z-30 border-b border-navy-light bg-navy shadow-md pl-[200px]">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-white">PETTY SYNC</h1>
          <div className="flex items-center gap-4">
            <span
              className="rounded-md bg-white/15 px-3 py-1 text-xs font-medium text-white"
              data-testid="role-badge"
            >
              {roleLabel}
            </span>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="pl-[200px] p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
