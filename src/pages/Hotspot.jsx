import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Wifi, Plus, Pencil, Trash2, RefreshCw, Search, User, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function Hotspot() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", password: "", profile: "", ip_address: "", mac_address: "", limit_uptime: "", status: "active", comment: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const u = await netscaleApi.entities.HotspotUser.list("-created_date", 500);
      setUsers(u);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditUser(null); setForm({ username: "", password: "", profile: "", ip_address: "", mac_address: "", limit_uptime: "", status: "active", comment: "" }); setShowForm(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ username: u.username || "", password: u.password || "", profile: u.profile || "", ip_address: u.ip_address || "", mac_address: u.mac_address || "", limit_uptime: u.limit_uptime || "", status: u.status || "active", comment: u.comment || "" }); setShowForm(true); };

  const saveUser = async () => {
    try {
      if (editUser) { await netscaleApi.entities.HotspotUser.update(editUser.id, form); }
      else { await netscaleApi.entities.HotspotUser.create(form); }
      setShowForm(false);
      loadData();
      toast({ title: editUser ? "User updated" : "User created" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete hotspot user "${u.username}"?`)) return;
    try { await netscaleApi.entities.HotspotUser.delete(u.id); loadData(); toast({ title: "User deleted" }); }
    catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = users.filter(u => !search || u.username?.toLowerCase().includes(search.toLowerCase()) || u.mac_address?.toLowerCase().includes(search.toLowerCase()));
  const active = users.filter(u => u.status === "active").length;
  const expired = users.filter(u => u.status === "expired").length;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-600 flex items-center justify-center"><Wifi className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hotspot Management</h1>
            <p className="text-xs text-slate-500">Hotspot users, vouchers & active sessions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={openCreate} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Add User</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Users" value={users.length} icon={User} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Active" value={active} icon={Wifi} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Expired" value={expired} icon={Ticket} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="Profiles" value={new Set(users.map(u => u.profile).filter(Boolean)).size} icon={Ticket} bg="bg-violet-500" iconBg="bg-violet-600" />
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username, MAC..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Wifi className="w-12 h-12 mb-3" /><p className="text-sm">No hotspot users</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Username</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Profile</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">IP / MAC</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden lg:table-cell">Uptime Limit</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3"><p className="text-sm font-medium text-slate-900">{u.username}</p>{u.comment && <p className="text-[10px] text-slate-400">{u.comment}</p>}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">{u.profile || "—"}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 hidden md:table-cell">{u.ip_address || u.mac_address || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{u.limit_uptime || "—"}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${u.status === "active" ? "bg-emerald-100 text-emerald-700" : u.status === "expired" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{u.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteUser(u)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editUser ? "Edit Hotspot User" : "Add Hotspot User"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Username *</Label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
              <div><Label className="text-xs">Password</Label><Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Profile</Label><Input value={form.profile} onChange={e => setForm({ ...form, profile: e.target.value })} /></div>
              <div><Label className="text-xs">Uptime Limit</Label><Input value={form.limit_uptime} onChange={e => setForm({ ...form, limit_uptime: e.target.value })} placeholder="e.g. 1d 00:00:00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">IP Address</Label><Input value={form.ip_address} onChange={e => setForm({ ...form, ip_address: e.target.value })} /></div>
              <div><Label className="text-xs">MAC Address</Label><Input value={form.mac_address} onChange={e => setForm({ ...form, mac_address: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Comment</Label><Input value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} /></div>
            <Button onClick={saveUser} className="w-full bg-indigo-600 hover:bg-indigo-700">{editUser ? "Update User" : "Add User"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}