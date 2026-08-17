import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Handshake, RefreshCw, TrendingUp, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function ResellerCommissions() {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ commission_rate: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setResellers(await netscaleApi.entities.Reseller.list("-created_date", 200)); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const open = (r) => { setEditId(r.id); setForm({ commission_rate: String(r.commission_rate || 0) }); setShowForm(true); };

  const save = async () => {
    try {
      await netscaleApi.entities.Reseller.update(editId, { commission_rate: parseFloat(form.commission_rate) || 0 });
      setShowForm(false); loadData();
      toast({ title: "Commission rate updated" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const totalCommission = resellers.reduce((s, r) => s + ((r.balance || 0) * (r.commission_rate || 0) / 100), 0);
  const totalCustomers = resellers.reduce((s, r) => s + (r.total_customers || 0), 0);
  const avgRate = resellers.length ? resellers.reduce((s, r) => s + (r.commission_rate || 0), 0) / resellers.length : 0;
  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <PageHeader icon={Handshake} iconBg="bg-amber-600" title="Reseller Commissions" subtitle="Manage commission rates & track earnings per reseller">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Resellers" value={resellers.length} icon={Handshake} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Total Customers" value={totalCustomers} icon={Users} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Avg Commission" value={`${avgRate.toFixed(1)}%`} icon={TrendingUp} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="Est. Payout" value={formatBDT(totalCommission)} icon={DollarSign} bg="bg-teal-500" iconBg="bg-teal-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {resellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Handshake className="w-12 h-12 mb-3" /><p className="text-sm">No resellers yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Reseller</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Company</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Customers</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Balance</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Commission</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Est. Payout</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map(r => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">{r.company || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.total_customers || 0}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{formatBDT(r.balance)}</td>
                    <td className="px-4 py-3"><span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{(r.commission_rate || 0).toFixed(1)}%</span></td>
                    <td className="px-4 py-3 text-xs font-semibold text-emerald-600">{formatBDT((r.balance || 0) * (r.commission_rate || 0) / 100)}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => open(r)} className="text-xs text-indigo-600 hover:underline">Set Rate</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Set Commission Rate</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Commission Rate (%)</Label><Input type="number" step="any" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: e.target.value })} /></div>
            <Button onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-700">Update Rate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}