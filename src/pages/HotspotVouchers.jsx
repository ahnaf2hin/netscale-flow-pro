import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Ticket, Plus, Trash2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function HotspotVouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ count: "10", profile: "", validity: "1d", price: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [v, p] = await Promise.all([
        netscaleApi.entities.HotspotVoucher.list("-created_date", 500),
        netscaleApi.entities.HotspotProfile.list("-created_date", 100),
      ]);
      setVouchers(v); setProfiles(p);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const generate = async () => {
    const count = parseInt(form.count) || 1;
    const records = [];
    for (let i = 0; i < count; i++) {
      records.push({
        code: Math.random().toString(36).slice(2, 8).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
        profile: form.profile,
        validity: form.validity,
        price: parseFloat(form.price) || 0,
        status: "unused",
      });
    }
    try {
      await netscaleApi.entities.HotspotVoucher.bulkCreate(records);
      setShowForm(false); loadData();
      toast({ title: `${count} vouchers generated` });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const del = async (v) => { try { await netscaleApi.entities.HotspotVoucher.delete(v.id); loadData(); } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); } };

  const filtered = vouchers.filter(v => !search || v.code?.toLowerCase().includes(search.toLowerCase()) || v.profile?.toLowerCase().includes(search.toLowerCase()));
  const unused = vouchers.filter(v => v.status === "unused").length;
  const used = vouchers.filter(v => v.status === "used").length;
  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <PageHeader icon={Ticket} iconBg="bg-amber-600" title="Hotspot Vouchers" subtitle="Generate and track prepaid voucher codes">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        <button onClick={() => { setForm({ count: "10", profile: "", validity: "1d", price: "" }); setShowForm(true); }} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Generate Vouchers</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Vouchers" value={vouchers.length} icon={Ticket} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Unused" value={unused} icon={Ticket} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="Used" value={used} icon={Ticket} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Revenue" value={formatBDT(vouchers.filter(v => v.status === "used").reduce((s, v) => s + (v.price || 0), 0))} icon={Ticket} bg="bg-teal-500" iconBg="bg-teal-600" />
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code, profile..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Ticket className="w-12 h-12 mb-3" /><p className="text-sm">No vouchers generated</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Code</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Profile</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Validity</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Price</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-mono font-bold text-slate-900">{v.code}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">{v.profile || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{v.validity || "—"}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 hidden md:table-cell">{formatBDT(v.price)}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${v.status === "unused" ? "bg-amber-100 text-amber-700" : v.status === "used" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{v.status}</span></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => del(v)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center ml-auto"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generate Vouchers</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Quantity</Label><Input type="number" value={form.count} onChange={e => setForm({ ...form, count: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Profile</Label>
              <Select value={form.profile} onValueChange={v => setForm({ ...form, profile: v })}>
                <SelectTrigger><SelectValue placeholder="Select profile" /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Validity</Label><Input value={form.validity} onChange={e => setForm({ ...form, validity: e.target.value })} /></div>
              <div><Label className="text-xs">Price (৳)</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            </div>
            <Button onClick={generate} className="w-full bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" /> Generate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}