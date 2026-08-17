import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Layers, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function HotspotProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", shared_users: "1", rate_limit: "", session_timeout: "", validity: "", price: "", status: "active" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setProfiles(await netscaleApi.entities.HotspotProfile.list("-created_date", 200)); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const open = (p) => { setEdit(p || null); setForm(p ? { name: p.name, shared_users: String(p.shared_users || 1), rate_limit: p.rate_limit || "", session_timeout: p.session_timeout || "", validity: p.validity || "", price: String(p.price || ""), status: p.status || "active" } : { name: "", shared_users: "1", rate_limit: "", session_timeout: "", validity: "", price: "", status: "active" }); setShowForm(true); };

  const save = async () => {
    const data = { ...form, shared_users: parseInt(form.shared_users) || 1, price: parseFloat(form.price) || 0 };
    try {
      if (edit) await netscaleApi.entities.HotspotProfile.update(edit.id, data);
      else await netscaleApi.entities.HotspotProfile.create(data);
      setShowForm(false); loadData();
      toast({ title: edit ? "Profile updated" : "Profile created" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const del = async (p) => { if (!window.confirm(`Delete profile "${p.name}"?`)) return; try { await netscaleApi.entities.HotspotProfile.delete(p.id); loadData(); toast({ title: "Profile deleted" }); } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); } };

  const active = profiles.filter(p => p.status === "active").length;
  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <PageHeader icon={Layers} iconBg="bg-violet-600" title="Hotspot Profiles" subtitle="Bandwidth & session profiles for hotspot users">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        <button onClick={() => open()} className="flex items-center gap-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Profile</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <ColorStatCard label="Total Profiles" value={profiles.length} icon={Layers} bg="bg-blue-500" iconBg="bg-blue-600" />
        <ColorStatCard label="Active" value={active} icon={Layers} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Avg Price" value={formatBDT(profiles.length ? profiles.reduce((s, p) => s + (p.price || 0), 0) / profiles.length : 0)} icon={Layers} bg="bg-violet-500" iconBg="bg-violet-600" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map(p => (
          <div key={p.id} className="glass-card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><Layers className="w-5 h-5 text-violet-600" /></div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{p.status}</span>
            </div>
            <h3 className="font-semibold text-slate-900">{p.name}</h3>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              <p>Rate Limit: <span className="font-medium text-slate-700">{p.rate_limit || "—"}</span></p>
              <p>Shared Users: <span className="font-medium text-slate-700">{p.shared_users}</span></p>
              <p>Session Timeout: <span className="font-medium text-slate-700">{p.session_timeout || "—"}</span></p>
              <p>Validity: <span className="font-medium text-slate-700">{p.validity || "—"}</span></p>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <span className="text-lg font-bold text-slate-900">{formatBDT(p.price)}</span>
              <div className="flex gap-1">
                <button onClick={() => open(p)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(p)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
        {profiles.length === 0 && <div className="col-span-full text-center py-12 text-slate-400"><Layers className="w-12 h-12 mx-auto mb-3" /><p className="text-sm">No profiles yet</p></div>}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? "Edit Profile" : "Add Profile"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Rate Limit</Label><Input value={form.rate_limit} onChange={e => setForm({ ...form, rate_limit: e.target.value })} placeholder="e.g. 2M/2M" /></div>
              <div><Label className="text-xs">Shared Users</Label><Input type="number" value={form.shared_users} onChange={e => setForm({ ...form, shared_users: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Session Timeout</Label><Input value={form.session_timeout} onChange={e => setForm({ ...form, session_timeout: e.target.value })} /></div>
              <div><Label className="text-xs">Validity</Label><Input value={form.validity} onChange={e => setForm({ ...form, validity: e.target.value })} placeholder="e.g. 1d" /></div>
            </div>
            <div><Label className="text-xs">Price (৳)</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{edit ? "Update" : "Create"} Profile</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}