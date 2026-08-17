import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, ClipboardList, Plus, RefreshCw, Search, Clock, Check, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function WorkReport() {
  const [reports, setReports] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ staff_id: "", staff_name: "", title: "", description: "", report_date: new Date().toISOString().split("T")[0], hours: "1", status: "pending", category: "other" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [r, s] = await Promise.all([
        netscaleApi.entities.WorkReport.list("-created_date", 500),
        netscaleApi.entities.Staff.list("-created_date", 200),
      ]);
      setReports(r);
      setStaff(s);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveReport = async () => {
    const data = { ...form, hours: parseFloat(form.hours) };
    try {
      await netscaleApi.entities.WorkReport.create(data);
      setShowForm(false);
      loadData();
      toast({ title: "Work report added" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = reports.filter(r => !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.staff_name?.toLowerCase().includes(search.toLowerCase()));
  const pending = reports.filter(r => r.status === "pending").length;
  const inProgress = reports.filter(r => r.status === "in_progress").length;
  const completed = reports.filter(r => r.status === "completed").length;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center"><ClipboardList className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Work Report</h1>
            <p className="text-xs text-slate-500">Staff work logs & task tracking</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={() => { setForm({ staff_id: "", staff_name: "", title: "", description: "", report_date: new Date().toISOString().split("T")[0], hours: "1", status: "pending", category: "other" }); setShowForm(true); }} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> New Report</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Reports" value={reports.length} icon={ClipboardList} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Pending" value={pending} icon={Clock} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="In Progress" value={inProgress} icon={Briefcase} bg="bg-cyan-500" iconBg="bg-cyan-600" />
        <ColorStatCard label="Completed" value={completed} icon={Check} bg="bg-emerald-500" iconBg="bg-emerald-600" />
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, staff..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(r => (
          <div key={r.id} className="glass-card p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded capitalize">{r.category}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${r.status === "completed" ? "bg-emerald-100 text-emerald-700" : r.status === "in_progress" ? "bg-cyan-100 text-cyan-700" : "bg-amber-100 text-amber-700"}`}>{r.status?.replace("_", " ")}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.description}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">{r.staff_name || "—"}</span>
              <span className="text-[11px] text-slate-400">{r.report_date} · {r.hours || 0}h</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-slate-400"><ClipboardList className="w-12 h-12 mx-auto mb-3" /><p className="text-sm">No work reports</p></div>}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Work Report</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-xs">Staff Member</Label>
              <Select value={form.staff_id} onValueChange={v => { const s = staff.find(x => x.id === v); setForm({ ...form, staff_id: v, staff_name: s?.name || "" }); }}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.report_date} onChange={e => setForm({ ...form, report_date: e.target.value })} /></div>
              <div><Label className="text-xs">Hours</Label><Input type="number" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveReport} className="w-full bg-indigo-600 hover:bg-indigo-700">Add Report</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}