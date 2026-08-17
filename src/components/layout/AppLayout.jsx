import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/60 dark:from-zinc-950 dark:via-zinc-950 dark:to-blue-950/30">
      <Sidebar />
      <main className="flex-1 min-w-0 lg:pl-0 pl-0">
        <div className="pt-16 lg:pt-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}