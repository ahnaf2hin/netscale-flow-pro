import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Loader2, MapPin } from "lucide-react";

export default function Zones() {
  const { toast } = useToast();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", color: "#6366f1", status: "active" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await netscaleApi.entities.Zone.list("-created_date", 200);
      setZones(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditId(null); setForm({ name: "", description: "", color: "#6366f1", status: "active" }); setOpen(true); };
  const openEdit = (z) => { setEditId(z.id); setForm({ name: z.name, description: z.description || "", color: z.color || "#6366f1", status: z.status }); setOpen(true); };

  const save = async () => {
    if (!form.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      if (editId) await netscaleApi.entities.Zone.update(editId, form);
      else await netscaleApi.entities.Zone.create(form);
      toast({ title: editId ? "Zone updated" : "Zone created" });
      setOpen(false);
      load();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this zone?")) return;
    try { await netscaleApi.entities.Zone.delete(id); toast({ title: "Zone deleted" }); load(); }
    catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Zones</h1>
            <p className="text-xs text-slate-500">Manage service areas for customer assignment</p>
          </div>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add Zone</Button>
      </div>

      {zones.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-400">
          <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No zones yet — add your first service area</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map(z => (
            <div key={z.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: z.color || "#6366f1" }} />
                  <h3 className="text-sm font-semibold text-slate-900">{z.name}</h3>
                </div>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${z.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{z.status}</span>
              </div>
              {z.description && <p className="text-xs text-slate-500 mb-3">{z.description}</p>}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => openEdit(z)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => remove(z.id)}><Trash2 className="w-3 h-3 mr-1" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit Zone" : "Add Zone"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. MOTIJHEEL" /></div>
            <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Color</Label><Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-9" /></div>
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{editId ? "Update" : "Create"} Zone</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}