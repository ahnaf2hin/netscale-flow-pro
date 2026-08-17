import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, UserX, RefreshCw, Power, Search, Phone } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

export default function SuspendedClients() {
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reactivating, setReactivating] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [c, p] = await Promise.all([
        netscaleApi.entities.Customer.filter({ status: "suspended" }, "-created_date", 500),
        netscaleApi.entities.Package.list("-created_date", 100),
      ]);
      setCustomers(c);
      setPackages(p);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const reactivate = async (c) => {
    setReactivating(c.id);
    try {
      if (c.pppoe_username) {
        const sessions = await netscaleApi.entities.PPPoESession.filter({ pppoe_username: c.pppoe_username }, "-last_synced", 1);
        const router_id = sessions[0]?.router_id;
        if (router_id) {
          await netscaleApi.entities.CommandQueue.create({ customer_id: c.id, command_type: "reconnect", router_id, pppoe_username: c.pppoe_username, status: "pending" });
        } else {
          toast({ title: "Note", description: "No known router for this PPPoE user — reconnect command not queued. It will still show as active here.", variant: "destructive" });
        }
      }
      await netscaleApi.entities.Customer.update(c.id, { status: "active" });
      toast({ title: `${c.name} reactivated` });
      loadData();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setReactivating(null); }
  };

  const pkgName = (id) => packages.find(p => p.id === id)?.name || "—";

  const filtered = customers.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <PageHeader icon={UserX} iconBg="bg-red-600" title="Suspended Clients" subtitle="Clients with suspended service — reactivate with one click">
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <ColorStatCard label="Suspended" value={customers.length} icon={UserX} bg="bg-red-500" iconBg="bg-red-600" />
        <ColorStatCard label="With Package" value={customers.filter(c => c.package_id).length} icon={UserX} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="No Package" value={customers.filter(c => !c.package_id).length} icon={UserX} bg="bg-slate-500" iconBg="bg-slate-600" />
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><UserX className="w-12 h-12 mb-3" /><p className="text-sm">No suspended clients</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Phone</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Package</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden lg:table-cell">Address</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{c.name}</p>
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">SUSPENDED</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><div className="flex items-center gap-1.5 text-xs text-slate-600"><Phone className="w-3 h-3" />{c.phone}</div></td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">{pkgName(c.package_id)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell max-w-xs truncate">{c.address || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => reactivate(c)} disabled={reactivating === c.id} className="inline-flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg px-3 py-1.5">
                        {reactivating === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                        Reactivate
                      </button>
                    </td>
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