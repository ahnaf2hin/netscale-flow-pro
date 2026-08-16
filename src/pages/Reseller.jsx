import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Store, Plus, Pencil, Trash2, RefreshCw, Search, UserCheck, DollarSign, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

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

export default function Reseller() {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editReseller, setEditReseller] = useState(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "", address: "", balance: "0", commission_rate: "0", total_customers: "0", status: "active", join_date: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const r = await base44.entities.Reseller.list("-created_date", 200);
      setResellers(r);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditReseller(null); setForm({ name: "", company: "", phone: "", email: "", address: "", balance: "0", commission_rate: "0", total_customers: "0", status: "active", join_date: "" }); setShowForm(true); };
  const openEdit = (r) => { setEditReseller(r); setForm({ name: r.name || "", company: r.company || "", phone: r.phone || "", email: r.email || "", address: r.address || "", balance: String(r.balance || 0), commission_rate: String(r.commission_rate || 0), total_customers: String(r.total_customers || 0), status: r.status || "active", join_date: r.join_date || "" }); setShowForm(true); };

  const saveReseller = async () => {
    const data = { ...form, balance: parseFloat(form.balance), commission_rate: parseFloat(form.commission_rate), total_customers: parseInt(form.total_customers) };
    try {
      if (editReseller) { await base44.entities.Reseller.update(editReseller.id, data); }
      else { await base44.entities.Reseller.create(data); }
      setShowForm(false);
      loadData();
      toast({ title: editReseller ? "Reseller updated" : "Reseller added" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deleteReseller = async (r) => {
    if (!window.confirm(`Delete reseller "${r.name}"?`)) return;
    try {
      await base44.entities.Reseller.delete(r.id);
      loadData();
      toast({ title: "Reseller deleted" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = resellers.filter(r => !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.company?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search));

  const activeCount = resellers.filter(r => r.status === "active").length;
  const inactiveCount = resellers.filter(r => r.status === "inactive").length;
  const blockedCount = resellers.filter(r => r.status === "blocked").length;
  const totalBalance = resellers.reduce((s, r) => s + (r.balance || 0), 0);
  const totalCustomers = resellers.reduce((s, r) => s + (r.total_customers || 0), 0);

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-600 flex items-center justify-center">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reseller Management</h1>
            <p className="text-xs text-slate-500">Manage reseller partners, balances & commissions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Add Reseller
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Resellers" value={resellers.length} icon={Store} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <StatCard label="Active" value={activeCount} icon={UserCheck} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Total Balance" value={formatBDT(totalBalance)} icon={DollarSign} bg="bg-teal-500" iconBg="bg-teal-600" />
        <StatCard label="Reseller Clients" value={totalCustomers} icon={Users} bg="bg-amber-500" iconBg="bg-amber-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, company, phone..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Store className="w-12 h-12 mb-3" />
            <p className="text-sm">No resellers yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Reseller</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Contact</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Balance</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Commission</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden lg:table-cell">Customers</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Store className="w-4 h-4 text-amber-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{r.name}</p>
                          <p className="text-[10px] text-slate-400">{r.company || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">{r.phone || "—"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{formatBDT(r.balance)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">{r.commission_rate || 0}%</td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden lg:table-cell">{r.total_customers || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${r.status === "active" ? "bg-emerald-100 text-emerald-700" : r.status === "blocked" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteReseller(r)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
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
          <DialogHeader><DialogTitle>{editReseller ? "Edit Reseller" : "Add Reseller"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label className="text-xs">Company</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-xs">Balance (৳)</Label><Input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} /></div>
              <div><Label className="text-xs">Commission %</Label><Input type="number" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: e.target.value })} /></div>
              <div><Label className="text-xs">Customers</Label><Input type="number" value={form.total_customers} onChange={e => setForm({ ...form, total_customers: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Join Date</Label><Input type="date" value={form.join_date} onChange={e => setForm({ ...form, join_date: e.target.value })} /></div>
            </div>
            <Button onClick={saveReseller} className="w-full bg-indigo-600 hover:bg-indigo-700">{editReseller ? "Update Reseller" : "Add Reseller"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}