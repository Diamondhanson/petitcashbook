import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
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

  return <Dashboard />;
}

export default App;
