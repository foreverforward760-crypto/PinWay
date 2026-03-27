/**
 * AppShell.jsx
 * Handles auth-gating: shows Login if not authenticated, otherwise renders the main app.
 */
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import PinWay from "./App";

export default function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(180deg, #020617, #0a0f1e)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-xl animate-pulse">
            P
          </div>
          <p className="text-slate-400 text-sm">Loading PinWay…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;
  return <PinWay />;
}
