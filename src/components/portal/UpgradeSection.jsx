import React from "react";
import { TrendingUp, Loader2, CheckCircle, Zap } from "lucide-react";

export default function UpgradeSection({ packages, currentPackageId, upgradingId, onUpgrade }) {
  const sorted = [...packages].sort((a, b) => (a.speed_mbps || 0) - (b.speed_mbps || 0));

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-emerald-600" />
        <h3 className="font-semibold text-slate-900">Upgrade Your Package</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">Switch to a faster plan. The first month is charged at checkout and your package updates instantly.</p>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400">No packages available.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((p) => {
            const isCurrent = p.id === currentPackageId;
            return (
              <div key={p.id} className={`rounded-xl border p-4 ${isCurrent ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Zap className="w-4 h-4 text-blue-600" /></div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.speed_mbps} Mbps</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">${p.monthly_price}<span className="text-xs font-normal text-slate-400">/mo</span></p>
                {p.description && <p className="text-xs text-slate-500 mt-1">{p.description}</p>}
                {isCurrent ? (
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-100 py-2 rounded-lg">
                    <CheckCircle className="w-3.5 h-3.5" /> Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => onUpgrade(p)}
                    disabled={upgradingId === p.id}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-slate-900 text-white py-2 rounded-lg hover:bg-slate-800 disabled:opacity-60"
                  >
                    {upgradingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    Upgrade & Pay
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}