import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Sliders, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function MikrotikProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", rate_limit: "", ip_pool: "", shared_users: "1", status: "active" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setProfiles(await netscaleApi.entities.PPPoEProfile.list("-created_date", 200)); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const open = (p) => { setEdit(p || null); setForm(p ? { name: p.name, rate_limit: p.rate_limit || "", ip_pool: p.ip_pool || "", shared_users: String(p.shared_users || 1), status: p.status || "active" } : { name: "", rate_limit: "", ip_pool: "", shared_users: "1", status: "active" }); setShowForm(true); };

  const save = async () => {
    const data = { ...form, shared_users: parseInt(form.shared_users) || 1 };
    try {
      if (edit) await netscaleApi.entities.PPPoEProfile.update(edit.id, data);
      else await netscaleApi.entities.PPPoEProfile.create(data);
      setShowForm(false); loadData();
      toast({ title: edit ? "Profile updated" : "Profile created" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const del = async (p) => { if (!window.confirm(`Delete profile "${p.name}"?`)) return; try { await netscaleApi.entities.PPPoEProfile.delete(p.id); loadData(); toast({ title: "Profile deleted" }); } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); } };

  const active = profiles.filter(p => p.status === "active").length;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <PageHeader icon={Sliders} iconBg="bg-indigo-600" title="PPPoE Profiles" subtitle="Mikrotik PPPoE bandwidth & session profiles">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        <button onClick={() => open()} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Profile</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <ColorStatCard label="Total Profiles" value={profiles.length} icon={Sliders} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Active" value={active} icon={Sliders} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="IP Pools" value={new Set(profiles.map(p => p.ip_pool).filter(Boolean)).size} icon={Sliders} bg="bg-cyan-500" iconBg="bg-cyan-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Sliders className="w-12 h-12 mb-3" /><p className="text-sm">No PPPoE profiles yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Rate Limit</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">IP Pool</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Shared Users</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{p.rate_limit || "—"}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 hidden sm:table-cell">{p.ip_pool || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">{p.shared_users}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => open(p)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del(p)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{edit ? "Edit Profile" : "Add PPPoE Profile"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">Rate Limit</Label><Input value={form.rate_limit} onChange={e => setForm({ ...form, rate_limit: e.target.value })} placeholder="e.g. 10M/10M" /></div>
            <div><Label className="text-xs">IP Pool</Label><Input value={form.ip_pool} onChange={e => setForm({ ...form, ip_pool: e.target.value })} placeholder="e.g. 10.5.50.0/24" /></div>
            <div><Label className="text-xs">Shared Users</Label><Input type="number" value={form.shared_users} onChange={e => setForm({ ...form, shared_users: e.target.value })} /></div>
            <Button onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-700">{edit ? "Update" : "Create"} Profile</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}