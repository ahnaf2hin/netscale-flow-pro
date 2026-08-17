import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Ticket, Plus, RefreshCw, Search, Check, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const StatCard = ({ label, value, icon: Icon, bg, iconBg }) => (
  <div className="group bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
    <div>
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-slate-900 text-2xl font-bold mt-1">{value}</p>
    </div>
    <div className={`${iconBg || bg} w-10 h-10 rounded-lg flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-110`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
  </div>
);

export default function Support() {
  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ customer_id: "", customer_name: "", subject: "", description: "", priority: "medium", status: "open", category: "connectivity", assigned_to: "", resolution: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [t, c] = await Promise.all([
        netscaleApi.entities.SupportTicket.list("-created_date", 500),
        netscaleApi.entities.Customer.list("-created_date", 500),
      ]);
      setTickets(t);
      setCustomers(c);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditTicket(null); setForm({ customer_id: "", customer_name: "", subject: "", description: "", priority: "medium", status: "open", category: "connectivity", assigned_to: "", resolution: "" }); setShowForm(true); };
  const openEdit = (t) => { setEditTicket(t); setForm({ customer_id: t.customer_id || "", customer_name: t.customer_name || "", subject: t.subject || "", description: t.description || "", priority: t.priority || "medium", status: t.status || "open", category: t.category || "connectivity", assigned_to: t.assigned_to || "", resolution: t.resolution || "" }); setShowForm(true); };

  const saveTicket = async () => {
    try {
      if (editTicket) { await netscaleApi.entities.SupportTicket.update(editTicket.id, form); }
      else { await netscaleApi.entities.SupportTicket.create(form); }
      setShowForm(false);
      loadData();
      toast({ title: editTicket ? "Ticket updated" : "Ticket created" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = tickets.filter(t => {
    const matchSearch = !search || t.subject?.toLowerCase().includes(search.toLowerCase()) || t.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved").length;
  const urgentCount = tickets.filter(t => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length;

  const priorityColor = (p) => p === "urgent" ? "bg-red-100 text-red-700" : p === "high" ? "bg-amber-100 text-amber-700" : p === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  const statusColor = (s) => s === "open" ? "bg-blue-100 text-blue-700" : s === "in_progress" ? "bg-amber-100 text-amber-700" : s === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500";

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center">
            <Ticket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Support Tickets</h1>
            <p className="text-xs text-slate-500">Customer support requests & issue tracking</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> New Ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open Tickets" value={openCount} icon={Ticket} bg="bg-blue-500" iconBg="bg-blue-600" />
        <StatCard label="In Progress" value={inProgressCount} icon={Clock} bg="bg-amber-500" iconBg="bg-amber-600" />
        <StatCard label="Resolved" value={resolvedCount} icon={Check} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Urgent" value={urgentCount} icon={AlertTriangle} bg="bg-red-500" iconBg="bg-red-600" />
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subject, customer..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Ticket className="w-12 h-12 mb-3" />
            <p className="text-sm">No tickets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">#</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Subject</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Customer</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Category</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Priority</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{t.subject}</p>
                      <p className="text-xs text-slate-400 truncate max-w-xs hidden sm:block">{t.description}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">{t.customer_name || "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded capitalize">{t.category || "—"}</span>
                    </td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${priorityColor(t.priority)}`}>{t.priority}</span></td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusColor(t.status)}`}>{t.status?.replace("_", " ")}</span></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(t)} className="text-xs text-blue-600 hover:underline">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTicket ? "Manage Ticket" : "New Support Ticket"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-xs">Customer</Label>
              <Select value={form.customer_id} onValueChange={v => {
                const cust = customers.find(c => c.id === v);
                setForm({ ...form, customer_id: v, customer_name: cust?.name || "" });
              }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.phone}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Subject *</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connectivity">Connectivity</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="hardware">Hardware</SelectItem>
                    <SelectItem value="speed">Speed</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Assigned To</Label><Input value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Resolution</Label><Textarea value={form.resolution} onChange={e => setForm({ ...form, resolution: e.target.value })} rows={2} /></div>
            <Button onClick={saveTicket} className="w-full bg-blue-600 hover:bg-blue-700">{editTicket ? "Update Ticket" : "Create Ticket"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}