import React from "react";
import { Zap, Clock, DollarSign, Gauge } from "lucide-react";

export default function PackageSection({ pkg }) {
  if (!pkg) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Current Package</h3>
        <p className="text-sm text-slate-400">No active package assigned. Please contact support.</p>
      </div>
    );
  }

  const stats = [
    { icon: Gauge, label: "Speed", value: `${pkg.speed_mbps} Mbps` },
    { icon: DollarSign, label: "Monthly", value: `$${pkg.monthly_price}` },
    { icon: Clock, label: "Validity", value: `${pkg.validity_days || 30} days` },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Current Package</h3>
        <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Active</span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-lg bg-indigo-50 flex items-center justify-center"><Zap className="w-5 h-5 text-indigo-600" /></div>
        <div>
          <p className="font-bold text-slate-900">{pkg.name}</p>
          {pkg.description && <p className="text-xs text-slate-500">{pkg.description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-slate-50 rounded-lg p-3 text-center">
            <s.icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-[10px] uppercase text-slate-400 font-semibold">{s.label}</p>
            <p className="text-sm font-bold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}