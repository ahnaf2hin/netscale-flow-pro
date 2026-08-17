import React, { useState, useEffect, useRef } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Radio, Wifi, RefreshCw, Plus, Pencil, Trash2, Server, Activity, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const StatCard = ({ label, value, icon: Icon, bg, iconBg }) => (
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

export default function MikrotikMonitor() {
  const [routers, setRouters] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRouterForm, setShowRouterForm] = useState(false);
  const [editingRouter, setEditingRouter] = useState(null);
  const [search, setSearch] = useState("");
  const [syncingId, setSyncingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const intervalRef = useRef(null);
  const { toast } = useToast();

  const [routerForm, setRouterForm] = useState({ name: "", host: "", api_port: "8728", username: "", password: "", location: "" });

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadSessions, 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const loadData = async () => {
    try {
      const [r, s] = await Promise.all([
        netscaleApi.entities.MikrotikRouter.list("-created_date", 50),
        netscaleApi.entities.PPPoESession.list("-last_synced", 500),
      ]);
      setRouters(r);
      setSessions(s);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadSessions = async () => {
    try {
      const s = await netscaleApi.entities.PPPoESession.list("-last_synced", 500);
      setSessions(s);
    } catch (err) { console.error(err); }
  };

  const openAddRouter = () => {
    setEditingRouter(null);
    setRouterForm({ name: "", host: "", api_port: "8728", username: "", password: "", location: "" });
    setShowRouterForm(true);
  };

  const openEditRouter = (router) => {
    setEditingRouter(router);
    setRouterForm({
      name: router.name || "", host: router.host || "", api_port: String(router.api_port || "8728"),
      username: router.username || "", password: router.password || "", location: router.location || "",
      latitude: router.latitude ?? "", longitude: router.longitude ?? "", status: router.status || "online",
    });
    setShowRouterForm(true);
  };

  const saveRouter = async () => {
    try {
      const payload = { ...routerForm, api_port: parseInt(routerForm.api_port), latitude: routerForm.latitude === "" ? undefined : Number(routerForm.latitude), longitude: routerForm.longitude === "" ? undefined : Number(routerForm.longitude) };
      if (editingRouter) {
        await netscaleApi.entities.MikrotikRouter.update(editingRouter.id, payload);
        toast({ title: "Router updated" });
      } else {
        await netscaleApi.entities.MikrotikRouter.create(payload);
        toast({ title: "Router added" });
      }
      setShowRouterForm(false);
      setEditingRouter(null);
      loadData();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deleteRouter = async (router) => {
    if (!window.confirm(`Delete router "${router.name}"?`)) return;
    try {
      await netscaleApi.entities.MikrotikRouter.delete(router.id);
      loadData();
      toast({ title: "Router deleted" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const syncNow = async (router) => {
    setSyncingId(router.id);
    try {
      const res = await netscaleApi.functions.invoke('syncRouterNow', { router_id: router.id });
      const data = res?.data || res;
      if (data?.success) {
        toast({ title: `Synced ${data.sessions} session(s) from ${data.router}` });
      } else {
        toast({ title: 'Sync failed', description: data?.error || 'Could not connect', variant: 'destructive' });
      }
      loadData();
    } catch (err) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    } finally { setSyncingId(null); }
  };

  const handleCommand = async (session, command) => {
    try {
      await netscaleApi.entities.CommandQueue.create({ customer_id: session.customer_id, command_type: command, router_id: session.router_id, pppoe_username: session.pppoe_username, status: "pending" });
      toast({ title: `${command} command queued for ${session.customer_name || session.pppoe_username}` });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const formatSpeed = (kbps) => {
    if (!kbps) return "0";
    if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} Mbps`;
    return `${kbps} Kbps`;
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  const onlineSessions = sessions.filter(s => s.status === "online");
  const offlineSessions = sessions.filter(s => s.status === "offline");
  const suspended = sessions.filter(s => s.status === "suspended");
  const onlineRouters = routers.filter(r => r.status === "online");

  const filtered = sessions.filter(s =>
    !search ||
    s.pppoe_username?.toLowerCase().includes(search.toLowerCase()) ||
    s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.ip_address?.includes(search)
  );

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Mikrotik Management</h1>
            <p className="text-xs text-slate-500">Router connections & network services</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={openAddRouter} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Add Server
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Servers" value={routers.length} icon={Server} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <StatCard label="Online Servers" value={onlineRouters.length} icon={Activity} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Offline Servers" value={routers.length - onlineRouters.length} icon={Server} bg="bg-rose-500" iconBg="bg-rose-600" />
        <StatCard label="Active Connections" value={onlineSessions.length} icon={Wifi} bg="bg-cyan-500" iconBg="bg-cyan-600" />
      </div>

      {/* Servers Table */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Server className="w-4 h-4 text-indigo-500" /> Mikrotik Servers</h2>
        </div>
        {routers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Radio className="w-10 h-10 mb-2" />
            <p className="text-sm">No servers added yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Server</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Connection</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Location</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routers.map(r => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <Radio className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-900">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 hidden sm:table-cell">{r.host}:{r.api_port || 8728}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${r.status === "online" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.status === "online" ? "bg-emerald-500" : "bg-red-500"}`} />
                        {r.status === "online" ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{r.location || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => syncNow(r)} disabled={syncingId === r.id} title="Sync now" className="p-1.5 rounded-md hover:bg-indigo-50 text-indigo-500 disabled:opacity-50">
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingId === r.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => openEditRouter(r)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteRouter(r)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PPPoE Sessions */}
      <div className="glass-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Wifi className="w-4 h-4 text-cyan-500" /> PPPoE Users</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{sessions.length}</span>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">● {onlineSessions.length} Online</span>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{offlineSessions.length} Offline</span>
          </div>
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search username, IP..."
              className="h-8 pl-3 pr-3 text-xs border border-slate-200 rounded-lg w-52 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Wifi className="w-12 h-12 mb-3" />
            <p className="text-sm">No sessions yet — data appears when collector pushes it</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 border-b border-slate-200">
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">#</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Username</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3 hidden sm:table-cell">Service</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Status</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3 hidden md:table-cell">Remote Address</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3 hidden lg:table-cell">Uptime</th>
                  <th className="text-right text-[11px] font-semibold uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                    <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                          {(s.customer_name || s.pppoe_username || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{s.customer_name || s.pppoe_username}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{s.pppoe_username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">pppoe</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${s.status === "online" ? "text-emerald-600" : s.status === "suspended" ? "text-amber-600" : "text-slate-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.status === "online" ? "bg-emerald-500" : s.status === "suspended" ? "bg-amber-400" : "bg-slate-400"}`} />
                        {s.status === "online" ? "Online" : s.status === "suspended" ? "Disabled" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 hidden md:table-cell">{s.ip_address || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{s.uptime || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {s.status === "online" && (
                          <button onClick={() => handleCommand(s, "suspend")} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center" title="Suspend">
                            <span className="text-xs font-bold">⏻</span>
                          </button>
                        )}
                        {(s.status === "offline" || s.status === "suspended") && (
                          <button onClick={() => handleCommand(s, "reconnect")} className="w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center" title="Reconnect">
                            <span className="text-xs font-bold">↻</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Router Form */}
      <Dialog open={showRouterForm} onOpenChange={o => { setShowRouterForm(o); if (!o) setEditingRouter(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRouter ? "Edit Mikrotik Server" : "Add Mikrotik Server"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name *</Label><Input value={routerForm.name} onChange={e => setRouterForm({ ...routerForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Host / IP *</Label><Input value={routerForm.host} onChange={e => setRouterForm({ ...routerForm, host: e.target.value })} /></div>
              <div><Label className="text-xs">API Port</Label><Input type="number" value={routerForm.api_port} onChange={e => setRouterForm({ ...routerForm, api_port: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Username *</Label><Input value={routerForm.username} onChange={e => setRouterForm({ ...routerForm, username: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Password</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={routerForm.password} onChange={e => setRouterForm({ ...routerForm, password: e.target.value })} className="pr-9" />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div><Label className="text-xs">Location</Label><Input value={routerForm.location} onChange={e => setRouterForm({ ...routerForm, location: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Latitude</Label><Input type="number" step="any" value={routerForm.latitude ?? ""} onChange={e => setRouterForm({ ...routerForm, latitude: e.target.value })} /></div>
              <div><Label className="text-xs">Longitude</Label><Input type="number" step="any" value={routerForm.longitude ?? ""} onChange={e => setRouterForm({ ...routerForm, longitude: e.target.value })} /></div>
            </div>
            <Button onClick={saveRouter} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {editingRouter ? "Save Changes" : "Add Server"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}