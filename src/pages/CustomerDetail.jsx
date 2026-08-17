import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Wifi, MapPin, Phone, Mail, Calendar, Loader2, Signal, Activity, Clock, Cpu, Play, Pause } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import CustomerActions from "@/components/customer/CustomerActions";
import LiveSpeedChart from "@/components/customer/LiveSpeedChart";
import CustomerFullDetails from "@/components/customer/CustomerFullDetails";
import InvoiceManager from "@/components/customer/InvoiceManager";
import { useToast } from "@/components/ui/use-toast";

export default function CustomerDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [customer, setCustomer] = useState(null);
  const [pkg, setPkg] = useState(null);
  const [packages, setPackages] = useState([]);
  const [zones, setZones] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [session, setSession] = useState(null);
  const [onu, setOnu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [bandwidthLogs, setBandwidthLogs] = useState([]);

  useEffect(() => {
    loadCustomer();
    netscaleApi.entities.Package.list("-created_date", 100).then(setPackages).catch(() => {});
    netscaleApi.entities.Zone.list("-created_date", 200).then(setZones).catch(() => {});
  }, [id]);

  // Real-time session updates via subscription (replaces 10s polling)
  useEffect(() => {
    if (!customer?.pppoe_username) return;
    const unsubscribe = netscaleApi.entities.PPPoESession.subscribe((event) => {
      const data = event.data;
      if (!data || data.pppoe_username !== customer.pppoe_username) return;
      setSession(data);
    });
    return () => unsubscribe();
  }, [customer]);

  // ONU refresh every 30s (ONU data changes less frequently)
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(async () => {
      try {
        const onus = await netscaleApi.entities.ONU.filter({ customer_id: id }, "-last_synced", 1);
        if (onus.length > 0) setOnu(onus[0]);
      } catch (err) { /* silent refresh */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [id, liveMode]);

  // Handle Stripe payment redirect (admin pays invoice online)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const payment = urlParams.get('payment');
    if (sessionId && payment === 'success') {
      netscaleApi.functions.invoke('adminConfirmPayment', { session_id: sessionId })
        .then(() => {
          toast({ title: 'Payment confirmed', description: 'Invoice paid successfully' });
          loadCustomer();
          window.history.replaceState({}, '', `/customers/${id}`);
        })
        .catch(() => {
          toast({ title: 'Payment confirmation failed', variant: 'destructive' });
          window.history.replaceState({}, '', `/customers/${id}`);
        });
    } else if (payment === 'canceled') {
      toast({ title: 'Payment canceled' });
      window.history.replaceState({}, '', `/customers/${id}`);
    }
  }, [id]);

  const loadCustomer = async () => {
    try {
      const cust = await netscaleApi.entities.Customer.get(id);
      setCustomer(cust);

      // Load each piece independently so one failure doesn't hide the rest
      const results = await Promise.allSettled([
        cust.package_id ? netscaleApi.entities.Package.get(cust.package_id) : Promise.resolve(null),
        netscaleApi.entities.Invoice.filter({ customer_id: id }, "-due_date", 50),
        cust.pppoe_username
          ? netscaleApi.entities.PPPoESession.filter({ pppoe_username: cust.pppoe_username }, "-last_synced", 1)
          : Promise.resolve([]),
        netscaleApi.entities.ONU.filter({ customer_id: id }, "-last_synced", 1),
        netscaleApi.entities.CustomerBandwidthLog.filter({ customer_id: id }, "-log_date", 200),
      ]);
      if (results[0].status === 'fulfilled') setPkg(results[0].value);
      if (results[1].status === 'fulfilled') setInvoices(results[1].value);
      setSession(results[2].status === 'fulfilled' && results[2].value?.length > 0 ? results[2].value[0] : null);
      if (results[3].status === 'fulfilled' && results[3].value?.length > 0) setOnu(results[3].value[0]);
      if (results[4].status === 'fulfilled') setBandwidthLogs(results[4].value);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (!customer) {
    return <div className="flex items-center justify-center h-screen text-slate-400">Customer not found</div>;
  }

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;
  const hasLocation = customer.latitude && customer.longitude;

  // Aggregate daily bandwidth logs into monthly totals (last 6 months)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const monthlyUsage = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    const monthLogs = bandwidthLogs.filter(l => (l.log_date || "").startsWith(key));
    const downloadGb = monthLogs.reduce((s, l) => s + (l.download_gb || 0), 0);
    const uploadGb = monthLogs.reduce((s, l) => s + (l.upload_gb || 0), 0);
    monthlyUsage.push({
      key,
      label: `${monthNames[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`,
      downloadGb, uploadGb,
      totalGb: downloadGb + uploadGb,
      daysLogged: monthLogs.length,
    });
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
              <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                customer.status === "active" ? "bg-emerald-50 text-emerald-700" :
                customer.status === "suspended" ? "bg-amber-50 text-amber-700" :
                "bg-slate-100 text-slate-600"
              }`}>{customer.status}</span>
              {customer.customer_code && (
                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{customer.customer_code}</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {customer.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {customer.phone}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {customer.email}
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {customer.address}
                </div>
              )}
              {customer.zone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Zone: {customer.zone}
                </div>
              )}
              {customer.connection_date && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Connected: {customer.connection_date}
                </div>
              )}
              {customer.latitude && customer.longitude && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {customer.latitude.toFixed(4)}, {customer.longitude.toFixed(4)}
                </div>
              )}
            </div>
            {customer.notes && (
              <p className="text-sm text-slate-500 mt-3 pt-3 border-t border-slate-100">{customer.notes}</p>
            )}
          </div>
        </div>
        <CustomerActions customer={customer} packages={packages} zones={zones} onUpdated={loadCustomer} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Connection Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Connection</h2>
          <div className="space-y-0">
            <div className="flex justify-between items-center text-sm py-2.5 border-b border-slate-100">
              <span className="text-slate-500">Package</span>
              <span className="font-medium text-slate-900">{pkg?.name || "—"}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2.5 border-b border-slate-100">
              <span className="text-slate-500">Speed</span>
              <span className="font-medium text-slate-900">{pkg?.speed_mbps ? `${pkg.speed_mbps} Mbps` : "—"}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2.5 border-b border-slate-100">
              <span className="text-slate-500">Monthly Price</span>
              <span className="font-medium text-slate-900">{pkg ? formatBDT(pkg.monthly_price) : "—"}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2.5">
              <span className="text-slate-500">PPPoE Username</span>
              <span className="font-mono text-xs text-slate-900">{customer.pppoe_username || "—"}</span>
            </div>
          </div>
        </div>

        {/* Real-time Speed Usage */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> Real-time Speed
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLiveMode(true)}
                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${liveMode ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                <Play className="w-3 h-3" /> Live
              </button>
              <button
                onClick={() => setLiveMode(false)}
                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${!liveMode ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                <Pause className="w-3 h-3" /> Pause
              </button>
            </div>
          </div>
          {session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Session Status</span>
                <span className={`flex items-center gap-1.5 font-bold text-xs uppercase ${session.status === "online" ? "text-emerald-600" : "text-red-500"}`}>
                  <span className={`w-2 h-2 rounded-full ${session.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                  {session.status}
                </span>
              </div>
              <LiveSpeedChart pppoeUsername={customer.pppoe_username} routerId={session?.router_id} speedCapMbps={pkg?.speed_mbps || 0} liveMode={liveMode} />
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">IP Address</div>
                  <div className="font-mono text-xs text-slate-700">{session.ip_address || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Uptime</div>
                  <div className="text-xs text-slate-700 flex items-center gap-1"><Clock className="w-3 h-3" /> {session.uptime || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Router</div>
                  <div className="text-xs text-slate-700">{session.router_name || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Last Synced</div>
                  <div className="text-xs text-slate-700">{session.last_synced ? new Date(session.last_synced).toLocaleTimeString() : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Data Down</div>
                  <div className="text-xs text-blue-600 font-medium">{session.download_bytes ? (session.download_bytes / 1024 / 1024 / 1024).toFixed(2) + " GB" : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Data Up</div>
                  <div className="text-xs text-emerald-600 font-medium">{session.upload_bytes ? (session.upload_bytes / 1024 / 1024 / 1024).toFixed(2) + " GB" : "—"}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Wifi className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No active session</p>
              <p className="text-xs mt-1">Waiting for collector agent...</p>
            </div>
          )}
        </div>

        {/* ONU Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-500" /> ONU Info
          </h2>
          {onu ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Serial Number</div>
                  <div className="font-mono text-xs text-slate-900">{onu.serial_number}</div>
                </div>
                <span className={`flex items-center gap-1.5 font-bold text-xs uppercase px-2 py-1 rounded-full ${onu.status === "online" ? "bg-emerald-50 text-emerald-600" : onu.status === "los" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${onu.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                  {onu.status || "offline"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">OLT Device</div>
                  <div className="text-xs text-slate-700">{onu.olt_name || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">PON Port</div>
                  <div className="text-xs text-slate-700 font-mono">{onu.pon_port || "—"}</div>
                </div>
              </div>
              {/* RX Power gauge */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-slate-500"><Signal className="w-3 h-3" /> RX Power</span>
                  <span className={`font-bold ${onu.rx_power_dbm < -25 ? "text-red-600" : onu.rx_power_dbm < -20 ? "text-amber-600" : "text-emerald-600"}`}>{onu.rx_power_dbm != null ? `${onu.rx_power_dbm} dBm` : "—"}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${onu.rx_power_dbm < -25 ? "bg-red-500" : onu.rx_power_dbm < -20 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(5, Math.min(100, ((onu.rx_power_dbm || -30) + 30) / 30 * 100))}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>-30 dBm</span><span>-8 dBm</span>
                </div>
              </div>
              {/* TX Power gauge */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-slate-500"><Signal className="w-3 h-3 rotate-180" /> TX Power</span>
                  <span className="font-bold text-slate-700">{onu.tx_power_dbm != null ? `${onu.tx_power_dbm} dBm` : "—"}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.max(5, Math.min(100, ((onu.tx_power_dbm || 0) + 10) / 20 * 100))}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <Clock className="w-3 h-3" />
                Last synced: {onu.last_synced ? new Date(onu.last_synced).toLocaleString() : "—"}
              </div>
              {onu.status === "los" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                  ⚠ Loss of Signal detected — check fiber connection
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Cpu className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No ONU registered</p>
              <p className="text-xs mt-1">Assign an ONU from the OLT/ONU page</p>
            </div>
          )}
        </div>

        {/* Map */}
        {hasLocation && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" /> Location
            </h2>
            <div className="rounded-lg overflow-hidden h-48">
              <MapContainer center={[customer.latitude, customer.longitude]} zoom={16} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[customer.latitude, customer.longitude]}>
                  <Popup>{customer.name}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        )}
      </div>

      {/* Full Customer Details */}
      <CustomerFullDetails customer={customer} pkg={pkg} />

      {/* Monthly Bandwidth Usage */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" /> Monthly Bandwidth Usage (Last 6 Months)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Month</th>
                <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Download</th>
                <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Upload</th>
                <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Total</th>
                <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Avg DL Speed</th>
                <th className="text-center text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Days Logged</th>
              </tr>
            </thead>
            <tbody>
              {monthlyUsage.map((m) => (
                <tr key={m.key} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 text-sm font-medium text-slate-700">{m.label}</td>
                  <td className="px-3 py-2.5 text-sm text-blue-600 font-medium text-right">{m.downloadGb > 0 ? `${m.downloadGb.toFixed(2)} GB` : "—"}</td>
                  <td className="px-3 py-2.5 text-sm text-emerald-600 font-medium text-right">{m.uploadGb > 0 ? `${m.uploadGb.toFixed(2)} GB` : "—"}</td>
                  <td className="px-3 py-2.5 text-sm font-bold text-slate-900 text-right">{m.totalGb > 0 ? `${m.totalGb.toFixed(2)} GB` : "—"}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-500 text-right">
                    {m.daysLogged > 0
                      ? `${(bandwidthLogs.filter(l => (l.log_date || "").startsWith(m.key)).reduce((s, l) => s + (l.avg_download_kbps || 0), 0) / Math.max(1, m.daysLogged) / 1024).toFixed(1)} Mbps`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-400 text-center">{m.daysLogged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bandwidthLogs.length === 0 && (
          <p className="text-xs text-slate-400 text-center mt-3">Usage data appears as the daily snapshot runs — accumulates over time</p>
        )}
      </div>

      <InvoiceManager customer={customer} invoices={invoices} onUpdated={loadCustomer} />
    </div>
  );
}