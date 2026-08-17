import React from "react";
import { Outlet } from "react-router-dom";
import { Store, LogOut } from "lucide-react";
import { netscaleApi } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

export default function ResellerLayout() {
  const { user } = useAuth();
  const handleLogout = () => netscaleApi.auth.logout("/login");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-amber-50/40 dark:from-zinc-950 dark:via-zinc-950 dark:to-amber-950/20">
      <header className="glass sticky top-0 z-40 rounded-none border-x-0 border-t-0">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">Reseller Panel</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">{user?.full_name || user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
