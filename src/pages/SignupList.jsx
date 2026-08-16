import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, UserPlus, RefreshCw, Search, Check, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function SignupList() {
  const [signups, setSignups] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", package_id: "", package_name: "", notes: "", status: "pending", request_date: new Date().toISOString().split("T")[0] });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [s, p] = await Promise.all([
        base44.entities.SignupRequest.list("-created_date", 500),
        base44.entities.Package.list("-created_date", 100),
      ]);
      setSignups(s);
      setPackages(p);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveSignup = async () => {
    try {
      await base44.entities.SignupRequest.create(form);
      setShowForm(false);
      loadData();
      toast({ title: "Signup request added" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const updateStatus = async (s, status) => {
    try {
      await base44.entities.SignupRequest.update(s.id, { status });
      loadData();
      toast({ title: `Request ${status}` });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = signups.filter(s => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pending = signups.filter(s => s.status === "pending").length;
  const approved = signups.filter(s => s.status === "approved").length;
  const rejected = signups.filter(s => s.status === "rejected").length;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center"><UserPlus className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Signup List</h1>
            <p className="text-xs text-slate-500">New connection requests & approvals</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={() => { setForm({ name: "", phone: "", email: "", address: "", package_id: "", package_name: "", notes: "", status: "pending", request_date: new Date().toISOString().split("T")[0] }); setShowForm(true); }} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm"><UserPlus className="w-3.5 h-3.5" /> New Request</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Requests" value={signups.length} icon={UserPlus} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Pending" value={pending} icon={UserPlus} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="Approved" value={approved} icon={Check} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Rejected" value={rejected} icon={X} bg="bg-rose-500" iconBg="bg-rose-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><UserPlus className="w-12 h-12 mb-3" /><p className="text-sm">No signup requests</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Phone</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Package</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{s.name}</p>
                      <p className="text-[10px] text-slate-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><div className="flex items-center gap-1.5 text-xs text-slate-600"><Phone className="w-3 h-3" />{s.phone}</div></td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">{s.package_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${s.status === "approved" ? "bg-emerald-100 text-emerald-700" : s.status === "rejected" ? "bg-red-100 text-red-700" : s.status === "contacted" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => updateStatus(s, "approved")} className="w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => updateStatus(s, "rejected")} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
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
          <DialogHeader><DialogTitle>New Signup Request</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label className="text-xs">Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Package</Label>
              <Select value={form.package_id} onValueChange={v => { const pkg = packages.find(p => p.id === v); setForm({ ...form, package_id: v, package_name: pkg?.name || "" }); }}>
                <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                <SelectContent>{packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={saveSignup} className="w-full bg-indigo-600 hover:bg-indigo-700">Add Request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}