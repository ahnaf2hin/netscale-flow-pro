import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { Users, UserCheck, UserX, CreditCard, AlertTriangle, TrendingUp, RefreshCw, Loader2, Wifi } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import RouterInfoPanel from "@/components/dashboard/RouterInfoPanel";
import InterfaceMonitorPanel from "@/components/dashboard/InterfaceMonitorPanel";

const StatCard = ({ label, value, icon: Icon, bg, iconBg, href }) => {
  const inner = (
    <div className={`${bg} rounded-xl p-4 flex items-center justify-between relative overflow-hidden group transition-all duration-200 ${href ? "cursor-pointer hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]" : ""}`}>
      {/* Glassmorphism sheen */}
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl" />
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5 blur-xl" />
      <div className="relative">
        <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className="text-white text-2xl font-bold mt-1">{value}</p>
        {href && <p className="text-white/50 text-[10px] mt-1 group-hover:text-white/80 transition-colors">View all →</p>}
      </div>
      <div className={`${iconBg} w-10 h-10 rounded-lg flex items-center justify-center relative backdrop-blur-sm border border-white/20 shadow-inner`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [bandwidthData, setBandwidthData] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [customers, invoices, pppoe, bwLogs] = await Promise.all([
        netscaleApi.entities.Customer.list("-created_date", 500),
        netscaleApi.entities.Invoice.list("-created_date", 500),
        netscaleApi.entities.PPPoESession.filter({ status: "online" }, "-last_synced", 500),
        netscaleApi.entities.BandwidthLog.list("-log_date", 30),
      ]);

      const activeCustomers = customers.filter(c => c.status === "active").length;
      const suspendedCustomers = customers.filter(c => c.status === "suspended").length;
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const monthlyInvoices = invoices.filter(i => i.billing_month === thisMonth);
      const paidThisMonth = monthlyInvoices.filter(i => i.status === "paid");
      const overdueInvoices = invoices.filter(i => i.status === "overdue");
      const unpaidInvoices = invoices.filter(i => i.status === "unpaid");
      const monthlyRevenue = paidThisMonth.reduce((sum, i) => sum + (i.amount || 0), 0);

      setStats({
        totalCustomers: customers.length,
        activeCustomers,
        suspendedCustomers,
        inactiveCustomers: customers.filter(c => c.status === "inactive").length,
        monthlyRevenue,
        overdueCount: overdueInvoices.length,
        overdueAmount: overdueInvoices.reduce((sum, i) => sum + (i.amount || 0), 0),
        activeSessions: pppoe.length,
        unpaidCount: unpaidInvoices.length,
        collected: paidThisMonth.reduce((sum, i) => sum + (i.amount || 0), 0),
        outstanding: invoices.filter(i => i.status !== "paid").reduce((sum, i) => sum + (i.amount || 0), 0),
      });

      const byDate = new Map();
      for (const log of bwLogs) {
        if (!log.log_date) continue;
        if (!byDate.has(log.log_date)) byDate.set(log.log_date, { date: log.log_date, download: 0, upload: 0 });
        const e = byDate.get(log.log_date);
        e.download += (log.total_download_kbps || 0) / 1024;
        e.upload += (log.total_upload_kbps || 0) / 1024;
      }
      setBandwidthData(Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)));
      setRecentInvoices(invoices.slice(0, 6));
      setRecentCustomers(customers.slice(0, 5));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const formatBDT = (amount) => `৳${(amount || 0).toLocaleString("en-BD")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard Overview</h1>
            <p className="text-xs text-slate-500">Welcome back, Administrator!</p>
          </div>
        </div>
        <button onClick={loadStats} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* Primary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total Clients" value={stats?.totalCustomers || 0} icon={Users} bg="bg-indigo-500" iconBg="bg-indigo-600" href="/customers" />
        <StatCard label="Active Clients" value={stats?.activeCustomers || 0} icon={UserCheck} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Inactive" value={stats?.inactiveCustomers || 0} icon={UserX} bg="bg-slate-500" iconBg="bg-slate-600" />
        <StatCard label="Suspended" value={stats?.suspendedCustomers || 0} icon={UserX} bg="bg-rose-500" iconBg="bg-rose-600" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Active PPPoE" value={stats?.activeSessions || 0} icon={Wifi} bg="bg-cyan-500" iconBg="bg-cyan-600" />
        <StatCard label="Total Collected" value={formatBDT(stats?.collected)} icon={CreditCard} bg="bg-teal-500" iconBg="bg-teal-600" />
        <StatCard label="Outstanding" value={formatBDT(stats?.outstanding)} icon={AlertTriangle} bg="bg-orange-400" iconBg="bg-orange-500" />
        <StatCard label="Overdue Bills" value={stats?.overdueCount || 0} icon={AlertTriangle} bg="bg-red-500" iconBg="bg-red-600" />
      </div>

      {/* Mikrotik Router Info */}
      <RouterInfoPanel />

      {/* Interface Speed Monitor */}
      <InterfaceMonitorPanel />

      {/* Charts + Tables row */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Bandwidth */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Client Growth (Last 30 Days)</h2>
            <div className="flex gap-3 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500" />Download</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Upload</span>
            </div>
          </div>
          {bandwidthData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No bandwidth data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={bandwidthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${v.toFixed(0)}M`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => `${v.toFixed(1)} Mbps`} />
                <Area type="monotone" dataKey="download" stroke="#6366f1" fill="url(#dlGrad)" strokeWidth={2} name="Download" />
                <Area type="monotone" dataKey="upload" stroke="#10b981" fill="url(#ulGrad)" strokeWidth={2} name="Upload" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Customers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> New Client Signups</h2>
            <Link to="/customers" className="text-xs text-indigo-600 hover:underline">View All</Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-2">Name</th>
                <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-2 hidden sm:table-cell">Phone</th>
                <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-2">Status</th>
                <th className="text-right text-[10px] font-semibold text-slate-400 uppercase px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentCustomers.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{c.phone}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : c.status === "suspended" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link to={`/customers/${c.id}`} className="text-xs text-indigo-600 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
              {recentCustomers.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-sm text-slate-400">No customers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><CreditCard className="w-4 h-4 text-teal-500" /> Recent Invoices</h2>
          <Link to="/billing" className="text-xs text-indigo-600 hover:underline">View All</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-2">Client</th>
                <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-2 hidden sm:table-cell">Month</th>
                <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-2">Amount</th>
                <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-2">Due Date</th>
                <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map(inv => (
                <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{inv.customer_name || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{inv.billing_month || "—"}</td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">{formatBDT(inv.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{inv.due_date || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700" : inv.status === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{inv.status}</span>
                  </td>
                </tr>
              ))}
              {recentInvoices.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-slate-400">No invoices yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}