import React, { useState, useEffect, useRef } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Activity, Settings2, ArrowDown, ArrowUp, Loader2, Server, RefreshCw, Star } from "lucide-react";
import InterfaceSpeedChart from "@/components/dashboard/InterfaceSpeedChart";

export default function InterfaceMonitorPanel() {
  const { toast } = useToast();
  const [routers, setRouters] = useState([]);
  const [selectedRouterId, setSelectedRouterId] = useState("");
  const [vlans, setVlans] = useState([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const monitoredNamesRef = useRef([]);

  useEffect(() => {
    netscaleApi.entities.MikrotikRouter.list("-created_date", 100).then(r => {
      setRouters(r);
      if (r.length > 0) setSelectedRouterId(r[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Track monitored interface names for lightweight polling
  useEffect(() => {
    monitoredNamesRef.current = vlans.filter(v => v.monitored).map(v => v.vlan_id);
  }, [vlans]);

  // Load VlanTraffic for selected router — auto-fetch if empty
  useEffect(() => {
    if (!selectedRouterId) return;
    netscaleApi.entities.VlanTraffic.filter({ router_id: selectedRouterId }, "-last_synced", 300).then(async v => {
      setVlans(v);
      if (v.length === 0) {
        setFetching(true);
        try {
          await netscaleApi.functions.invoke('syncRouterInterfaces', { router_id: selectedRouterId });
          const v2 = await netscaleApi.entities.VlanTraffic.filter({ router_id: selectedRouterId }, "-last_synced", 300);
          setVlans(v2);
        } catch (_) {}
        finally { setFetching(false); }
      }
    }).catch(() => {});
  }, [selectedRouterId]);

  // Real-time subscription — only process monitored interfaces to avoid 270+ re-renders
  useEffect(() => {
    if (!selectedRouterId) return;
    const unsubscribe = netscaleApi.entities.VlanTraffic.subscribe((event) => {
      const data = event.data;
      if (!data || data.router_id !== selectedRouterId || !data.monitored) return;
      setVlans(prev => {
        const idx = prev.findIndex(v => v.vlan_id === data.vlan_id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...data };
          return updated;
        }
        return prev;
      });
    });
    return unsubscribe;
  }, [selectedRouterId]);

  // Recursive poll — only syncs monitored interfaces, no overlapping calls
  useEffect(() => {
    if (!selectedRouterId) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const names = monitoredNamesRef.current;
      if (names.length > 0) {
        try {
          const res = await netscaleApi.functions.invoke('syncMonitoredInterfaces', {
            router_id: selectedRouterId,
            interface_names: names,
          });
          // Use the returned speed data directly — don't rely solely on
          // the subscription, which may not fire for service-role updates.
          const ifaces = res?.data?.interfaces;
          if (Array.isArray(ifaces) && ifaces.length > 0) {
            const nowIso = new Date().toISOString();
            setVlans(prev => prev.map(v => {
              const u = ifaces.find(i => i.name === v.vlan_id);
              return u ? { ...v, tx_kbps: u.tx_kbps, rx_kbps: u.rx_kbps, last_synced: nowIso } : v;
            }));
          }
        } catch (_) {}
      }
      if (!cancelled) setTimeout(poll, 1000);
    };
    const timer = setTimeout(poll, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedRouterId]);

  const fetchInterfaces = async () => {
    if (!selectedRouterId) return;
    setFetching(true);
    try {
      await netscaleApi.functions.invoke('syncRouterInterfaces', { router_id: selectedRouterId });
      const v = await netscaleApi.entities.VlanTraffic.filter({ router_id: selectedRouterId }, "-last_synced", 300);
      setVlans(v);
      toast({ title: "Interfaces fetched", description: `${v.length} interfaces found` });
    } catch (err) {
      toast({ title: "Fetch failed", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally { setFetching(false); }
  };

  const toggleMonitor = async (vlan) => {
    try {
      await netscaleApi.entities.VlanTraffic.update(vlan.id, { monitored: !vlan.monitored });
      setVlans(prev => prev.map(v => v.id === vlan.id ? { ...v, monitored: !v.monitored } : v));
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleFavorite = async (vlan) => {
    try {
      await netscaleApi.entities.VlanTraffic.update(vlan.id, { favorite: !vlan.favorite });
      setVlans(prev => prev.map(v => v.id === vlan.id ? { ...v, favorite: !v.favorite } : v));
    } catch (_) {}
  };

  const sortFn = (a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return (a.vlan_name || a.vlan_id).localeCompare(b.vlan_name || b.vlan_id);
  };

  const monitoredVlans = vlans.filter(v => v.monitored).sort(sortFn);
  const sortedAllVlans = [...vlans].sort(sortFn);
  const selectedRouter = routers.find(r => r.id === selectedRouterId);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading interface monitor...</div>
      </div>
    );
  }

  if (routers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-cyan-500" /> Interface Speed Monitor</h2>
        <p className="text-sm text-slate-400 text-center py-4">No routers registered. Add routers in Mikrotik Monitor first.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-500" /> Interface Speed Monitor
          </h2>
          <Select value={selectedRouterId} onValueChange={setSelectedRouterId}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <Server className="w-3 h-3 mr-1 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {routers.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.status === "online" ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {r.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchInterfaces} disabled={fetching}>
            {fetching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Fetch from Router
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSetupOpen(true)}>
            <Settings2 className="w-3 h-3 mr-1" /> Select Interfaces
          </Button>
        </div>
      </div>

      {fetching && vlans.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Fetching interfaces from router...
        </div>
      ) : monitoredVlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <Activity className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">No interfaces selected</p>
          <p className="text-xs mt-1">Click "Select Interfaces" to choose which interfaces to monitor</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {monitoredVlans.map(vlan => (
            <div key={vlan.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/30">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <button onClick={() => toggleFavorite(vlan)} className="shrink-0">
                    <Star className={`w-3.5 h-3.5 ${vlan.favorite ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-400"}`} />
                  </button>
                  <span className="text-xs font-mono font-semibold text-slate-700 truncate">{vlan.vlan_name || vlan.vlan_id}</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              </div>
              <div className="flex gap-3 mb-1.5">
                <span className="flex items-center gap-1 text-xs">
                  <ArrowDown className="w-3 h-3 text-indigo-500" />
                  <span className="font-bold text-indigo-600">{fmtSpeed(vlan.tx_kbps)}</span>
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <ArrowUp className="w-3 h-3 text-emerald-500" />
                  <span className="font-bold text-emerald-600">{fmtSpeed(vlan.rx_kbps)}</span>
                </span>
              </div>
              <InterfaceSpeedChart
                txKbps={vlan.tx_kbps}
                rxKbps={vlan.rx_kbps}
                lastSynced={vlan.last_synced}
                name={vlan.vlan_id}
              />
            </div>
          ))}
        </div>
      )}

      {/* Setup Dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Select Interfaces to Monitor</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500 mt-1">Pick interfaces from <span className="font-semibold">{selectedRouter?.name}</span> to display live speed cards. Star favorites to pin them on top.</p>
          <div className="space-y-1.5 mt-3">
            {vlans.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-400 mb-3">No interfaces discovered yet.</p>
                <Button variant="outline" size="sm" onClick={fetchInterfaces} disabled={fetching}>
                  {fetching ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
                  Fetch from Router
                </Button>
              </div>
            ) : (
              sortedAllVlans.map(vlan => (
                <div key={vlan.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => toggleFavorite(vlan)} className="shrink-0">
                      <Star className={`w-3.5 h-3.5 ${vlan.favorite ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-400"}`} />
                    </button>
                    <span className="text-sm font-mono font-medium text-slate-700 truncate">{vlan.vlan_name || vlan.vlan_id}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{fmtSpeed(vlan.tx_kbps)} / {fmtSpeed(vlan.rx_kbps)}</span>
                  </div>
                  <button
                    onClick={() => toggleMonitor(vlan)}
                    className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors shrink-0 ${vlan.monitored ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    {vlan.monitored ? "✓ Monitoring" : "Monitor"}
                  </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmtSpeed(kbps) {
  if (!kbps) return '0 kbps';
  if (kbps >= 1000) return (kbps / 1000).toFixed(1) + ' Mbps';
  return Math.round(kbps) + ' kbps';
}