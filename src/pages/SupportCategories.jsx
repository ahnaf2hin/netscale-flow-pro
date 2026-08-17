import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, FolderKanban, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

const COLORS = [
  { value: "indigo", bg: "bg-blue-100 text-blue-700" },
  { value: "emerald", bg: "bg-emerald-100 text-emerald-700" },
  { value: "amber", bg: "bg-amber-100 text-amber-700" },
  { value: "rose", bg: "bg-red-100 text-red-700" },
  { value: "cyan", bg: "bg-blue-100 text-blue-700" },
  { value: "violet", bg: "bg-violet-100 text-violet-700" },
];

export default function SupportCategories() {
  const [categories, setCategories] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", description: "", color: "indigo", status: "active" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [c, t] = await Promise.all([
        netscaleApi.entities.SupportCategory.list("-created_date", 100),
        netscaleApi.entities.SupportTicket.list("-created_date", 500),
      ]);
      setCategories(c); setTickets(t);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const open = (c) => { setEdit(c || null); setForm(c ? { name: c.name, description: c.description || "", color: c.color || "indigo", status: c.status || "active" } : { name: "", description: "", color: "indigo", status: "active" }); setShowForm(true); };

  const save = async () => {
    try {
      if (edit) await netscaleApi.entities.SupportCategory.update(edit.id, form);
      else await netscaleApi.entities.SupportCategory.create(form);
      setShowForm(false); loadData();
      toast({ title: edit ? "Category updated" : "Category created" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const del = async (c) => { if (!window.confirm(`Delete category "${c.name}"?`)) return; try { await netscaleApi.entities.SupportCategory.delete(c.id); loadData(); toast({ title: "Category deleted" }); } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); } };

  const ticketCount = (name) => tickets.filter(t => t.category === name).length;
  const active = categories.filter(c => c.status === "active").length;
  const colorBg = (val) => COLORS.find(c => c.value === val)?.bg || "bg-slate-100 text-slate-700";

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <PageHeader icon={FolderKanban} iconBg="bg-blue-600" title="Support Categories" subtitle="Organize support tickets by category">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        <button onClick={() => open()} className="flex items-center gap-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Category</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <ColorStatCard label="Total Categories" value={categories.length} icon={FolderKanban} bg="bg-blue-500" iconBg="bg-blue-600" />
        <ColorStatCard label="Active" value={active} icon={FolderKanban} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Total Tickets" value={tickets.length} icon={FolderKanban} bg="bg-amber-500" iconBg="bg-amber-600" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(c => (
          <div key={c.id} className="glass-card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${colorBg(c.color)}`}>{c.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.status}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 min-h-[32px]">{c.description || "No description"}</p>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">{ticketCount(c.name)} tickets</span>
              <div className="flex gap-1">
                <button onClick={() => open(c)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(c)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
        {categories.length === 0 && <div className="col-span-full text-center py-12 text-slate-400"><FolderKanban className="w-12 h-12 mx-auto mb-3" /><p className="text-sm">No categories yet</p></div>}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{edit ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div>
              <Label className="text-xs">Color</Label>
              <Select value={form.color} onValueChange={v => setForm({ ...form, color: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{edit ? "Update" : "Create"} Category</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}