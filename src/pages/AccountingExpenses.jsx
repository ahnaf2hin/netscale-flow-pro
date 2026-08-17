import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, TrendingDown, Plus, Trash2, RefreshCw, Search, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function AccountingExpenses() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ category: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], payment_method: "cash", reference: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { const t = await netscaleApi.entities.AccountingTransaction.filter({ type: "expense" }, "-created_date", 500); setTransactions(t); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const save = async () => {
    try { await netscaleApi.entities.AccountingTransaction.create({ ...form, type: "expense", amount: parseFloat(form.amount) }); setShowForm(false); loadData(); toast({ title: "Expense recorded" }); }
    catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const del = async (t) => { if (!window.confirm("Delete this record?")) return; try { await netscaleApi.entities.AccountingTransaction.delete(t.id); loadData(); } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); } };

  const filtered = transactions.filter(t => !search || t.description?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase()));
  const total = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const thisMonth = transactions.filter(t => t.date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, t) => s + (t.amount || 0), 0);
  const byCat = new Map();
  transactions.forEach(t => { byCat.set(t.category || "Other", (byCat.get(t.category || "Other") || 0) + (t.amount || 0)); });
  const topCat = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])[0];
  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;
  const chartData = Array.from(byCat.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 6);

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <PageHeader icon={TrendingDown} iconBg="bg-rose-600" title="Expenses" subtitle="All expense transactions & cost tracking">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        <button onClick={() => { setForm({ category: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], payment_method: "cash", reference: "" }); setShowForm(true); }} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Expense</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Expenses" value={formatBDT(total)} icon={TrendingDown} bg="bg-rose-500" iconBg="bg-rose-600" />
        <ColorStatCard label="This Month" value={formatBDT(thisMonth)} icon={DollarSign} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="Transactions" value={transactions.length} icon={TrendingDown} bg="bg-teal-500" iconBg="bg-teal-600" />
        <ColorStatCard label="Top Category" value={topCat ? topCat[0] : "—"} icon={TrendingDown} bg="bg-violet-500" iconBg="bg-violet-600" />
      </div>

      {chartData.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Expenses by Category</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => formatBDT(v)} />
              <Bar dataKey="amount" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expense records..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><TrendingDown className="w-12 h-12 mb-3" /><p className="text-sm">No expense records</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Description</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Category</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Amount</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs text-slate-500">{t.date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{t.description || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">{t.category || "—"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-rose-600">−{formatBDT(t.amount)}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => del(t)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center ml-auto"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label className="text-xs">Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Salary, Rent, Equipment" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Amount (৳) *</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-700">Record Expense</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}