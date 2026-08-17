import React, { useEffect, useState } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Headset, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const STATUS_STYLE = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-zinc-100 text-zinc-600",
};

export default function TicketsSection() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "" });
  const { toast } = useToast();

  const load = async () => {
    try {
      const res = await netscaleApi.functions.invoke("getPortalTickets", {});
      setTickets(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.subject.trim()) return;
    setSubmitting(true);
    try {
      await netscaleApi.functions.invoke("createPortalTicket", form);
      setShowForm(false);
      setForm({ subject: "", description: "" });
      toast({ title: "Ticket submitted" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Headset className="w-4 h-4 text-blue-600" /> Support Tickets</h3>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5 mr-1" /> New Ticket</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No support tickets yet. Have an issue? Create one above.</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{t.subject}</p>
                <p className="text-xs text-slate-400">{new Date(t.created_date).toLocaleDateString()}</p>
              </div>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[t.status] || STATUS_STYLE.open}`}>{t.status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Internet keeps disconnecting" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Describe the issue you're facing..."
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={submitting || !form.subject.trim()}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Ticket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
