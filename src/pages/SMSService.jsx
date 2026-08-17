import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, MessageSquare, Send, RefreshCw, Search, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function SMSService() {
  const [messages, setMessages] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ recipient: "", recipient_name: "", message: "", type: "single", status: "queued" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [m, c] = await Promise.all([
        netscaleApi.entities.SMSMessage.list("-created_date", 500),
        netscaleApi.entities.Customer.list("-created_date", 500),
      ]);
      setMessages(m);
      setCustomers(c);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const sendSMS = async () => {
    try {
      await netscaleApi.entities.SMSMessage.create({ ...form, sent_at: new Date().toISOString() });
      setShowForm(false);
      loadData();
      toast({ title: "SMS queued for sending" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = messages.filter(m => !search || m.recipient?.includes(search) || m.message?.toLowerCase().includes(search.toLowerCase()));
  const sent = messages.filter(m => m.status === "sent" || m.status === "delivered").length;
  const queued = messages.filter(m => m.status === "queued").length;
  const failed = messages.filter(m => m.status === "failed").length;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center"><MessageSquare className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">SMS Service</h1>
            <p className="text-xs text-slate-500">Send & track SMS notifications to clients</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={() => { setForm({ recipient: "", recipient_name: "", message: "", type: "single", status: "queued" }); setBulkMode(false); setShowForm(true); }} className="flex items-center gap-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 shadow-sm"><Send className="w-3.5 h-3.5" /> Send SMS</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Sent" value={messages.length} icon={MessageSquare} bg="bg-blue-500" iconBg="bg-blue-600" />
        <ColorStatCard label="Delivered" value={sent} icon={Check} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Queued" value={queued} icon={Send} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="Failed" value={failed} icon={X} bg="bg-red-500" iconBg="bg-red-600" />
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipient, message..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><MessageSquare className="w-12 h-12 mb-3" /><p className="text-sm">No messages sent yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Recipient</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Message</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Type</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3"><p className="text-sm font-medium text-slate-900">{m.recipient_name || m.recipient}</p><p className="text-[10px] text-slate-400">{m.recipient}</p></td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">{m.message}</td>
                    <td className="px-4 py-3 hidden sm:table-cell"><span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded capitalize">{m.type}</span></td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${m.status === "delivered" || m.status === "sent" ? "bg-emerald-100 text-emerald-700" : m.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{m.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Send SMS</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex gap-2">
              <button onClick={() => { setBulkMode(false); setForm({ ...form, type: "single" }); }} className={`flex-1 text-xs py-2 rounded-lg border ${!bulkMode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>Single</button>
              <button onClick={() => { setBulkMode(true); setForm({ ...form, type: "bulk", recipient: "All Active Customers" }); }} className={`flex-1 text-xs py-2 rounded-lg border ${bulkMode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>Bulk to All Active</button>
            </div>
            {!bulkMode && (
              <div>
                <Label className="text-xs">Select Customer</Label>
                <Select value={form.recipient} onValueChange={v => { const c = customers.find(x => x.id === v); setForm({ ...form, recipient: c?.phone || v, recipient_name: c?.name || "" }); }}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.phone}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label className="text-xs">Message</Label><Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={4} maxLength={160} placeholder="Max 160 characters" /></div>
            <p className="text-[10px] text-slate-400 text-right">{form.message.length}/160</p>
            <Button onClick={sendSMS} className="w-full bg-blue-600 hover:bg-blue-700"><Send className="w-4 h-4 mr-2" /> Send SMS</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}