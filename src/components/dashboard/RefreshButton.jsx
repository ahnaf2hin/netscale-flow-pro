import React from "react";
import { RefreshCw } from "lucide-react";

export default function RefreshButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
      <RefreshCw className="w-3.5 h-3.5" /> Refresh
    </button>
  );
}