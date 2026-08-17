import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Package, Plus, Pencil, Trash2, RefreshCw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const { toast } = useToast();
  const [pkgForm, setPkgForm] = useState({ name: "", speed_mbps: "", monthly_price: "", validity_days: "30", description: "", is_active: true });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [pkg, custs] = await Promise.all([
        netscaleApi.entities.Package.list("-created_date", 100),
        netscaleApi.entities.Customer.list("-created_date", 500),
      ]);
      setPackages(pkg);
      setCustomers(custs);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditPkg(null); setPkgForm({ name: "", speed_mbps: "", monthly_price: "", validity_days: "30", description: "", is_active: true }); setShowForm(true); };
  const openEdit = (p) => { setEditPkg(p); setPkgForm({ name: p.name, speed_mbps: String(p.speed_mbps), monthly_price: String(p.monthly_price), validity_days: String(p.validity_days || 30), description: p.description || "", is_active: p.is_active !== false }); setShowForm(true); };

  const savePkg = async () => {
    const data = { ...pkgForm, speed_mbps: parseFloat(pkgForm.speed_mbps), monthly_price: parseFloat(pkgForm.monthly_price), validity_days: parseInt(pkgForm.validity_days) };
    try {
      if (editPkg) { await netscaleApi.entities.Package.update(editPkg.id, data); }
      else { await netscaleApi.entities.Package.create(data); }
      setShowForm(false);
      loadData();
      toast({ title: editPkg ? "Package updated" : "Package created" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deletePkg = async (p) => {
    if (!window.confirm(`Delete package "${p.name}"?`)) return;
    try {
      await netscaleApi.entities.Package.delete(p.id);
      loadData();
      toast({ title: "Package deleted" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;
  const activeCount = packages.filter(p => p.is_active !== false).length;
  const inactiveCount = packages.filter(p => p.is_active === false).length;
  const totalCustomers = customers.length;
  const avgPrice = packages.length > 0 ? packages.reduce((s, p) => s + (p.monthly_price || 0), 0) / packages.length : 0;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Packages & Pricing</h1>
            <p className="text-xs text-slate-500">Manage service plans and pricing tiers</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Add Package
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Packages" value={packages.length} icon={Package} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <StatCard label="Active Plans" value={activeCount} icon={Check} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Inactive" value={inactiveCount} icon={X} bg="bg-slate-500" iconBg="bg-slate-600" />
        <StatCard label="Avg Price" value={formatBDT(avgPrice)} icon={Package} bg="bg-violet-500" iconBg="bg-violet-600" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map(p => {
          const subscriberCount = customers.filter(c => c.package_id === p.id).length;
          return (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deletePkg(p)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <h3 className="font-semibold text-slate-900">{p.name}</h3>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatBDT(p.monthly_price)}<span className="text-sm font-normal text-slate-400">/mo</span></p>
              <div className="mt-3 space-y-1.5 text-sm text-slate-500">
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />Speed: <span className="font-semibold text-slate-700">{p.speed_mbps} Mbps</span></div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Validity: <span className="font-semibold text-slate-700">{p.validity_days || 30} days</span></div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />Subscribers: <span className="font-semibold text-slate-700">{subscriberCount}</span></div>
              </div>
              {p.description && <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">{p.description}</p>}
              <div className="mt-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${p.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{p.is_active !== false ? "Active" : "Inactive"}</span>
              </div>
            </div>
          );
        })}
        {packages.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">No packages yet — click "Add Package" to create one</p>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPkg ? "Edit Package" : "Add Package"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name *</Label><Input value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} placeholder="e.g. Basic 10Mbps" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Speed (Mbps) *</Label><Input type="number" value={pkgForm.speed_mbps} onChange={e => setPkgForm({ ...pkgForm, speed_mbps: e.target.value })} /></div>
              <div><Label className="text-xs">Monthly Price (BDT) *</Label><Input type="number" value={pkgForm.monthly_price} onChange={e => setPkgForm({ ...pkgForm, monthly_price: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Validity (days)</Label><Input type="number" value={pkgForm.validity_days} onChange={e => setPkgForm({ ...pkgForm, validity_days: e.target.value })} /></div>
            <div><Label className="text-xs">Description</Label><Input value={pkgForm.description} onChange={e => setPkgForm({ ...pkgForm, description: e.target.value })} /></div>
            <Button onClick={savePkg} className="w-full bg-indigo-600 hover:bg-indigo-700">{editPkg ? "Update Package" : "Create Package"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}