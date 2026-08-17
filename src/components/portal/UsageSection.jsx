import React, { useEffect, useState } from "react";
import { netscaleApi } from "@/api/apiClient";
import { ArrowDown, ArrowUp, Radio, Loader2 } from "lucide-react";

const POLL_MS = 5000;

function signalColor(dbm) {
  if (dbm === null || dbm === undefined) return "text-slate-400";
  if (dbm >= -20) return "text-emerald-600";
  if (dbm >= -25) return "text-amber-600";
  return "text-red-600";
}

export default function UsageSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await netscaleApi.functions.invoke("getPortalUsage", {});
        if (!cancelled) setData(res.data);
      } catch {
        /* keep last-known value on a transient failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const session = data?.session;
  const onu = data?.onu;
  const online = session?.status === "online";

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Live Usage</h3>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${online ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
          {online ? "Online" : "Offline"}
        </span>
      </div>

      {!session ? (
        <p className="text-sm text-slate-400">Live speed data isn't available yet — this appears once your connection has synced at least once.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1"><ArrowDown className="w-3.5 h-3.5" /><span className="text-[10px] uppercase font-semibold">Download</span></div>
            <p className="text-xl font-bold text-slate-900">{((session.download_speed_kbps || 0) / 1024).toFixed(1)} <span className="text-sm font-normal text-slate-400">Mbps</span></p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1"><ArrowUp className="w-3.5 h-3.5" /><span className="text-[10px] uppercase font-semibold">Upload</span></div>
            <p className="text-xl font-bold text-slate-900">{((session.upload_speed_kbps || 0) / 1024).toFixed(1)} <span className="text-sm font-normal text-slate-400">Mbps</span></p>
          </div>
        </div>
      )}

      {onu && (
        <div className="border-t border-slate-100 pt-4 mt-1">
          <div className="flex items-center gap-1.5 text-slate-500 mb-2"><Radio className="w-3.5 h-3.5" /><span className="text-xs font-semibold">Fiber Signal</span></div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Rx Power</span>
            <span className={`font-semibold ${signalColor(onu.rx_power_dbm)}`}>{onu.rx_power_dbm != null ? `${onu.rx_power_dbm} dBm` : "N/A"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
