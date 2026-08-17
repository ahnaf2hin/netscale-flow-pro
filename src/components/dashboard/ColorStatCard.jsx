import React from "react";

export default function ColorStatCard({ label, value, icon: Icon, bg, iconBg }) {
  return (
    <div className="group bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className="text-slate-900 text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className={`${iconBg || bg} w-10 h-10 rounded-lg flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-110`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}