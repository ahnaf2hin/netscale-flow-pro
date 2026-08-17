import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Settings, RefreshCw, Users, CreditCard, Radio, HardDrive, Store, Ticket, TrendingUp, Server, Wifi, DollarSign } from "lucide-react";

const StatCard = ({ label, value, icon: Icon, bg, iconBg }) => (
  <div className={`${bg} rounded-xl p-4 flex items-center justify-between`}>
    <div>
      <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-white text-2xl font-bold mt-1">{value}</p>
    </div>
    <div className={`${iconBg} w-10 h-10 rounded-lg flex items-center justify-center`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
  </div>
);

export default function Management() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [customers, invoices, routers, olts, onus, pppoe, packages, staff, resellers, tickets, payments] = await Promise.all([
        netscaleApi.entities.Customer.list("-created_date", 500),
        netscaleApi.entities.Invoice.list("-created_date", 500),
        netscaleApi.entities.MikrotikRouter.list("-created_date", 50),
        netscaleApi.entities.OLTDevice.list("-created_date", 50),
        netscaleApi.entities.ONU.list("-created_date", 500),
        netscaleApi.entities.PPPoESession.list("-created_date", 500),
        netscaleApi.entities.Package.list("-created_date", 100),
        netscaleApi.entities.Staff.list("-created_date", 100),
        netscaleApi.entities.Reseller.list("-created_date", 100),
        netscaleApi.entities.SupportTicket.list("-created_date", 500),
        netscaleApi.entities.Payment.list("-created_date", 200),
      ]);

      const collected = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0);
      const outstanding = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.amount || 0), 0);

      setStats({
        customers: customers.length,
        activeCustomers: customers.filter(c => c.status === "active").length,
        invoices: invoices.length,
        collected,
        outstanding,
        overdue: invoices.filter(i => i.status === "overdue").length,
        routers: routers.length,
        onlineRouters: routers.filter(r => r.status === "online").length,
        olts: olts.length,
        onus: onus.length,
        onlineOnus: onus.filter(o => o.status === "online").length,
        pppoe: pppoe.length,
        onlinePppoe: pppoe.filter(s => s.status === "online").length,
        packages: packages.length,
        staff: staff.length,
        activeStaff: staff.filter(s => s.status === "active").length,
        resellers: resellers.length,
        openTickets: tickets.filter(t => t.status === "open" || t.status === "in_progress").length,
        tickets: tickets.length,
        payments: payments.length,
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Management Center</h1>
            <p className="text-xs text-slate-500">System-wide overview & administrative dashboard</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Financial Overview */}
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Financial Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Collected" value={formatBDT(stats.collected)} icon={DollarSign} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Outstanding" value={formatBDT(stats.outstanding)} icon={TrendingUp} bg="bg-orange-400" iconBg="bg-orange-500" />
        <StatCard label="Overdue Bills" value={stats.overdue || 0} icon={CreditCard} bg="bg-rose-500" iconBg="bg-rose-600" />
        <StatCard label="Total Invoices" value={stats.invoices || 0} icon={CreditCard} bg="bg-indigo-500" iconBg="bg-indigo-600" />
      </div>

      {/* Network Overview */}
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Network Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Mikrotik Servers" value={stats.routers || 0} icon={Server} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <StatCard label="Online Servers" value={stats.onlineRouters || 0} icon={Radio} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="OLT Devices" value={stats.olts || 0} icon={HardDrive} bg="bg-teal-500" iconBg="bg-teal-600" />
        <StatCard label="Total ONUs" value={stats.onus || 0} icon={HardDrive} bg="bg-rose-500" iconBg="bg-rose-600" />
        <StatCard label="Online ONUs" value={stats.onlineOnus || 0} icon={HardDrive} bg="bg-cyan-500" iconBg="bg-cyan-600" />
        <StatCard label="PPPoE Sessions" value={stats.pppoe || 0} icon={Wifi} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <StatCard label="Active Sessions" value={stats.onlinePppoe || 0} icon={Wifi} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Packages" value={stats.packages || 0} icon={CreditCard} bg="bg-violet-500" iconBg="bg-violet-600" />
      </div>

      {/* Team & Partners */}
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Team & Partners</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clients" value={stats.customers || 0} icon={Users} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <StatCard label="Active Clients" value={stats.activeCustomers || 0} icon={Users} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Staff Members" value={stats.staff || 0} icon={Users} bg="bg-teal-500" iconBg="bg-teal-600" />
        <StatCard label="Active Staff" value={stats.activeStaff || 0} icon={Users} bg="bg-cyan-500" iconBg="bg-cyan-600" />
        <StatCard label="Resellers" value={stats.resellers || 0} icon={Store} bg="bg-amber-500" iconBg="bg-amber-600" />
        <StatCard label="Open Tickets" value={stats.openTickets || 0} icon={Ticket} bg="bg-rose-500" iconBg="bg-rose-600" />
        <StatCard label="Total Tickets" value={stats.tickets || 0} icon={Ticket} bg="bg-slate-500" iconBg="bg-slate-600" />
        <StatCard label="Payments" value={stats.payments || 0} icon={CreditCard} bg="bg-emerald-500" iconBg="bg-emerald-600" />
      </div>
    </div>
  );
}