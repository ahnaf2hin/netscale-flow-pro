import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Building2, Plus, Pencil, Trash2, RefreshCw, MapPin, Phone, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const emptyForm = {
  name: "", type: "sub_office", address: "", latitude: "", longitude: "", phone: "", is_active: true, notes: "",
};

export default function Offices() {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  useEffect(() => { loadOffices(); }, []);

  const loadOffices = async () => {
    setLoading(true);
    try {
      const data = await netscaleApi.entities.Office.list("-created_date", 100);
      setOffices(data);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load offices", description: err.message });
    } finally { setLoading(false); }
  };

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };

  const openEdit = (o) => {
    setForm({
      name: o.name || "",
      type: o.type || "sub_office",
      address: o.address || "",
      latitude: o.latitude ?? "",
      longitude: o.longitude ?? "",
      phone: o.phone || "",
      is_active: o.is_active !== false,
      notes: o.notes || "",
    });
    setEditingId(o.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ variant: "destructive", title: "Name is required" }); return; }
    if (form.type === "head_office") {
      // ensure only one head office
      const existingHQ = offices.find(o => o.id !== editingId && o.type === "head_office");
      if (existingHQ) {
        if (!confirm("There is already a head office. Make this the head office instead (the old one will become a sub office)?")) return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        address: form.address,
        latitude: form.latitude === "" ? null : parseFloat(form.latitude),
        longitude: form.longitude === "" ? null : parseFloat(form.longitude),
        phone: form.phone,
        is_active: form.is_active,
        notes: form.notes,
      };
      if (editingId) {
        await netscaleApi.entities.Office.update(editingId, payload);
      } else {
        await netscaleApi.entities.Office.create(payload);
      }
      if (form.type === "head_office") {
        const others = offices.filter(o => o.id !== editingId && o.type === "head_office");
        for (const o of others) {
          await netscaleApi.entities.Office.update(o.id, { type: "sub_office" });
        }
      }
      toast({ title: "Office saved" });
      setDialogOpen(false);
      loadOffices();
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async (o) => {
    if (!confirm(`Delete ${o.name}?`)) return;
    try {
      await netscaleApi.entities.Office.delete(o.id);
      toast({ title: "Office deleted" });
      loadOffices();
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err.message });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Offices</h1>
            <p className="text-xs text-slate-500">Head office & sub offices — shown on the network map</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadOffices} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Button onClick={openAdd} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Office
          </Button>
        </div>
      </div>

      {offices.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No offices added yet</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Add your head office first — the network map will center on it automatically.</p>
          <Button onClick={openAdd} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Office
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offices.map(o => (
            <div key={o.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${o.type === "head_office" ? "bg-blue-50" : "bg-amber-50"}`}>
                    <Building2 className={`w-5 h-5 ${o.type === "head_office" ? "text-blue-600" : "text-amber-600"}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      {o.name}
                      {o.type === "head_office" && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    </h3>
                    <p className="text-[11px] text-slate-500 capitalize">{o.type?.replace("_", " ")}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${o.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                  {o.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                {o.address && <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" /><span>{o.address}</span></div>}
                {o.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /><span>{o.phone}</span></div>}
                {o.latitude && o.longitude && (
                  <div className="text-[11px] text-slate-400 font-mono">{o.latitude}, {o.longitude}</div>
                )}
              </div>

              <div className="flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
                <button onClick={() => openEdit(o)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(o)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link to="/configuration" className="text-xs text-slate-500 hover:text-blue-600">← Back to Configuration</Link>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Office" : "Add Office"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Office Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Branch" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="head_office">Head Office</SelectItem>
                    <SelectItem value="sub_office">Sub Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street, city" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Latitude</Label>
                <Input type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="e.g. 23.8103" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Longitude</Label>
                <Input type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="e.g. 90.4125" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 -mt-2">Tip: right-click a spot in Google Maps to copy its coordinates.</p>

            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Contact number" />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              Active
            </label>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Office
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}