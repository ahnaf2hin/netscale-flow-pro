import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Wifi, Activity, RefreshCw, Search, Plus, Pencil, Trash2, Power, PowerOff, Eye, EyeOff, Users, Server, UserPlus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const genCode = () => "CUST-" + Math.floor(100000 + Math.random() * 900000);

const StatCard = ({ label, value, icon: Icon, bg, iconBg }) => (
  <div className={`${bg} rounded-xl p-4 flex items-center justify-between`}>
    <div>
      <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-white text-2xl font-bold mt-1">{value}</p>
    </div>
    <div className={`${iconBg} w-10 h-10 rounded-lg flex items-center justify-center`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
  </div>
);

const emptyPppoeForm = { id: "", name: "", password: "", profile: "default", comment: "" };
const emptyDetails = { name: "", phone: "", email: "", address: "", latitude: "", longitude: "", customer_code: "" };

export default function ActiveConnections() {
  const [routers, setRouters] = useState([]);
  const [selectedRouter, setSelectedRouter] = useState("");
  const [sessions, setSessions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showPasswords, setShowPasswords] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(emptyPppoeForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [detailsMode, setDetailsMode] = useState("add");
  const [detailsForm, setDetailsForm] = useState(emptyDetails);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const rts = await base44.entities.MikrotikRouter.list("-created_date", 50);
        setRouters(rts);
        if (rts.length > 0) {
          setSelectedRouter(rts[0].id);
          await loadFromDB(rts[0].id);
          setLoading(false);
          syncFromRouter(rts[0].id);
        } else {
          setLoading(false);
        }
      } catch (e) { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRouter) return;
    const id = setInterval(() => syncFromRouter(selectedRouter), 60000);
    return () => clearInterval(id);
  }, [selectedRouter]);

  const loadFromDB = async (routerId) => {
    try {
      const s = await base44.entities.PPPoESession.filter({ router_id: routerId }, "-last_synced", 500);
      setSessions(s);
    } catch (e) { console.error(e); }
  };

  const syncFromRouter = async (routerId) => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("managePppoe", { action: "list", router_id: routerId });
      const d = res.data;
      if (d.success === false) { toast({ title: "Sync failed", description: d.error, variant: "destructive" }); }
      else { setProfiles(d.profiles || []); await loadFromDB(routerId); }
    } catch (e) { toast({ title: "Sync error", description: e.message, variant: "destructive" }); }
    finally { setSyncing(false); }
  };

  const handlePppoeAction = async (action, payload, successMsg) => {
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke("managePppoe", { action, router_id: selectedRouter, ...payload });
      if (res.data.success === false) throw new Error(res.data.error);
      toast({ title: successMsg });
      await syncFromRouter(selectedRouter);
    } catch (e) { toast({ title: "Action failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const openAdd = () => { setEditMode(false); setForm({ ...emptyPppoeForm, profile: profiles[0]?.name || "default" }); setShowForm(true); };
  const openEdit = (s) => { setEditMode(true); setForm({ id: s.secret_id, name: s.pppoe_username, password: s.password, profile: s.profile, comment: s.customer_name || "" }); setShowForm(true); };

  const handleSavePppoe = async () => {
    if (!form.name) { toast({ title: "Username required", variant: "destructive" }); return; }
    setActionLoading(true);
    try {
      const payload = editMode
        ? { action: "update", id: form.id, name: form.name, profile: form.profile, comment: form.comment, ...(form.password ? { password: form.password } : {}) }
        : { action: "add", name: form.name, password: form.password, profile: form.profile, comment: form.comment };
      const res = await base44.functions.invoke("managePppoe", { router_id: selectedRouter, ...payload });
      if (res.data.success === false) throw new Error(res.data.error);
      toast({ title: editMode ? "PPPoE user updated" : "PPPoE user created" });
      setShowForm(false);
      await syncFromRouter(selectedRouter);
    } catch (e) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke("managePppoe", { action: "delete", router_id: selectedRouter, id: deleteTarget.secret_id });
      if (res.data.success === false) throw new Error(res.data.error);
      toast({ title: "User deleted" });
      setDeleteTarget(null);
      await syncFromRouter(selectedRouter);
    } catch (e) { toast({ title: "Delete failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const openDetails = async (s) => {
    setDetailsTarget(s);
    if (s.customer_id) {
      setDetailsMode("edit");
      setDetailsLoading(true);
      try {
        const c = await base44.entities.Customer.get(s.customer_id);
        setDetailsForm({
          name: c.name || "", phone: c.phone || "", email: c.email || "", address: c.address || "",
          latitude: c.latitude ? String(c.latitude) : "", longitude: c.longitude ? String(c.longitude) : "",
          customer_code: c.customer_code || "",
        });
      } catch (e) { toast({ title: "Could not load client", description: e.message, variant: "destructive" }); }
      finally { setDetailsLoading(false); }
    } else {
      setDetailsMode("add");
      setDetailsForm({ ...emptyDetails, name: s.customer_name || "", customer_code: genCode() });
    }
  };

  const handleSaveDetails = async () => {
    if (!detailsTarget) return;
    if (!detailsForm.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setDetailsLoading(true);
    try {
      const data = {
        name: detailsForm.name, phone: detailsForm.phone || "", email: detailsForm.email || "",
        address: detailsForm.address || "",
        latitude: detailsForm.latitude ? parseFloat(detailsForm.latitude) : undefined,
        longitude: detailsForm.longitude ? parseFloat(detailsForm.longitude) : undefined,
      };
      if (detailsMode === "add") {
        await base44.entities.Customer.create({
          ...data,
          pppoe_username: detailsTarget.pppoe_username,
          pppoe_password: detailsTarget.password || "",
          customer_code: detailsForm.customer_code || genCode(),
          status: "active",
          notes: "Created from PPPoE management",
        });
        toast({ title: "Client details added", description: "Customer ID: " + (detailsForm.customer_code || "") });
      } else {
        await base44.entities.Customer.update(detailsTarget.customer_id, data);
        toast({ title: "Client details updated" });
      }
      setDetailsTarget(null);
      await syncFromRouter(selectedRouter);
    } catch (e) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    finally { setDetailsLoading(false); }
  };

  const filtered = sessions.filter(s => {
    const q = search.toLowerCase();
    return !q || s.pppoe_username?.toLowerCase().includes(q) || s.customer_name?.toLowerCase().includes(q) || s.profile?.toLowerCase().includes(q) || s.customer_code?.toLowerCase().includes(q);
  });

  const onlineCount = sessions.filter(s => s.status === "online").length;
  const enabledCount = sessions.filter(s => !s.disabled).length;
  const disabledCount = sessions.filter(s => s.disabled).length;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-600 flex items-center justify-center"><Activity className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">PPPoE Management</h1>
            <p className="text-xs text-slate-500">{syncing ? "Syncing with MikroTik…" : "Full control of PPPoE users · auto-refresh 60s"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedRouter} onValueChange={(v) => { setSelectedRouter(v); loadFromDB(v); syncFromRouter(v); }}>
            <SelectTrigger className="w-48 h-9 text-sm bg-white border-slate-200"><Server className="w-3.5 h-3.5 mr-1.5 text-slate-400" /><SelectValue placeholder="Select router" /></SelectTrigger>
            <SelectContent>{routers.map(r => <SelectItem key={r.id} value={r.id}>{r.name || r.host}</SelectItem>)}</SelectContent>
          </Select>
          <button onClick={() => syncFromRouter(selectedRouter)} disabled={syncing} className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Add User</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={sessions.length} icon={Users} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <StatCard label="Online Now" value={onlineCount} icon={Wifi} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Enabled" value={enabledCount} icon={Activity} bg="bg-cyan-500" iconBg="bg-cyan-600" />
        <StatCard label="Disabled" value={disabledCount} icon={PowerOff} bg="bg-rose-500" iconBg="bg-rose-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username, client, profile, customer ID..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
          <button onClick={() => setShowPasswords(!showPasswords)} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
            {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {showPasswords ? "Hide" : "Show"} Passwords
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Wifi className="w-12 h-12 mb-3" />
            <p className="text-sm">{sessions.length === 0 ? "No data yet — syncing from router…" : "No users match your search"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">#</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Username</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Password</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3 hidden sm:table-cell">Profile</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3 hidden lg:table-cell">Client</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3 hidden xl:table-cell">Cust ID</th>
                  <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                    <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-800">{s.pppoe_username}</p>
                      <p className="text-[10px] text-slate-400">{s.profile || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{showPasswords ? (s.password || "—") : "••••••"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">{s.profile || "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs font-medium text-slate-700">{s.customer_name || <span className="text-slate-300 italic">No client</span>}</p>
                      {s.customer_name && <p className="text-[10px] text-slate-400 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{s.latitude ? "Located" : "No location"}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-indigo-600 font-semibold hidden xl:table-cell">{s.customer_code || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${s.disabled ? "text-rose-600" : s.status === "online" ? "text-emerald-600" : "text-slate-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.disabled ? "bg-rose-500" : s.status === "online" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {s.disabled ? "Disabled" : s.status === "online" ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetails(s)} disabled={actionLoading} title="Client details" className="w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          {s.customer_id ? <Pencil className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => openEdit(s)} disabled={actionLoading} title="Edit PPPoE" className="w-7 h-7 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                        {s.disabled ? (
                          <button onClick={() => handlePppoeAction("enable", { id: s.secret_id }, "User enabled")} disabled={actionLoading} title="Enable" className="w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center"><Power className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button onClick={() => handlePppoeAction("disable", { id: s.secret_id }, "User disabled")} disabled={actionLoading} title="Disable" className="w-7 h-7 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-600 flex items-center justify-center"><PowerOff className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => setDeleteTarget(s)} disabled={actionLoading} title="Delete" className="w-7 h-7 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit PPPoE User Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editMode ? "Edit PPPoE User" : "Add PPPoE User"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label className="text-xs">Username *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. user01" /></div>
            <div><Label className="text-xs">{editMode ? "Password (leave blank to keep current)" : "Password"}</Label><Input type={showPasswords ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••" /></div>
            <div>
              <Label className="text-xs">Profile</Label>
              <Select value={form.profile} onValueChange={v => setForm({ ...form, profile: v })}>
                <SelectTrigger><SelectValue placeholder="Select profile" /></SelectTrigger>
                <SelectContent>
                  {profiles.length === 0 && <SelectItem value="default">default</SelectItem>}
                  {profiles.map(p => <SelectItem key={p.name} value={p.name}>{p.name}{p.rate_limit ? ` (${p.rate_limit})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Comment / Customer Name</Label><Input value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder="Optional" /></div>
            <Button onClick={handleSavePppoe} disabled={actionLoading} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{editMode ? "Update User" : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete PPPoE User?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 mt-2">This will permanently remove <span className="font-semibold text-slate-900">{deleteTarget?.pppoe_username}</span> from the MikroTik router. This cannot be undone.</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={actionLoading} className="bg-rose-600 hover:bg-rose-700">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Client Details Dialog */}
      <Dialog open={!!detailsTarget} onOpenChange={(o) => !o && setDetailsTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detailsMode === "add" ? "Add Client Details" : "Edit Client Details"}</DialogTitle></DialogHeader>
          {detailsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : (
            <div className="space-y-4 mt-2">
              <div><Label className="text-xs">Customer ID (for payments)</Label><Input value={detailsForm.customer_code} readOnly className="bg-slate-50 font-mono text-indigo-600 font-semibold" /></div>
              <div><Label className="text-xs">PPPoE Username</Label><Input value={detailsTarget?.pppoe_username || ""} readOnly className="bg-slate-50 font-mono text-xs" /></div>
              <div><Label className="text-xs">Name *</Label><Input value={detailsForm.name} onChange={e => setDetailsForm({ ...detailsForm, name: e.target.value })} /></div>
              <div><Label className="text-xs">Phone</Label><Input value={detailsForm.phone} onChange={e => setDetailsForm({ ...detailsForm, phone: e.target.value })} /></div>
              <div><Label className="text-xs">Email</Label><Input value={detailsForm.email} onChange={e => setDetailsForm({ ...detailsForm, email: e.target.value })} /></div>
              <div><Label className="text-xs">Address</Label><Input value={detailsForm.address} onChange={e => setDetailsForm({ ...detailsForm, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs">Latitude</Label><Input value={detailsForm.latitude} onChange={e => setDetailsForm({ ...detailsForm, latitude: e.target.value })} placeholder="-33.8688" /></div>
                <div><Label className="text-xs">Longitude</Label><Input value={detailsForm.longitude} onChange={e => setDetailsForm({ ...detailsForm, longitude: e.target.value })} placeholder="151.2093" /></div>
              </div>
              <Button onClick={handleSaveDetails} disabled={detailsLoading} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {detailsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{detailsMode === "add" ? "Add Details" : "Update Details"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}