import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Server, RefreshCw, Loader2 } from "lucide-react";

export default function RouterInfoPanel() {
  const [routers, setRouters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRouters = async () => {
    try {
      const data = await netscaleApi.entities.MikrotikRouter.list("-created_date", 50);
      setRouters(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchSystemInfo = async () => {
    setRefreshing(true);
    try {
      const res = await netscaleApi.functions.invoke('fetchRouterSystemInfo', {});
      if (res.data?.routers) {
        setRouters(res.data.routers);
      }
    } catch (err) { console.error(err); }
    finally { setRefreshing(false); }
  };

  useEffect(() => {
    loadRouters();
    fetchSystemInfo();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 mb-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (routers.length === 0) return null;

  const formatMemory = (bytes) => {
    if (!bytes || bytes === 0) return "—";
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb >= 0.001) return gb.toFixed(8) + " GB";
    const mb = bytes / 1024 / 1024;
    return mb.toFixed(2) + " MB";
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-500" /> Mikrotik Router Info
        </h2>
        <button
          onClick={fetchSystemInfo}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white shadow-sm"
        >
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {routers.map(router => (
          <div key={router.id} className="glass-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">{router.name}</h3>
              <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase ${router.status === "online" ? "text-emerald-600" : "text-slate-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${router.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                {router.status}
              </span>
            </div>
            <div className="space-y-0">
              {[
                { label: "Version", value: router.router_version },
                { label: "Uptime", value: router.router_uptime },
                { label: "Free Memory", value: formatMemory(router.free_memory) },
                { label: "CPU", value: router.cpu_load != null ? router.cpu_load + "%" : "—" },
                { label: "Board-name", value: router.board_name },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex justify-between items-center text-sm py-2.5 ${i < arr.length - 1 ? "border-b border-slate-100" : ""}`}>
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-medium text-slate-700 text-right">{row.value || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}