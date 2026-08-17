import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Users, Wallet, Percent, Ticket as TicketIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ColorStatCard from "@/components/dashboard/ColorStatCard";

export default function ResellerDashboard() {
  const [data, setData] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await netscaleApi.functions.invoke("getResellerData", {});
      setData(res.data);
      const t = await netscaleApi.entities.SupportTicket.list("-created_date", 200).catch(() => []);
      setTickets(t);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;
  if (error) return <div className="glass-card p-6 text-center text-slate-500">{error}</div>;

  const { reseller, customers, invoices } = data;
  const activeCustomers = customers.filter((c) => c.status === "active").length;
  const outstanding = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Welcome, {reseller.name}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Here's how your attributed customers are doing</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ColorStatCard label="My Customers" value={customers.length} icon={Users} bg="bg-blue-500" iconBg="bg-blue-600" />
        <ColorStatCard label="Active" value={activeCustomers} icon={Users} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Balance" value={`৳${(reseller.balance || 0).toLocaleString()}`} icon={Wallet} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="Commission Rate" value={`${reseller.commission_rate || 0}%`} icon={Percent} bg="bg-zinc-500" iconBg="bg-zinc-600" />
      </div>

      <Tabs defaultValue="customers">
        <TabsList className="glass">
          <TabsTrigger value="customers">My Customers</TabsTrigger>
          <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <div className="glass-card overflow-hidden">
            {customers.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-12">No customers attributed to you yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 border-b border-slate-200">
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Name</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Phone</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Connected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} className="border-b border-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{c.phone}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{c.connection_date || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">Outstanding across your customers: ৳{outstanding.toLocaleString()}</p>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <div className="glass-card overflow-hidden">
            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <TicketIcon className="w-10 h-10 mb-2" />
                <p className="text-sm">No support tickets from your customers</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 border-b border-slate-200">
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Customer</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Subject</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id} className="border-b border-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">{t.customer_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{t.subject}</td>
                        <td className="px-4 py-3 text-xs">{t.status}</td>
                        <td className="px-4 py-3 text-xs">{t.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
