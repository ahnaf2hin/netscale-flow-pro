import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, BarChart3, RefreshCw, TrendingUp, TrendingDown, DollarSign, Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";

const PIE_COLORS = ["#10b981", "#f43f5e", "#6366f1", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899"];

export default function AccountingReports() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setTransactions(await netscaleApi.entities.AccountingTransaction.list("-created_date", 1000)); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;
  const income = transactions.filter(t => t.type === "income");
  const expenses = transactions.filter(t => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = expenses.reduce((s, t) => s + (t.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

  const byMonth = new Map();
  transactions.forEach(t => {
    if (!t.date) return;
    const k = t.date.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, { month: k, income: 0, expense: 0 });
    const e = byMonth.get(k);
    if (t.type === "income") e.income += t.amount || 0;
    else e.expense += t.amount || 0;
  });
  const monthlyData = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

  const expByCat = new Map();
  expenses.forEach(t => expByCat.set(t.category || "Other", (expByCat.get(t.category || "Other") || 0) + (t.amount || 0)));
  const pieData = Array.from(expByCat.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <PageHeader icon={BarChart3} iconBg="bg-indigo-600" title="Financial Reports" subtitle="Profit & loss overview, trends and breakdowns">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Income" value={formatBDT(totalIncome)} icon={TrendingUp} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Total Expenses" value={formatBDT(totalExpense)} icon={TrendingDown} bg="bg-rose-500" iconBg="bg-rose-600" />
        <ColorStatCard label="Net Profit" value={formatBDT(netProfit)} icon={Wallet} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Profit Margin" value={`${profitMargin}%`} icon={DollarSign} bg="bg-teal-500" iconBg="bg-teal-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Income vs Expense (6 months)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => formatBDT(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Expense Breakdown</h2>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-slate-400 text-sm">No expense data</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name} labelLine={false} style={{ fontSize: 10 }}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => formatBDT(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Monthly Profit Trend</h2>
        {monthlyData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData.map(d => ({ ...d, profit: d.income - d.expense }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs><linearGradient id="profitG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => formatBDT(v)} />
              <Area type="monotone" dataKey="profit" stroke="#6366f1" fill="url(#profitG)" strokeWidth={2} name="Net Profit" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}