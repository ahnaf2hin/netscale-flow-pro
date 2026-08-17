import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Cable, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function CableRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", start_lat: "", start_lng: "", end_lat: "", end_lng: "", cable_type: "fiber", length_meters: "", notes: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setRoutes(await netscaleApi.entities.CableRoute.list("-created_date", 500)); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const save = async () => {
    const data = { ...form, start_lat: parseFloat(form.start_lat) || 0, start_lng: parseFloat(form.start_lng) || 0, end_lat: parseFloat(form.end_lat) || 0, end_lng: parseFloat(form.end_lng) || 0, length_meters: parseFloat(form.length_meters) || 0 };
    try {
      await netscaleApi.entities.CableRoute.create(data);
      setShowForm(false); loadData();
      toast({ title: "Cable route added" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const del = async (r) => { if (!window.confirm("Delete this cable route?")) return; try { await netscaleApi.entities.CableRoute.delete(r.id); loadData(); toast({ title: "Route deleted" }); } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); } };

  const totalLength = routes.reduce((s, r) => s + (r.length_meters || 0), 0);
  const byType = (type) => routes.filter(r => r.cable_type === type).length;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <PageHeader icon={Cable} iconBg="bg-cyan-600" title="Cable Routes" subtitle="Fiber, UTP & drop cable route inventory">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        <button onClick={() => { setForm({ name: "", start_lat: "", start_lng: "", end_lat: "", end_lng: "", cable_type: "fiber", length_meters: "", notes: "" }); setShowForm(true); }} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Route</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Routes" value={routes.length} icon={Cable} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Total Length" value={`${(totalLength / 1000).toFixed(2)} km`} icon={Cable} bg="bg-cyan-500" iconBg="bg-cyan-600" />
        <ColorStatCard label="Fiber" value={byType("fiber")} icon={Cable} bg="bg-teal-500" iconBg="bg-teal-600" />
        <ColorStatCard label="Drop Cable" value={byType("drop_cable")} icon={Cable} bg="bg-amber-500" iconBg="bg-amber-600" />
      </div>

      <div className="glass-card overflow-hidden">
        {routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Cable className="w-12 h-12 mb-3" /><p className="text-sm">No cable routes recorded</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Type</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Length</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Start Coords</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">End Coords</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(r => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{r.name || "—"}</td>
                    <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-cyan-100 text-cyan-700">{r.cable_type}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">{r.length_meters ? `${r.length_meters} m` : "—"}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-slate-500 hidden md:table-cell">{r.start_lat?.toFixed(4)}, {r.start_lng?.toFixed(4)}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-slate-500 hidden md:table-cell">{r.end_lat?.toFixed(4)}, {r.end_lng?.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => del(r)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center ml-auto"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Cable Route</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Start Latitude</Label><Input type="number" step="any" value={form.start_lat} onChange={e => setForm({ ...form, start_lat: e.target.value })} /></div>
              <div><Label className="text-xs">Start Longitude</Label><Input type="number" step="any" value={form.start_lng} onChange={e => setForm({ ...form, start_lng: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">End Latitude</Label><Input type="number" step="any" value={form.end_lat} onChange={e => setForm({ ...form, end_lat: e.target.value })} /></div>
              <div><Label className="text-xs">End Longitude</Label><Input type="number" step="any" value={form.end_lng} onChange={e => setForm({ ...form, end_lng: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Cable Type</Label>
                <Select value={form.cable_type} onValueChange={v => setForm({ ...form, cable_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fiber">Fiber</SelectItem>
                    <SelectItem value="utp">UTP</SelectItem>
                    <SelectItem value="coaxial">Coaxial</SelectItem>
                    <SelectItem value="drop_cable">Drop Cable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Length (m)</Label><Input type="number" value={form.length_meters} onChange={e => setForm({ ...form, length_meters: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <Button onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-700">Add Route</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}