import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Calculator, Plus, Trash2, RefreshCw, Search, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function Accounting() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ type: "income", category: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], payment_method: "cash", reference: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const t = await netscaleApi.entities.AccountingTransaction.list("-created_date", 500);
      setTransactions(t);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveTransaction = async () => {
    const data = { ...form, amount: parseFloat(form.amount) };
    try {
      await netscaleApi.entities.AccountingTransaction.create(data);
      setShowForm(false);
      loadData();
      toast({ title: "Transaction recorded" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deleteTransaction = async (t) => {
    if (!window.confirm("Delete this transaction?")) return;
    try { await netscaleApi.entities.AccountingTransaction.delete(t.id); loadData(); toast({ title: "Transaction deleted" }); }
    catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = transactions.filter(t => {
    const matchSearch = !search || t.description?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || t.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;

  // chart data by month
  const byMonth = new Map();
  transactions.forEach(t => {
    if (!t.date) return;
    const key = t.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, { month: key, income: 0, expense: 0 });
    const e = byMonth.get(key);
    if (t.type === "income") e.income += t.amount || 0;
    else e.expense += t.amount || 0;
  });
  const chartData = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center"><Calculator className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Accounting</h1>
            <p className="text-xs text-slate-500">Income, expenses & financial reports</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={() => { setForm({ type: "income", category: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], payment_method: "cash", reference: "" }); setShowForm(true); }} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Transaction</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Income" value={formatBDT(totalIncome)} icon={TrendingUp} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Total Expense" value={formatBDT(totalExpense)} icon={TrendingDown} bg="bg-rose-500" iconBg="bg-rose-600" />
        <ColorStatCard label="Net Profit" value={formatBDT(netProfit)} icon={DollarSign} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Transactions" value={transactions.length} icon={Calculator} bg="bg-teal-500" iconBg="bg-teal-600" />
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Income vs Expense (6 months)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} /><stop offset="95%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => formatBDT(v)} />
              <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#incGrad)" strokeWidth={2} name="Income" />
              <Area type="monotone" dataKey="expense" stroke="#f43f5e" fill="url(#expGrad)" strokeWidth={2} name="Expense" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description, category..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
          <div className="flex gap-2">
            {["all", "income", "expense"].map(tp => (
              <button key={tp} onClick={() => setTypeFilter(tp)} className={`text-xs px-3 py-2 rounded-lg border capitalize ${typeFilter === tp ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}>{tp}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Calculator className="w-12 h-12 mb-3" /><p className="text-sm">No transactions recorded</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Description</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Category</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Method</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Type</th>
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
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell capitalize">{t.payment_method}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${t.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{t.type}</span></td>
                    <td className={`px-4 py-3 text-sm font-semibold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>{t.type === "income" ? "+" : "−"}{formatBDT(t.amount)}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => deleteTransaction(t)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center ml-auto"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...form, type: "income" })} className={`flex-1 text-xs py-2 rounded-lg border ${form.type === "income" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"}`}>Income</button>
              <button onClick={() => setForm({ ...form, type: "expense" })} className={`flex-1 text-xs py-2 rounded-lg border ${form.type === "expense" ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200"}`}>Expense</button>
            </div>
            <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Salary, Equipment" /></div>
              <div><Label className="text-xs">Amount (৳) *</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
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
            </div>
            <div><Label className="text-xs">Reference</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
            <Button onClick={saveTransaction} className="w-full bg-indigo-600 hover:bg-indigo-700">Record Transaction</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}