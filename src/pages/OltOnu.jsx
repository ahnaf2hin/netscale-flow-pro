import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, HardDrive, Plus, Signal, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

const OID_PROFILES = [
  { value: "huawei_ma5600", label: "Huawei MA5600T / MA5800 (built-in)" },
  { value: "custom", label: "Custom OIDs (any vendor)" },
];

function OpticalSparkline({ points, dataKey, stroke }) {
  const vals = points.map((p) => p[dataKey]).filter((v) => v !== null && v !== undefined);
  if (vals.length < 2) return <p className="text-xs text-slate-400 py-6 text-center">Not enough history yet</p>;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const w = 100, h = 32;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const v = p[dataKey];
      const y = v === null || v === undefined ? null : h - ((v - min) / range) * h;
      return y === null ? null : `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

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

export default function OltOnu() {
  const [olts, setOlts] = useState([]);
  const [onus, setOnus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOltForm, setShowOltForm] = useState(false);
  const { toast } = useToast();
  const [oltForm, setOltForm] = useState({
    name: "", vendor: "", ip_address: "", snmp_community: "public", snmp_port: "161",
    oid_profile: "huawei_ma5600", custom_status_oid: "", custom_serial_oid: "", custom_rx_power_oid: "", custom_tx_power_oid: "",
    custom_power_divisor: "100", low_signal_threshold_dbm: "-27", location: "", total_pon_ports: "",
  });
  const [historyOnu, setHistoryOnu] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const openHistory = async (onu) => {
    setHistoryOnu(onu);
    setHistoryLoading(true);
    try {
      const rows = await netscaleApi.entities.OnuOpticalLog.filter(
        { olt_id: onu.olt_id, serial_number: onu.serial_number }, "-created_date", 50
      );
      setHistory(rows.reverse());
    } catch (err) { console.error(err); }
    finally { setHistoryLoading(false); }
  };

  const loadData = async () => {
    try {
      const [o, n] = await Promise.all([
        netscaleApi.entities.OLTDevice.list("-created_date", 50),
        netscaleApi.entities.ONU.list("-last_synced", 500),
      ]);
      setOlts(o);
      setOnus(n);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveOlt = async () => {
    try {
      await netscaleApi.entities.OLTDevice.create({
        ...oltForm,
        total_pon_ports: oltForm.total_pon_ports ? parseInt(oltForm.total_pon_ports) : undefined,
        snmp_port: oltForm.snmp_port ? parseInt(oltForm.snmp_port) : 161,
        custom_power_divisor: oltForm.custom_power_divisor ? parseFloat(oltForm.custom_power_divisor) : 100,
        low_signal_threshold_dbm: oltForm.low_signal_threshold_dbm ? parseFloat(oltForm.low_signal_threshold_dbm) : -27,
      });
      setShowOltForm(false);
      loadData();
      toast({ title: "OLT added" });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const signalColor = (rxDbm) => {
    if (rxDbm === null || rxDbm === undefined) return "text-slate-400";
    if (rxDbm >= -20) return "text-emerald-600";
    if (rxDbm >= -25) return "text-amber-600";
    return "text-red-600";
  };

  const onlineOnus = onus.filter(o => o.status === "online");
  const offlineOnus = onus.filter(o => o.status === "offline" || o.status === "los");
  const losOnus = onus.filter(o => o.status === "los");
  const onlineOlts = olts.filter(o => o.status === "online");

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-600 flex items-center justify-center">
            <HardDrive className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">OLT Management</h1>
            <p className="text-xs text-slate-500">Optical Line Terminal monitoring & ONU management — live SNMP data pushed by your collector agent every 60s</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} title="Reload from database — live SNMP polling runs continuously via your collector agent" className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => setShowOltForm(true)} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Add Server
          </button>
        </div>
      </div>

      {losOnus.length > 0 && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{losOnus.length} ONU{losOnus.length > 1 ? "s" : ""} reporting low/no signal (LOS)</p>
            <p className="text-xs text-red-600 mt-0.5">{losOnus.slice(0, 5).map(o => o.customer_name || o.serial_number).join(", ")}{losOnus.length > 5 ? `, +${losOnus.length - 5} more` : ""} — likely a fiber cut, dirty connector, or ONU power loss. Click a row below for signal history.</p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Servers" value={olts.length} icon={HardDrive} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <StatCard label="Online Servers" value={onlineOlts.length} icon={HardDrive} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Total ONUs" value={onus.length} icon={Signal} bg="bg-rose-500" iconBg="bg-rose-600" />
        <StatCard label="Online ONUs" value={onlineOnus.length} icon={Signal} bg="bg-cyan-500" iconBg="bg-cyan-600" />
      </div>

      <Tabs defaultValue="olts">
        <TabsList className="bg-white border border-slate-200 shadow-sm">
          <TabsTrigger value="olts">OLT Servers</TabsTrigger>
          <TabsTrigger value="onus">ONUs List</TabsTrigger>
        </TabsList>

        <TabsContent value="olts" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {olts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <HardDrive className="w-12 h-12 mb-3" /><p className="text-sm">No OLT devices added yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Server</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden sm:table-cell">Host / Port</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden md:table-cell">Protocol</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden lg:table-cell">ONUs</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-4 py-3 hidden lg:table-cell">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {olts.map(o => (
                      <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center"><HardDrive className="w-4 h-4 text-teal-600" /></div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{o.name}</p>
                              <p className="text-[10px] text-slate-400">{o.vendor}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500 hidden sm:table-cell">{o.ip_address}:{o.snmp_port || 161}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">SNMP ({o.oid_profile === "custom" ? "custom" : "Huawei MA5600"})</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${o.status === "online" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${o.status === "online" ? "bg-emerald-500" : "bg-red-500"}`} />
                            {o.status === "online" ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 hidden lg:table-cell">{o.total_pon_ports || "—"} ports</td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{o.location || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="onus" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Signal className="w-4 h-4 text-cyan-500" /> ONUs List
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{onus.length}</span>
              </h2>
              <div className="flex gap-2 text-[11px]">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">● {onlineOnus.length} Online</span>
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">● {offlineOnus.length} Offline</span>
              </div>
            </div>
            {onus.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Signal className="w-12 h-12 mb-3" /><p className="text-sm">No ONUs yet — data will appear when your collector pushes it</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">ONU ID</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Name / Description</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3 hidden sm:table-cell">MAC / Serial</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3 hidden md:table-cell">Rx Power</th>
                      <th className="text-left text-[11px] font-semibold uppercase px-4 py-3 hidden lg:table-cell">PON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onus.map((o, i) => (
                      <tr key={o.id} onClick={() => openHistory(o)} className={`border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500">{i + 1}/{onus.length}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{o.customer_name || "—"}</td>
                        <td className="px-4 py-3 text-xs font-mono text-indigo-600 hidden sm:table-cell">{o.serial_number}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${o.status === "online" ? "bg-emerald-100 text-emerald-700" : o.status === "los" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${o.status === "online" ? "bg-emerald-500" : o.status === "los" ? "bg-red-500" : "bg-slate-400"}`} />
                            {o.status}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold hidden md:table-cell ${signalColor(o.rx_power_dbm)}`}>{o.rx_power_dbm != null ? `${o.rx_power_dbm} dBm` : "N/A"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{o.pon_port || "0/1"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* OLT Form */}
      <Dialog open={showOltForm} onOpenChange={setShowOltForm}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add OLT Device</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Name *</Label><Input value={oltForm.name} onChange={e => setOltForm({ ...oltForm, name: e.target.value })} /></div>
              <div><Label className="text-xs">Vendor</Label><Input value={oltForm.vendor} onChange={e => setOltForm({ ...oltForm, vendor: e.target.value })} placeholder="e.g. Huawei, BDCOM" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">IP Address *</Label><Input value={oltForm.ip_address} onChange={e => setOltForm({ ...oltForm, ip_address: e.target.value })} /></div>
              <div><Label className="text-xs">SNMP Port</Label><Input type="number" value={oltForm.snmp_port} onChange={e => setOltForm({ ...oltForm, snmp_port: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">SNMP Community</Label><Input value={oltForm.snmp_community} onChange={e => setOltForm({ ...oltForm, snmp_community: e.target.value })} /></div>
              <div><Label className="text-xs">Total PON Ports</Label><Input type="number" value={oltForm.total_pon_ports} onChange={e => setOltForm({ ...oltForm, total_pon_ports: e.target.value })} /></div>
            </div>

            <div>
              <Label className="text-xs">SNMP OID Profile</Label>
              <Select value={oltForm.oid_profile} onValueChange={v => setOltForm({ ...oltForm, oid_profile: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OID_PROFILES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400 mt-1">Verify against your exact firmware via `snmpwalk` — switch to Custom OIDs for any other vendor/model.</p>
            </div>

            {oltForm.oid_profile === "custom" && (
              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div><Label className="text-xs">Status OID (ONU run-state, 1=online)</Label><Input className="font-mono text-xs" value={oltForm.custom_status_oid} onChange={e => setOltForm({ ...oltForm, custom_status_oid: e.target.value })} placeholder="1.3.6.1.4.1..." /></div>
                <div><Label className="text-xs">Serial Number OID</Label><Input className="font-mono text-xs" value={oltForm.custom_serial_oid} onChange={e => setOltForm({ ...oltForm, custom_serial_oid: e.target.value })} placeholder="1.3.6.1.4.1..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Rx Power OID</Label><Input className="font-mono text-xs" value={oltForm.custom_rx_power_oid} onChange={e => setOltForm({ ...oltForm, custom_rx_power_oid: e.target.value })} placeholder="1.3.6.1.4.1..." /></div>
                  <div><Label className="text-xs">Tx Power OID</Label><Input className="font-mono text-xs" value={oltForm.custom_tx_power_oid} onChange={e => setOltForm({ ...oltForm, custom_tx_power_oid: e.target.value })} placeholder="1.3.6.1.4.1..." /></div>
                </div>
                <div><Label className="text-xs">Power Divisor (raw SNMP value → dBm)</Label><Input type="number" value={oltForm.custom_power_divisor} onChange={e => setOltForm({ ...oltForm, custom_power_divisor: e.target.value })} /></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Location</Label><Input value={oltForm.location} onChange={e => setOltForm({ ...oltForm, location: e.target.value })} /></div>
              <div><Label className="text-xs">Low-Signal Alert Threshold (dBm)</Label><Input type="number" value={oltForm.low_signal_threshold_dbm} onChange={e => setOltForm({ ...oltForm, low_signal_threshold_dbm: e.target.value })} /></div>
            </div>
            <Button onClick={saveOlt} className="w-full bg-indigo-600 hover:bg-indigo-700">Add OLT</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ONU Signal History */}
      <Dialog open={!!historyOnu} onOpenChange={(open) => !open && setHistoryOnu(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{historyOnu?.customer_name || historyOnu?.serial_number}</DialogTitle></DialogHeader>
          {historyOnu && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-400">Serial</p><p className="font-mono text-slate-800 mt-0.5">{historyOnu.serial_number}</p></div>
                <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-400">Current Rx Power</p><p className={`font-semibold mt-0.5 ${signalColor(historyOnu.rx_power_dbm)}`}>{historyOnu.rx_power_dbm != null ? `${historyOnu.rx_power_dbm} dBm` : "N/A"}</p></div>
              </div>
              {historyLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Rx Power Trend (last {history.length} readings)</p>
                  <OpticalSparkline points={history} dataKey="rx_power_dbm" stroke="#0891b2" />
                  <p className="text-xs font-medium text-slate-500 mb-1 mt-3">Tx Power Trend</p>
                  <OpticalSparkline points={history} dataKey="tx_power_dbm" stroke="#7c3aed" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}