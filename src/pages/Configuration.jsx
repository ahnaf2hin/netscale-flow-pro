import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Settings, Package, Radio, HardDrive, Map, KeyRound, Store, RefreshCw, CreditCard, MessageSquare, Building2, MapPin, Layers } from "lucide-react";
import { Link } from "react-router-dom";

export default function Configuration() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [pkg, routers, olts, resellers, zoneList] = await Promise.all([
        netscaleApi.entities.Package.list("-created_date", 100),
        netscaleApi.entities.MikrotikRouter.list("-created_date", 50),
        netscaleApi.entities.OLTDevice.list("-created_date", 50),
        netscaleApi.entities.Reseller.list("-created_date", 100),
        netscaleApi.entities.Zone.list("-created_date", 100),
      ]);
      setCounts({ packages: pkg.length, routers: routers.length, olts: olts.length, resellers: resellers.length, zones: zoneList.length });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  const modules = [
    { label: "Service Packages", desc: "Manage internet plans & pricing", path: "/packages", icon: Package, bg: "bg-violet-500" },
    { label: "Mikrotik Servers", desc: "Router connection settings", path: "/mikrotik", icon: Radio, bg: "bg-blue-500" },
    { label: "OLT Devices", desc: "Optical line terminals", path: "/olt", icon: HardDrive, bg: "bg-emerald-500" },
    { label: "Offices", desc: "Head office & sub offices on map", path: "/offices", icon: Building2, bg: "bg-blue-500" },
    { label: "Zones", desc: "Service areas for customer assignment", path: "/zones", icon: Layers, bg: "bg-violet-500" },
    { label: "Map Settings", desc: "Google Maps API key & provider", path: "/map-settings", icon: MapPin, bg: "bg-blue-600" },
    { label: "Network Map", desc: "Cable routes & coverage areas", path: "/network-map", icon: Map, bg: "bg-blue-500" },
    { label: "Reseller Settings", desc: "MAC reseller management", path: "/resellers", icon: Store, bg: "bg-amber-500" },
    { label: "Collector API Key", desc: "Collector agent authentication", path: "/collector", icon: KeyRound, bg: "bg-red-500" },
    { label: "Payment Gateways", desc: "Configure online payment credentials", path: "/payment-gateways", icon: CreditCard, bg: "bg-emerald-500" },
    { label: "SMS Providers", desc: "Configure bulk SMS gateway credentials", path: "/sms-providers", icon: MessageSquare, bg: "bg-sky-500" },
  ];

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Configuration</h1>
            <p className="text-xs text-slate-500">System settings & module configuration</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map(m => {
          const Icon = m.icon;
          return (
            <Link key={m.path} to={m.path} className="glass-card p-5 hover:shadow-md transition-shadow group">
              <div className={`w-11 h-11 rounded-xl ${m.bg} flex items-center justify-center mb-3`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{m.label}</h3>
              <p className="text-xs text-slate-500 mt-1">{m.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}