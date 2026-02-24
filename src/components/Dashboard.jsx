import React, { useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../context/AuthContext";
import AddUserModal from "./AddUserModal";

const DEFAULT_SUMMARY_CARDS = [
  { label: "Total Balance", value: "FCFA 125,430", trend: "+2.4%" },
  { label: "Income (Month)", value: "FCFA 85,200", trend: "+12.1%" },
  { label: "Expenses (Month)", value: "FCFA 42,800", trend: "-5.3%" }
];

const DEFAULT_TRANSACTIONS = [
  { id: 1, description: "Grocery Store", amount: "-FCFA 3,240", date: "Feb 22" },
  { id: 2, description: "Salary Deposit", amount: "+FCFA 120,000", date: "Feb 20" },
  { id: 3, description: "Electric Bill", amount: "-FCFA 8,500", date: "Feb 18" },
  { id: 4, description: "Pharmacy", amount: "-FCFA 2,150", date: "Feb 21" },
  { id: 5, description: "Freelance Project", amount: "+FCFA 45,000", date: "Feb 21" },
  { id: 6, description: "Mobile Data", amount: "-FCFA 5,000", date: "Feb 20" },
  { id: 7, description: "Restaurant", amount: "-FCFA 7,800", date: "Feb 19" },
  { id: 8, description: "Taxi Fare", amount: "-FCFA 1,200", date: "Feb 19" },
  { id: 9, description: "Water Bill", amount: "-FCFA 4,200", date: "Feb 18" },
  { id: 10, description: "Rent Payment", amount: "-FCFA 35,000", date: "Feb 17" },
  { id: 11, description: "Petrol", amount: "-FCFA 12,000", date: "Feb 17" },
  { id: 12, description: "Consulting Fee", amount: "+FCFA 28,500", date: "Feb 16" },
  { id: 13, description: "Barber Shop", amount: "-FCFA 3,500", date: "Feb 16" },
  { id: 14, description: "Market Shopping", amount: "-FCFA 9,400", date: "Feb 15" },
  { id: 15, description: "Bank Transfer (Gift)", amount: "+FCFA 15,000", date: "Feb 14" },
  { id: 16, description: "Internet Service", amount: "-FCFA 18,000", date: "Feb 13" },
  { id: 17, description: "Taxi (airport)", amount: "-FCFA 6,500", date: "Feb 12" },
  { id: 18, description: "Commission Earned", amount: "+FCFA 22,000", date: "Feb 11" },
  { id: 19, description: "Gas Cylinder", amount: "-FCFA 14,200", date: "Feb 10" },
  { id: 20, description: "Savings Withdrawal", amount: "+FCFA 50,000", date: "Feb 9" }
];

/**
 * Dashboard - Financial overview component
 * Uses design system: brand-dark (text), surface (bg), Inter font
 * Cards: border-slate-200, rounded-xl, shadow
 *
 * @param {Object} props
 * @param {Array} props.summaryCards - Optional. Balance, income, expenses.
 * @param {Array} props.transactions - Optional. Recent transaction list.
 */
function Dashboard({
  summaryCards = DEFAULT_SUMMARY_CARDS,
  transactions = DEFAULT_TRANSACTIONS
}) {
  const { role } = useAuth();
  const [addUserOpen, setAddUserOpen] = useState(false);

  const isAdmin = role === "admin";

  return (
    <div className="min-h-screen bg-surface font-sans text-brand-dark">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-12 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand-dark">
              Cash Book
            </h1>
            <p className="mt-2 text-slate-600">
              Your financial overview at a glance
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setAddUserOpen(true)}
                className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Add new user
              </button>
            )}
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </header>

        <AddUserModal
          isOpen={addUserOpen}
          onClose={() => setAddUserOpen(false)}
        />

        <section className="mb-16">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-4 text-2xl font-semibold text-brand-dark">
                  {card.value}
                </p>
                <span
                  className={`mt-2 inline-block text-sm ${
                    card.trend.startsWith("+")
                      ? "text-emerald-600"
                      : "text-slate-600"
                  }`}
                >
                  {card.trend} vs last month
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-6 text-lg font-semibold text-brand-dark">
            Recent Transactions
          </h2>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between px-8 py-6"
                >
                  <div>
                    <p className="font-medium text-brand-dark">
                      {tx.description}
                    </p>
                    <p className="text-sm text-slate-500">{tx.date}</p>
                  </div>
                  <span
                    className={`font-medium ${
                      tx.amount.startsWith("+")
                        ? "text-emerald-600"
                        : "text-brand-dark"
                    }`}
                  >
                    {tx.amount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
