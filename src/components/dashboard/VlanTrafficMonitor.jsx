import React, { useState, useEffect, useRef, useCallback } from "react";
import { netscaleApi } from "@/api/apiClient";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Network, Loader2, Activity, Pause, Play } from "lucide-react";

const POLL_MS = 4000;
const MAX_POINTS = 30;
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1"];

const vlanKey = (v) => `${v.router_id || ""}::${v.vlan_id || v.vlan_name || ""}`;
const toMbps = (kbps) => Math.round(((kbps || 0) / 1024) * 10) / 10;

export default function VlanTrafficMonitor() {
  const [vlans, setVlans] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const fetchVlans = useCallback(async () => {
    return await netscaleApi.entities.VlanTraffic.list("-last_synced", 200);
  }, []);

  // Initial load + auto-select first few VLANs
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchVlans();
        setVlans(list);
        setSelected(new Set(list.slice(0, 3).map(vlanKey)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchVlans]);

  // Realtime polling
  useEffect(() => {
    if (!live) return;
    let active = true;
    const tick = async () => {
      try {
        const list = await fetchVlans();
        if (!active) return;
        setVlans(list);
        const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
        const point = { time };
        for (const v of list) {
          const k = vlanKey(v);
          if (selectedRef.current.has(k)) {
            point[`${k}_tx`] = toMbps(v.tx_kbps);
            point[`${k}_rx`] = toMbps(v.rx_kbps);
          }
        }
        setHistory((prev) => {
          const next = [...prev, point];
          if (next.length > MAX_POINTS) next.shift();
          return next;
        });
      } catch (e) {
        console.error(e);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(id); };
  }, [live, fetchVlans]);

  const toggle = (k) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  // Group VLANs by router
  const grouped = {};
  for (const v of vlans) {
    const r = v.router_name || v.router_id || "Unknown Router";
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(v);
  }

  const selectedKeys = [...selected];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-500" /> VLAN Traffic (Realtime)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Select VLANs to monitor live TX/RX · polls every 4s</p>
        </div>
        <button
          onClick={() => setLive((l) => !l)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            live ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {live ? <><Pause className="w-3.5 h-3.5" /> Live</> : <><Play className="w-3.5 h-3.5" /> Paused</>}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : vlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Network className="w-10 h-10 mb-2" />
          <p className="text-sm">No VLAN data yet — connect a Mikrotik router and sync to import VLAN interfaces</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* VLAN selection list */}
          <div className="lg:col-span-1 border border-slate-100 rounded-lg p-3 max-h-80 overflow-y-auto">
            <div className="text-[10px] font-semibold uppercase text-slate-400 mb-2 px-1">
              {vlans.length} VLANs · {selectedKeys.length} selected
            </div>
            <div className="space-y-3">
              {Object.entries(grouped).map(([router, list]) => (
                <div key={router}>
                  <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1.5 px-1">{router}</div>
                  <div className="space-y-0.5">
                    {list.map((v) => {
                      const k = vlanKey(v);
                      const checked = selected.has(k);
                      const colorIdx = selectedKeys.indexOf(k);
                      return (
                        <label
                          key={k}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(k)}
                            className="w-3.5 h-3.5 rounded border-slate-300"
                          />
                          {checked && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: COLORS[colorIdx % COLORS.length] }}
                            />
                          )}
                          <span className="text-sm text-slate-700 flex-1 truncate">
                            {v.vlan_name || v.vlan_id}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                            ↓{toMbps(v.rx_kbps)} ↑{toMbps(v.tx_kbps)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Realtime chart */}
          <div className="lg:col-span-2">
            {selectedKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-80 text-slate-400">
                <Activity className="w-10 h-10 mb-2" />
                <p className="text-sm">Select one or more VLANs to start the live chart</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v) => `${v}M`}
                    label={{ value: "Mbps", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#94a3b8" } }}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v) => `${v} Mbps`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {selectedKeys.map((k, i) => {
                    const color = COLORS[i % COLORS.length];
                    const v = vlans.find((x) => vlanKey(x) === k);
                    const label = v ? `${v.vlan_name || v.vlan_id}` : k.split("::")[1];
                    return (
                      <React.Fragment key={k}>
                        <Line type="monotone" dataKey={`${k}_tx`} stroke={color} strokeWidth={2} dot={false} name={`${label} TX`} isAnimationActive={false} />
                        <Line type="monotone" dataKey={`${k}_rx`} stroke={color} strokeWidth={2} strokeDasharray="5 4" dot={false} name={`${label} RX`} isAnimationActive={false} />
                      </React.Fragment>
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}