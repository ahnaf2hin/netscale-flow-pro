import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, CreditCard, Plus, Search, Package, CheckCircle, X, RefreshCw, AlertTriangle, Users, Send, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [remindingId, setRemindingId] = useState(null);
  const [genResult, setGenResult] = useState(null);
  const { toast } = useToast();

  const [pkgForm, setPkgForm] = useState({ name: "", speed_mbps: "", monthly_price: "", validity_days: "30", description: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [inv, pkg, pay] = await Promise.all([
        netscaleApi.entities.Invoice.list("-created_date", 500),
        netscaleApi.entities.Package.list("-created_date", 100),
        netscaleApi.entities.Payment.list("-created_date", 200),
      ]);
      setInvoices(inv);
      setPackages(pkg);
      setPayments(pay);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreatePkg = () => { setEditPkg(null); setPkgForm({ name: "", speed_mbps: "", monthly_price: "", validity_days: "30", description: "" }); setShowPkgForm(true); };
  const openEditPkg = (p) => { setEditPkg(p); setPkgForm({ name: p.name, speed_mbps: String(p.speed_mbps), monthly_price: String(p.monthly_price), validity_days: String(p.validity_days || 30), description: p.description || "" }); setShowPkgForm(true); };

  const savePkg = async () => {
    const data = { ...pkgForm, speed_mbps: parseFloat(pkgForm.speed_mbps), monthly_price: parseFloat(pkgForm.monthly_price), validity_days: parseInt(pkgForm.validity_days) };
    try {
      if (editPkg) { await netscaleApi.entities.Package.update(editPkg.id, data); }
      else { await netscaleApi.entities.Package.create(data); }
      setShowPkgForm(false);
      loadData();
      toast({ title: editPkg ? "Package updated" : "Package created" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filteredInvoices = invoices.filter(i => {
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    const matchSearch = !search || i.customer_name?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;

  const toggleSelect = (id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleSelectAll = () => {
    const allSelected = filteredInvoices.length > 0 && filteredInvoices.every(i => selectedIds.has(i.id));
    if (allSelected) setSelectedIds(prev => { const next = new Set(prev); filteredInvoices.forEach(i => next.delete(i.id)); return next; });
    else setSelectedIds(prev => { const next = new Set(prev); filteredInvoices.forEach(i => next.add(i.id)); return next; });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkMarkPaid = async () => {
    const toMark = filteredInvoices.filter(i => selectedIds.has(i.id) && i.status !== "paid");
    if (!toMark.length) { toast({ title: "Already paid", variant: "destructive" }); return; }
    setBulkLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await netscaleApi.entities.Invoice.bulkUpdate(toMark.map(i => ({ id: i.id, status: "paid", paid_date: today, payment_method: "cash" })));
      await netscaleApi.entities.Payment.bulkCreate(toMark.map(i => ({ invoice_id: i.id, customer_id: i.customer_id, amount: i.amount, gateway: "cash", transaction_id: "CASH-" + Date.now() + "-" + i.id.slice(-4), status: "completed", paid_at: new Date().toISOString() })));
      toast({ title: `${toMark.length} invoice(s) marked paid` });
      clearSelection();
      loadData();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setBulkLoading(false); }
  };

  const allFilteredSelected = filteredInvoices.length > 0 && filteredInvoices.every(i => selectedIds.has(i.id));
  const markableCount = filteredInvoices.filter(i => selectedIds.has(i.id) && i.status !== "paid").length;

  // Runs the same daily billing-cycle job that fires automatically every morning — safe to
  // click any time (e.g. to catch up if the server was down, or just to confirm it's working).
  // Each customer only gets an invoice once their own billing day arrives this month, and
  // only if they don't already have one for this month.
  const handleGenerateMonthly = async () => {
    if (!window.confirm("Run the billing cycle now? This generates invoices for any customer whose billing day has arrived this month and hasn't been billed yet, and texts/emails them a payment link.")) return;
    setGenLoading(true);
    setGenResult(null);
    try {
      const res = await netscaleApi.functions.invoke('runBillingCycle', {});
      const data = res.data;
      setGenResult(data);
      toast({
        title: "Billing cycle complete",
        description: `${data.generated} invoice(s) generated and notified · ${data.skipped} skipped (not due yet / already billed)`,
      });
      loadData();
    } catch (err) {
      toast({ title: "Billing cycle failed", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setGenLoading(false);
    }
  };

  const handleSendReminder = async (invoice) => {
    setRemindingId(invoice.id);
    try {
      await netscaleApi.functions.invoke('sendInvoiceReminder', { invoice_id: invoice.id });
      toast({ title: `Reminder sent to ${invoice.customer_name}` });
    } catch (err) {
      toast({ title: "Couldn't send reminder", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setRemindingId(null);
    }
  };

  const totalCollected = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0);
  const totalOutstanding = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.amount || 0), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;
  const unpaidCount = invoices.filter(i => i.status === "unpaid").length;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Billing Management</h1>
            <p className="text-xs text-slate-500">Manage bills, track payments, and monitor outstanding amounts</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {genResult && (
            <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              {genResult.generated} invoice(s) generated · {genResult.skipped} skipped{genResult.errors ? ` · ${genResult.errors} error(s)` : ""}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              onClick={handleGenerateMonthly}
              disabled={genLoading}
              title="Runs automatically every day at 8am — click to run it right now instead of waiting"
              className="flex items-center gap-2 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg px-3 py-2 shadow-sm"
            >
              {genLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {genLoading ? "Running…" : "Run Billing Cycle Now"}
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clients" value={invoices.length} icon={Users} bg="bg-blue-500" iconBg="bg-blue-600" />
        <StatCard label="Collected" value={formatBDT(totalCollected)} icon={CheckCircle} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Outstanding" value={formatBDT(totalOutstanding)} icon={AlertTriangle} bg="bg-amber-400" iconBg="bg-amber-500" />
        <StatCard label="Overdue Bills" value={overdueCount} icon={X} bg="bg-red-500" iconBg="bg-red-600" />
      </div>

      <Tabs defaultValue="invoices">
        <TabsList className="bg-white border border-slate-200 shadow-sm">
          <TabsTrigger value="invoices">Billing List</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        {/* INVOICES */}
        <TabsContent value="invoices" className="mt-4">
          <div className="glass-card p-4 mb-4">
            <p className="text-xs font-semibold text-slate-600 uppercase mb-3">Filter Bills</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input placeholder="Bill ID, Name, Client ID, Mobile..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm h-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            {filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <CreditCard className="w-12 h-12 mb-3" />
                <p className="text-sm">No invoices found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="w-10 px-4 py-3">
                        <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
                      </th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Client</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Month</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Amount</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Due Date</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${selectedIds.has(inv.id) ? "bg-blue-50/40" : ""}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{inv.customer_name || "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{inv.billing_month || "—"}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700">{formatBDT(inv.amount)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{inv.due_date}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700" : inv.status === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{inv.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {inv.status !== "paid" && (
                            <button
                              onClick={() => handleSendReminder(inv)}
                              disabled={remindingId === inv.id}
                              title="Send SMS + email reminder with payment link"
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            >
                              {remindingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                              Remind
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 lg:left-[calc(50%+30px)]">
              <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700">
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <div className="h-4 w-px bg-slate-700" />
                <Button size="sm" disabled={markableCount === 0 || bulkLoading} onClick={handleBulkMarkPaid} className="bg-emerald-600 hover:bg-emerald-700">
                  {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
                  Mark Paid {markableCount > 0 && `(${markableCount})`}
                </Button>
                <button onClick={clearSelection} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* PACKAGES */}
        <TabsContent value="packages" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={openCreatePkg} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> Add Package</Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((p) => (
              <div key={p.id} className="glass-card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Package className="w-5 h-5 text-blue-600" /></div>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openEditPkg(p)}>Edit</Button>
                </div>
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatBDT(p.monthly_price)}<span className="text-sm font-normal text-slate-400">/mo</span></p>
                <p className="text-sm text-slate-500 mt-1">{p.speed_mbps} Mbps · {p.validity_days || 30} days</p>
                {p.description && <p className="text-xs text-slate-400 mt-2">{p.description}</p>}
              </div>
            ))}
            {packages.length === 0 && <div className="col-span-full text-center py-12 text-slate-400"><Package className="w-12 h-12 mx-auto mb-3" /><p className="text-sm">No packages yet</p></div>}
          </div>
        </TabsContent>

        {/* PAYMENTS */}
        <TabsContent value="payments" className="mt-4">
          <div className="glass-card overflow-hidden">
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400"><CreditCard className="w-12 h-12 mb-3" /><p className="text-sm">No payments recorded yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Gateway</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Amount</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Transaction ID</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => (
                      <tr key={pay.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 uppercase">{pay.gateway}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{formatBDT(pay.amount)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono hidden sm:table-cell">{pay.transaction_id || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${pay.status === "completed" ? "bg-emerald-100 text-emerald-700" : pay.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{pay.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Package Form Dialog */}
      <Dialog open={showPkgForm} onOpenChange={setShowPkgForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPkg ? "Edit Package" : "Add Package"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Name *</Label><Input value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Speed (Mbps) *</Label><Input type="number" value={pkgForm.speed_mbps} onChange={e => setPkgForm({ ...pkgForm, speed_mbps: e.target.value })} /></div>
              <div><Label className="text-xs">Monthly Price (BDT) *</Label><Input type="number" value={pkgForm.monthly_price} onChange={e => setPkgForm({ ...pkgForm, monthly_price: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Validity (days)</Label><Input type="number" value={pkgForm.validity_days} onChange={e => setPkgForm({ ...pkgForm, validity_days: e.target.value })} /></div>
            <div><Label className="text-xs">Description</Label><Input value={pkgForm.description} onChange={e => setPkgForm({ ...pkgForm, description: e.target.value })} /></div>
            <Button onClick={savePkg} className="w-full bg-blue-600 hover:bg-blue-700">{editPkg ? "Update" : "Create"} Package</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}