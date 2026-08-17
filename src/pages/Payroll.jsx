import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Wallet, RefreshCw, Search, DollarSign, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function Payroll() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", salary: "", role: "support", status: "active" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const s = await netscaleApi.entities.Staff.list("-created_date", 200);
      setStaff(s);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openEdit = (s) => { setEditStaff(s); setForm({ name: s.name, salary: String(s.salary || ""), role: s.role || "support", status: s.status || "active" }); setShowForm(true); };

  const savePayroll = async () => {
    try {
      await netscaleApi.entities.Staff.update(editStaff.id, { salary: parseFloat(form.salary) || 0 });
      setShowForm(false);
      loadData();
      toast({ title: "Salary updated" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = staff.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.role?.toLowerCase().includes(search.toLowerCase()));
  const totalPayroll = staff.reduce((s, x) => s + (x.salary || 0), 0);
  const activeCount = staff.filter(s => s.status === "active").length;
  const avgSalary = staff.length > 0 ? totalPayroll / staff.length : 0;

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-600 flex items-center justify-center"><Wallet className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Payroll Management</h1>
            <p className="text-xs text-slate-500">Staff salaries & payroll tracking</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Payroll" value={formatBDT(totalPayroll)} icon={DollarSign} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Active Staff" value={activeCount} icon={Users} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Avg Salary" value={formatBDT(avgSalary)} icon={Wallet} bg="bg-teal-500" iconBg="bg-teal-600" />
        <ColorStatCard label="Total Staff" value={staff.length} icon={Users} bg="bg-slate-500" iconBg="bg-slate-600" />
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff, role..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Wallet className="w-12 h-12 mb-3" /><p className="text-sm">No staff records</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Role</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Monthly Salary</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">{(s.name || "?")[0].toUpperCase()}</div>
                        <span className="text-sm font-medium text-slate-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-100 text-indigo-700">{s.role}</span></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${s.status === "active" ? "text-emerald-600" : "text-slate-400"}`}><span className={`w-1.5 h-1.5 rounded-full ${s.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />{s.status === "active" ? "Active" : "Inactive"}</span></td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{formatBDT(s.salary)}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => openEdit(s)} className="text-xs text-indigo-600 hover:underline">Edit Salary</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Salary — {editStaff?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Monthly Salary (৳)</Label><Input type="number" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} /></div>
            <Button onClick={savePayroll} className="w-full bg-indigo-600 hover:bg-indigo-700">Update Salary</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}