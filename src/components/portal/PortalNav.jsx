import React from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Wifi, LogOut } from "lucide-react";

export default function PortalNav({ customerName, email }) {
  const location = useLocation();
  const handleLogout = () => base44.auth.logout("/portal/login");

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-100">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/portal/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center"><Wifi className="w-5 h-5 text-white" /></div>
          <div className="hidden sm:block">
            <p className="font-bold text-slate-900 text-sm leading-tight">Customer Portal</p>
            <p className="text-[10px] text-slate-400">KG Soft Internet</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-slate-700 leading-tight">{customerName || "Customer"}</p>
            <p className="text-[10px] text-slate-400">{email}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm">
            {(customerName || "C").charAt(0).toUpperCase()}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-slate-50">
            <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}