import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import AddUserModal from "../AddUserModal";
import * as pettyCashApi from "../../utils/pettyCashApi";
import { deleteUser } from "../../utils/userApi";
import { useAuth } from "../../context/AuthContext";

function UserManagementView() {
  const { role, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await pettyCashApi.listUsers?.();
      if (result?.error) {
        setError(result.error.message || "Failed to load users");
        setUsers([]);
      } else {
        setUsers(result?.data ?? []);
      }
    } catch (err) {
      setError(err?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const handleRoleChange = async (userId, newRole) => {
    setError(null);
    setUpdating(userId);
    const { error: err } = await pettyCashApi.updateUserRole?.(userId, newRole);
    setUpdating(null);
    if (err) {
      setError(err.message || "Failed to update role");
    } else {
      load();
    }
  };

  const handleDeleteClick = (u) => setDeleteTarget(u);
  const handleDeleteCancel = () => setDeleteTarget(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setError(null);
    setDeleting(deleteTarget.id);
    const { error: err } = await deleteUser(deleteTarget.id);
    setDeleting(null);
    setDeleteTarget(null);
    if (err) {
      setError(err.message || "Failed to delete user");
    } else {
      toast.success("User deleted successfully");
      load();
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-dark">User Management</h2>
          <p className="mt-1 text-slate-600">Add users and manage roles</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add new user
        </button>
      </div>

      <AddUserModal isOpen={addOpen} onClose={() => setAddOpen(false)} onSuccess={load} />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="absolute inset-0"
            onClick={handleDeleteCancel}
            onKeyDown={(e) => e.key === "Escape" && handleDeleteCancel()}
            role="button"
            tabIndex={0}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-brand-dark">Delete user</h3>
            <p className="mt-2 text-slate-600">
              Delete {deleteTarget.full_name ?? deleteTarget.email ?? "this user"}? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleDeleteCancel}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting === deleteTarget.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting === deleteTarget.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="px-8 py-12 text-center text-slate-500">Loading…</p>
        ) : error ? (
          <p className="px-8 py-12 text-center text-slate-500">Could not load users. See error above.</p>
        ) : users.length === 0 ? (
          <p className="px-8 py-12 text-center text-slate-500">No users</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Role
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-4 text-sm text-brand-dark">
                    {u.full_name ?? u.raw_user_meta_data?.full_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{u.email ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{u.role ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <select
                        value={u.role ?? ""}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={updating === u.id}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-brand-dark disabled:opacity-50"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="accountant">Accountant</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(u)}
                        disabled={u.id === currentUser?.id}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
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

export default UserManagementView;
