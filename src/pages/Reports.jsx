import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, BarChart3, TrendingUp, TrendingDown, Users, Wallet, DollarSign } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";

const PIE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#06b6d4", "#8b5cf6"];

export default function Reports() {
  const [period, setPeriod] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, t, p] = await Promise.all([
        base44.entities.Customer.list("-created_date", 3000),
        base44.entities.AccountingTransaction.list("-created_date", 3000),
        base44.entities.Payment.list("-created_date", 3000),
      ]);
      setCustomers(c);
      setTransactions(t);
      setPayments(p.filter(pay => pay.status === "completed"));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;

  const getPeriodKey = (dateStr) => {
    if (!dateStr) return "";
    const d = dateStr.slice(0, 10);
    if (period === "daily") return d;
    if (period === "monthly") return d.slice(0, 7);
    return d.slice(0, 4);
  };

  const getPeriodLabel = (key) => {
    if (period === "daily") return key.slice(5);
    if (period === "monthly") {
      const [y, m] = key.split("-");
      return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en", { month: "short" }) + " " + y.slice(2);
    }
    return key;
  };

  // Generate all period keys in range
  const now = new Date();
  const allKeys = [];
  if (period === "daily") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      allKeys.push(d.toISOString().slice(0, 10));
    }
  } else if (period === "monthly") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      allKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  } else {
    for (let i = 4; i >= 0; i--) allKeys.push(String(now.getFullYear() - i));
  }

  const periodMap = new Map();
  const ensure = (key) => {
    if (!periodMap.has(key)) periodMap.set(key, { key, label: getPeriodLabel(key), newCustomers: 0, income: 0, expense: 0, cashCollected: 0, totalCollected: 0 });
    return periodMap.get(key);
  };
  allKeys.forEach(ensure);

  customers.forEach(c => { const k = getPeriodKey(c.created_date); if (k) ensure(k).newCustomers++; });
  transactions.forEach(t => { const k = getPeriodKey(t.date); if (!k) return; const e = ensure(k); if (t.type === "income") e.income += t.amount || 0; else e.expense += t.amount || 0; });
  payments.forEach(p => { const k = getPeriodKey(p.paid_at || p.created_date); if (!k) return; const e = ensure(k); e.totalCollected += p.amount || 0; if (p.gateway === "cash") e.cashCollected += p.amount || 0; });

  const chartData = allKeys.map(k => periodMap.get(k)).filter(Boolean);

  const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
  const totalExpense = chartData.reduce((s, d) => s + d.expense, 0);
  const totalProfit = totalIncome - totalExpense;
  const totalCash = chartData.reduce((s, d) => s + d.cashCollected, 0);
  const totalNewCustomers = chartData.reduce((s, d) => s + d.newCustomers, 0);

  // Staff collections
  const staffMap = new Map();
  payments.forEach(p => { const name = p.collected_by || "Unassigned"; staffMap.set(name, (staffMap.get(name) || 0) + (p.amount || 0)); });
  const staffData = Array.from(staffMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  const totalStaffCollected = staffData.reduce((s, d) => s + d.total, 0);

  // Payment method breakdown
  const methodMap = new Map();
  payments.forEach(p => { const m = p.gateway || "cash"; methodMap.set(m, (methodMap.get(m) || 0) + (p.amount || 0)); });
  const methodData = Array.from(methodMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  const EmptyChart = ({ height = 200 }) => <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>No data for this period</div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <PageHeader icon={BarChart3} iconBg="bg-indigo-600" title="Business Reports" subtitle="Day-wise, monthly & yearly performance across customers, finance, and collections">
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
            {["daily", "monthly", "yearly"].map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`text-xs px-3 py-2 capitalize ${period === p ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{p}</button>
            ))}
          </div>
          <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <ColorStatCard label="New Customers" value={totalNewCustomers} icon={Users} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Total Income" value={formatBDT(totalIncome)} icon={TrendingUp} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Total Expenses" value={formatBDT(totalExpense)} icon={TrendingDown} bg="bg-rose-500" iconBg="bg-rose-600" />
        <ColorStatCard label="Net Profit" value={formatBDT(totalProfit)} icon={Wallet} bg="bg-teal-500" iconBg="bg-teal-600" />
        <ColorStatCard label="Cash Collected" value={formatBDT(totalCash)} icon={DollarSign} bg="bg-amber-500" iconBg="bg-amber-600" />
      </div>

      {/* New Customers + Income vs Expense */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">New Customers</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs><linearGradient id="custG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Area type="monotone" dataKey="newCustomers" stroke="#6366f1" fill="url(#custG)" strokeWidth={2} name="New Customers" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Income vs Expense</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => formatBDT(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Profit + Cash Collections */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Net Profit Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData.map(d => ({ ...d, profit: d.income - d.expense }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs><linearGradient id="profitG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} /><stop offset="95%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => formatBDT(v)} />
              <Area type="monotone" dataKey="profit" stroke="#14b8a6" fill="url(#profitG)" strokeWidth={2} name="Net Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Cash Collections</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs><linearGradient id="cashG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => formatBDT(v)} />
              <Area type="monotone" dataKey="cashCollected" stroke="#f59e0b" fill="url(#cashG)" strokeWidth={2} name="Cash Collected" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Staff Collections + Payment Method Breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Staff Collections</h2>
          {staffData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-3 py-2">Staff</th>
                  <th className="text-right text-[10px] font-semibold text-slate-400 uppercase px-3 py-2">Collected</th>
                  <th className="text-right text-[10px] font-semibold text-slate-400 uppercase px-3 py-2">Share</th>
                </tr></thead>
                <tbody>
                  {staffData.map(s => (
                    <tr key={s.name} className="border-b border-slate-50">
                      <td className="px-3 py-2.5 text-sm font-medium text-slate-700">{s.name}</td>
                      <td className="px-3 py-2.5 text-sm font-semibold text-slate-900 text-right">{formatBDT(s.total)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 text-right">{totalStaffCollected > 0 ? ((s.total / totalStaffCollected) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Payment Method Breakdown</h2>
          {methodData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name }) => name} labelLine={false} style={{ fontSize: 10 }}>
                  {methodData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => formatBDT(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}