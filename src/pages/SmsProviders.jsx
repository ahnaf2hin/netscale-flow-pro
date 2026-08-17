import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, MessageSquare, Plus, Pencil, Trash2, RefreshCw, Eye, EyeOff, Star, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const PROVIDERS = [
  { value: "ssl_wireless", label: "SSL Wireless", keyLabel: "API Key", secretLabel: "API Secret", defaultBase: "https://sms.sslwireless.com" },
  { value: "bulksmsbd", label: "BulkSMSBD", keyLabel: "Username", secretLabel: "Password", defaultBase: "https://bulksmsbd.com/api" },
  { value: "revesms", label: "ReveSMS", keyLabel: "API Key", secretLabel: "Secret", defaultBase: "https://api.revesms.com" },
  { value: "twilio", label: "Twilio", keyLabel: "Account SID", secretLabel: "Auth Token", defaultBase: "https://api.twilio.com" },
  { value: "custom", label: "Custom HTTP API", keyLabel: "API Key", secretLabel: "Secret", defaultBase: "" },
];

const emptyForm = {
  provider: "ssl_wireless",
  display_name: "",
  api_url: "",
  api_key: "",
  api_secret: "",
  sender_id: "",
  is_active: true,
  is_default: false,
  notes: "",
};

export default function SmsProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showSecret, setShowSecret] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadProviders(); }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const data = await netscaleApi.entities.SmsProvider.list("-created_date", 50);
      setProviders(data);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load providers", description: err.message });
    } finally { setLoading(false); }
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowSecret(false);
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setForm({
      provider: p.provider || "ssl_wireless",
      display_name: p.display_name || "",
      api_url: p.api_url || "",
      api_key: p.api_key || "",
      api_secret: p.api_secret || "",
      sender_id: p.sender_id || "",
      is_active: p.is_active !== false,
      is_default: p.is_default === true,
      notes: p.notes || "",
    });
    setEditingId(p.id);
    setShowSecret(false);
    setDialogOpen(true);
  };

  const onProviderChange = (provider) => {
    const meta = PROVIDERS.find(p => p.value === provider);
    setForm(f => ({
      ...f,
      provider,
      display_name: f.display_name || meta?.label || "",
      api_url: f.api_url || meta?.defaultBase || "",
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
        await netscaleApi.entities.SmsProvider.update(editingId, form);
      } else {
        await netscaleApi.entities.SmsProvider.create(form);
      }
      if (form.is_default) {
        const others = providers.filter(p => p.id !== editingId && p.is_default);
        for (const p of others) {
          await netscaleApi.entities.SmsProvider.update(p.id, { is_default: false });
        }
      }
      toast({ title: "Provider saved", description: `${form.display_name} configuration stored.` });
      setDialogOpen(false);
      loadProviders();
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Delete ${p.display_name}?`)) return;
    try {
      await netscaleApi.entities.SmsProvider.delete(p.id);
      toast({ title: "Provider deleted" });
      loadProviders();
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err.message });
    }
  };

  const toggleActive = async (p) => {
    try {
      await netscaleApi.entities.SmsProvider.update(p.id, { is_active: !p.is_active });
      loadProviders();
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    }
  };

  const setDefault = async (p) => {
    try {
      await netscaleApi.entities.SmsProvider.update(p.id, { is_default: true });
      const others = providers.filter(g => g.id !== p.id && g.is_default);
      for (const g of others) {
        await netscaleApi.entities.SmsProvider.update(g.id, { is_default: false });
      }
      toast({ title: `${p.display_name} set as default` });
      loadProviders();
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
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">SMS Providers</h1>
            <p className="text-xs text-slate-500">Configure bulk SMS gateway credentials for notifications & reminders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadProviders} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Button onClick={openAdd} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Provider
          </Button>
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No SMS providers configured</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Add your bulk SMS gateway credentials to send notifications and reminders.</p>
          <Button onClick={openAdd} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Provider
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map(p => {
            const pMeta = PROVIDERS.find(x => x.value === p.provider);
            return (
              <div key={p.id} className="glass-card p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        {p.display_name}
                        {p.is_default && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                      </h3>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide">{pMeta?.label || p.provider}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 mb-3 flex-1">
                  <div className="flex justify-between"><span className="text-slate-400">Sender ID</span><span className="font-medium">{p.sender_id || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">{pMeta?.keyLabel}</span><span className="font-mono truncate max-w-[140px]">{p.api_key ? "••••••" + p.api_key.slice(-4) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">{pMeta?.secretLabel}</span><span className="font-mono">{p.api_secret ? "configured" : "—"}</span></div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                    {!p.is_default && (
                      <button onClick={() => setDefault(p)} className="text-[11px] text-slate-500 hover:text-amber-600 flex items-center gap-1">
                        <Star className="w-3 h-3" /> Set default
                      </button>
                    )}
                    {p.is_default && (
                      <span className="text-[11px] text-amber-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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
            <DialogTitle>{editingId ? "Edit SMS Provider" : "Add SMS Provider"}</DialogTitle>
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
                <Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="e.g. SSL Wireless" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">API URL</Label>
              <Input value={form.api_url} onChange={e => setForm({ ...form, api_url: e.target.value })} placeholder={meta?.defaultBase || "https://api.sms-provider.com/send"} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{meta?.keyLabel || "API Key"}</Label>
              <Input value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder={meta?.keyLabel} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{meta?.secretLabel || "Secret"}</Label>
                <button type="button" onClick={() => setShowSecret(s => !s)} className="text-slate-400 hover:text-slate-600">
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <Input type={showSecret ? "text" : "password"} value={form.api_secret} onChange={e => setForm({ ...form, api_secret: e.target.value })} placeholder={meta?.secretLabel} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Sender ID / Mask</Label>
              <Input value={form.sender_id} onChange={e => setForm({ ...form, sender_id: e.target.value })} placeholder="e.g. KGSOFT" />
            </div>

            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                Active
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Switch checked={form.is_default} onCheckedChange={v => setForm({ ...form, is_default: v })} />
                Default provider
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
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}