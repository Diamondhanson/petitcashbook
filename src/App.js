import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import AppLayout from "./components/Layout/AppLayout";
import OverviewView from "./components/views/OverviewView";
import SubmitRequestView from "./components/views/SubmitRequestView";
import MyRequestsView from "./components/views/MyRequestsView";
import PendingQueueView from "./components/views/PendingQueueView";
import DisbursementsView from "./components/views/DisbursementsView";
import StatisticsView from "./components/views/StatisticsView";
import TrendsView from "./components/views/TrendsView";
import ExportView from "./components/views/ExportView";
import UserManagementView from "./components/views/UserManagementView";
import FloatManagementView from "./components/views/FloatManagementView";
import { useAuth } from "./context/AuthContext";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface font-sans text-brand-dark flex items-center justify-center">
        <div className="text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<OverviewView />} />
          <Route path="submit-request" element={<SubmitRequestView />} />
          <Route path="my-requests" element={<MyRequestsView />} />
          <Route path="pending" element={<PendingQueueView />} />
          <Route path="disbursements" element={<DisbursementsView />} />
          <Route path="statistics" element={<StatisticsView />} />
          <Route path="trends" element={<TrendsView />} />
          <Route path="export" element={<ExportView />} />
          <Route path="users" element={<UserManagementView />} />
          <Route path="float" element={<FloatManagementView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
