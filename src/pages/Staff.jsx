import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Users, Plus, Pencil, Trash2, RefreshCw, Search, UserCheck, UserX, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const roleColors = {
  admin: "bg-indigo-100 text-indigo-700",
  manager: "bg-violet-100 text-violet-700",
  technician: "bg-cyan-100 text-cyan-700",
  support: "bg-amber-100 text-amber-700",
  billing: "bg-emerald-100 text-emerald-700",
};

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "support", department: "", status: "active", address: "", salary: "", join_date: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const s = await netscaleApi.entities.Staff.list("-created_date", 200);
      setStaff(s);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditStaff(null); setForm({ name: "", email: "", phone: "", role: "support", department: "", status: "active", address: "", salary: "", join_date: "" }); setShowForm(true); };
  const openEdit = (s) => { setEditStaff(s); setForm({ name: s.name || "", email: s.email || "", phone: s.phone || "", role: s.role || "support", department: s.department || "", status: s.status || "active", address: s.address || "", salary: s.salary ? String(s.salary) : "", join_date: s.join_date || "" }); setShowForm(true); };

  const saveStaff = async () => {
    const data = { ...form, salary: form.salary ? parseFloat(form.salary) : undefined };
    try {
      if (editStaff) { await netscaleApi.entities.Staff.update(editStaff.id, data); }
      else { await netscaleApi.entities.Staff.create(data); }
      setShowForm(false);
      loadData();
      toast({ title: editStaff ? "Staff updated" : "Staff added" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deleteStaff = async (s) => {
    if (!window.confirm(`Remove staff member "${s.name}"?`)) return;
    try {
      await netscaleApi.entities.Staff.delete(s.id);
      loadData();
      toast({ title: "Staff removed" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = staff.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()) || s.role?.toLowerCase().includes(search.toLowerCase()));

  const activeCount = staff.filter(s => s.status === "active").length;
  const inactiveCount = staff.filter(s => s.status === "inactive").length;
  const adminCount = staff.filter(s => s.role === "admin").length;
  const technicianCount = staff.filter(s => s.role === "technician").length;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-600 flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Staff Management</h1>
            <p className="text-xs text-slate-500">Team members, roles & departments</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Add Staff
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Staff" value={staff.length} icon={Users} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <StatCard label="Active" value={activeCount} icon={UserCheck} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Inactive" value={inactiveCount} icon={UserX} bg="bg-slate-500" iconBg="bg-slate-600" />
        <StatCard label="Technicians" value={technicianCount} icon={Briefcase} bg="bg-cyan-500" iconBg="bg-cyan-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, role..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-12 h-12 mb-3" />
            <p className="text-sm">No staff members yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Contact</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Role</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Department</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden lg:table-cell">Join Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">{(s.name || "?")[0].toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.name}</p>
                          <p className="text-[10px] text-slate-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">{s.phone || "—"}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${roleColors[s.role] || roleColors.support}`}>{s.role}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">{s.department || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{s.join_date || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${s.status === "active" ? "text-emerald-600" : "text-slate-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {s.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteStaff(s)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editStaff ? "Edit Staff" : "Add Staff Member"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Department</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Salary</Label><Input type="number" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} /></div>
              <div><Label className="text-xs">Join Date</Label><Input type="date" value={form.join_date} onChange={e => setForm({ ...form, join_date: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveStaff} className="w-full bg-indigo-600 hover:bg-indigo-700">{editStaff ? "Update Staff" : "Add Staff"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}