import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, CreditCard, Plus, Pencil, Trash2, RefreshCw, Eye, EyeOff, Star, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const PROVIDERS = [
  { value: "sslcommerz", label: "SSLCommerz", keyLabel: "Store ID", secretLabel: "Store Password", defaultBase: "https://sandbox.sslcommerz.com" },
  { value: "stripe", label: "Stripe", keyLabel: "Publishable Key", secretLabel: "Secret Key", defaultBase: "" },
  { value: "bkash", label: "bKash", keyLabel: "App Key", secretLabel: "App Secret", defaultBase: "" },
  { value: "nagad", label: "Nagad", keyLabel: "Merchant ID", secretLabel: "API Key", defaultBase: "" },
  { value: "cash", label: "Cash", keyLabel: "—", secretLabel: "—", defaultBase: "" },
  { value: "bank_transfer", label: "Bank Transfer", keyLabel: "Bank Account", secretLabel: "—", defaultBase: "" },
];

const emptyForm = {
  provider: "sslcommerz",
  display_name: "",
  api_key: "",
  secret_key: "",
  api_base: "",
  mode: "sandbox",
  currency: "BDT",
  is_active: true,
  is_default: false,
  notes: "",
};

export default function PaymentGateways() {
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showSecret, setShowSecret] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadGateways(); }, []);

  const loadGateways = async () => {
    setLoading(true);
    try {
      const data = await netscaleApi.entities.PaymentGateway.list("-created_date", 50);
      setGateways(data);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load gateways", description: err.message });
    } finally { setLoading(false); }
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowSecret(false);
    setDialogOpen(true);
  };

  const openEdit = (gw) => {
    setForm({
      provider: gw.provider || "sslcommerz",
      display_name: gw.display_name || "",
      api_key: gw.api_key || "",
      secret_key: gw.secret_key || "",
      api_base: gw.api_base || "",
      mode: gw.mode || "sandbox",
      currency: gw.currency || "BDT",
      is_active: gw.is_active !== false,
      is_default: gw.is_default === true,
      notes: gw.notes || "",
    });
    setEditingId(gw.id);
    setShowSecret(false);
    setDialogOpen(true);
  };

  const onProviderChange = (provider) => {
    const meta = PROVIDERS.find(p => p.value === provider);
    setForm(f => ({
      ...f,
      provider,
      display_name: f.display_name || meta?.label || "",
      api_base: f.api_base || meta?.defaultBase || "",
    }));
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast({ variant: "destructive", title: "Display name is required" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await netscaleApi.entities.PaymentGateway.update(editingId, form);
      } else {
        await netscaleApi.entities.PaymentGateway.create(form);
      }
      // enforce single default
      if (form.is_default) {
        const others = gateways.filter(g => g.id !== editingId && g.is_default);
        for (const g of others) {
          await netscaleApi.entities.PaymentGateway.update(g.id, { is_default: false });
        }
      }
      toast({ title: "Gateway saved", description: `${form.display_name} configuration stored.` });
      setDialogOpen(false);
      loadGateways();
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async (gw) => {
    if (!confirm(`Delete ${gw.display_name}?`)) return;
    try {
      await netscaleApi.entities.PaymentGateway.delete(gw.id);
      toast({ title: "Gateway deleted" });
      loadGateways();
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err.message });
    }
  };

  const toggleActive = async (gw) => {
    try {
      await netscaleApi.entities.PaymentGateway.update(gw.id, { is_active: !gw.is_active });
      loadGateways();
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    }
  };

  const setDefault = async (gw) => {
    try {
      await netscaleApi.entities.PaymentGateway.update(gw.id, { is_default: true });
      const others = gateways.filter(g => g.id !== gw.id && g.is_default);
      for (const g of others) {
        await netscaleApi.entities.PaymentGateway.update(g.id, { is_default: false });
      }
      toast({ title: `${gw.display_name} set as default` });
      loadGateways();
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    }
  };

  const meta = PROVIDERS.find(p => p.value === form.provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Payment Gateways</h1>
            <p className="text-xs text-slate-500">Configure gateway credentials for customer portal payments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadGateways} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Button onClick={openAdd} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Gateway
          </Button>
        </div>
      </div>

      {gateways.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No payment gateways configured</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Add your first gateway to enable online bill payments in the customer portal.</p>
          <Button onClick={openAdd} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Gateway
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gateways.map(gw => {
            const pMeta = PROVIDERS.find(p => p.value === gw.provider);
            return (
              <div key={gw.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        {gw.display_name}
                        {gw.is_default && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                      </h3>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide">{pMeta?.label || gw.provider}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${gw.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                    {gw.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 mb-3 flex-1">
                  <div className="flex justify-between"><span className="text-slate-400">Mode</span><span className="font-medium capitalize">{gw.mode}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Currency</span><span className="font-medium">{gw.currency}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">{pMeta?.keyLabel}</span><span className="font-mono truncate max-w-[140px]">{gw.api_key ? "••••••" + gw.api_key.slice(-4) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">{pMeta?.secretLabel}</span><span className="font-mono">{gw.secret_key ? "configured" : "—"}</span></div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={gw.is_active} onCheckedChange={() => toggleActive(gw)} />
                    {!gw.is_default && (
                      <button onClick={() => setDefault(gw)} className="text-[11px] text-slate-500 hover:text-amber-600 flex items-center gap-1">
                        <Star className="w-3 h-3" /> Set default
                      </button>
                    )}
                    {gw.is_default && (
                      <span className="text-[11px] text-amber-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(gw)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(gw)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link to="/configuration" className="text-xs text-slate-500 hover:text-indigo-600">← Back to Configuration</Link>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Gateway" : "Add Payment Gateway"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={form.provider} onValueChange={onProviderChange}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Display Name</Label>
                <Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="e.g. SSLCommerz" />
              </div>
            </div>

            {form.provider !== "cash" && (
              <div className="space-y-1.5">
                <Label className="text-xs">{meta?.keyLabel || "API Key"}</Label>
                <Input value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder={meta?.keyLabel} />
              </div>
            )}

            {form.provider !== "cash" && form.provider !== "bank_transfer" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{meta?.secretLabel || "Secret Key"}</Label>
                  <button type="button" onClick={() => setShowSecret(s => !s)} className="text-slate-400 hover:text-slate-600">
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Input type={showSecret ? "text" : "password"} value={form.secret_key} onChange={e => setForm({ ...form, secret_key: e.target.value })} placeholder={meta?.secretLabel} />
              </div>
            )}

            {form.provider === "sslcommerz" && (
              <div className="space-y-1.5">
                <Label className="text-xs">API Base URL</Label>
                <Input value={form.api_base} onChange={e => setForm({ ...form, api_base: e.target.value })} placeholder="https://sandbox.sslcommerz.com" />
                <p className="text-[10px] text-slate-400">Sandbox: https://sandbox.sslcommerz.com · Live: https://securepay.sslcommerz.com</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mode</Label>
                <Select value={form.mode} onValueChange={v => setForm({ ...form, mode: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} placeholder="BDT" />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                Active
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Switch checked={form.is_default} onCheckedChange={v => setForm({ ...form, is_default: v })} />
                Default gateway
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Gateway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}