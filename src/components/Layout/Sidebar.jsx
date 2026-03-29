import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { path: "/", label: "Overview", roles: ["employee", "manager", "accountant", "admin"] },
  { path: "/submit-request", label: "Submit Request", roles: ["employee"] },
  { path: "/my-requests", label: "My Requests", roles: ["employee"] },
  { path: "/pending", label: "Pending Queue", roles: ["manager"] },
  { path: "/disbursements", label: "Paid out (admin)", roles: ["admin"] },
  { path: "/statistics", label: "Statistics", roles: ["accountant", "admin"] },
  { path: "/trends", label: "Trends", roles: ["accountant", "admin"] },
  { path: "/export", label: "Export", roles: ["accountant", "admin"] },
  { path: "/users", label: "User Management", roles: ["admin"] },
  { path: "/float", label: "Float Management", roles: ["admin"] },
  { path: "/cashier", label: "Cash desk", roles: ["cashier"] },
];

function Sidebar() {
  const { role } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) =>
    role ? item.roles.includes(role) : false
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[200px] border-r border-navy-light bg-navy shadow-md">
      <nav className="flex flex-col gap-1 p-4 pt-20">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-slate-300 hover:bg-navy-light hover:text-white"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
