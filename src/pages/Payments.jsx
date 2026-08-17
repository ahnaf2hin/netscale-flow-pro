import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, CreditCard, RefreshCw, Search, Check, X, Clock } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("all");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const p = await netscaleApi.entities.Payment.list("-created_date", 500);
      setPayments(p);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filtered = payments.filter(p => {
    const matchSearch = !search || p.transaction_id?.toLowerCase().includes(search.toLowerCase()) || p.customer_id?.includes(search);
    const matchGateway = gatewayFilter === "all" || p.gateway === gatewayFilter;
    return matchSearch && matchGateway;
  });

  const totalCompleted = payments.filter(p => p.status === "completed").reduce((s, p) => s + (p.amount || 0), 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + (p.amount || 0), 0);
  const failedCount = payments.filter(p => p.status === "failed").length;

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;
  const gateways = ["all", "sslcommerz", "bkash", "nagad", "cash", "bank_transfer"];

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <PageHeader icon={CreditCard} iconBg="bg-emerald-600" title="Payments" subtitle="All payment transactions across gateways">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Collected" value={formatBDT(totalCompleted)} icon={Check} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Pending" value={formatBDT(totalPending)} icon={Clock} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="Failed" value={failedCount} icon={X} bg="bg-rose-500" iconBg="bg-rose-600" />
        <ColorStatCard label="Total Txns" value={payments.length} icon={CreditCard} bg="bg-indigo-500" iconBg="bg-indigo-600" />
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transaction ID, customer..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {gateways.map(g => (
              <button key={g} onClick={() => setGatewayFilter(g)} className={`text-xs px-3 py-2 rounded-lg border capitalize ${gatewayFilter === g ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}>{g === "all" ? "All" : g}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><CreditCard className="w-12 h-12 mb-3" /><p className="text-sm">No payments found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Gateway</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Amount</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Transaction ID</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 uppercase">{p.gateway}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{formatBDT(p.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono hidden sm:table-cell">{p.transaction_id || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${p.status === "completed" ? "bg-emerald-100 text-emerald-700" : p.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}