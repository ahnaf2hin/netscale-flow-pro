import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Map as MapIcon, Pencil, Check, Cable, Network, GitBranch, Boxes, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import LeafletNetworkMap from "@/components/network/LeafletNetworkMap";
import GoogleNetworkMap from "@/components/network/GoogleNetworkMap";

const CABLE_TYPES = [
  { value: "fiber", label: "Fiber", color: "#3b82f6" },
  { value: "utp", label: "UTP", color: "#8b5cf6" },
  { value: "coaxial", label: "Coaxial", color: "#f59e0b" },
  { value: "drop_cable", label: "Drop Cable", color: "#94a3b8" },
];

const DEVICE_TYPES = [
  { value: "switch", label: "Switch", color: "#14b8a6", icon: Network },
  { value: "splitter", label: "Splitter", color: "#06b6d4", icon: GitBranch },
  { value: "distribution_box", label: "Dist. Box", color: "#f43f5e", icon: Boxes },
  { value: "joint", label: "Joint", color: "#64748b", icon: Cable },
];

const cableColor = (type) => CABLE_TYPES.find(c => c.value === type)?.color || "#94a3b8";

const haversine = (a, b) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const pathLength = (pts) => pts.reduce((acc, p, i) => (i ? acc + haversine(pts[i - 1], p) : 0), 0);

export default function NetworkMap() {
  const [customers, setCustomers] = useState([]);
  const [cableRoutes, setCableRoutes] = useState([]);
  const [packages, setPackages] = useState([]);
  const [onus, setOnus] = useState([]);
  const [offices, setOffices] = useState([]);
  const [devices, setDevices] = useState([]);
  const [mapSetting, setMapSetting] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState(null);
  const [drawPoints, setDrawPoints] = useState([]);
  const [cableForm, setCableForm] = useState({ name: "", cable_type: "fiber", notes: "", color: "#3b82f6", is_live: false });
  const [deviceDraft, setDeviceDraft] = useState(null);
  const [deviceForm, setDeviceForm] = useState({ name: "", description: "", ports_total: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [custs, routes, pkgs, onuList, officeList, devList, settingsList] = await Promise.all([
        netscaleApi.entities.Customer.list("-created_date", 500),
        netscaleApi.entities.CableRoute.list("-created_date", 200),
        netscaleApi.entities.Package.list("-created_date", 100),
        netscaleApi.entities.ONU.list("-last_synced", 500),
        netscaleApi.entities.Office.list("-created_date", 100),
        netscaleApi.entities.NetworkDevice.list("-created_date", 200),
        netscaleApi.entities.MapSetting.list("-created_date", 10),
      ]);
      setCustomers(custs);
      setCableRoutes(routes);
      setPackages(pkgs);
      setOnus(onuList);
      setOffices(officeList);
      setDevices(devList);
      setMapSetting(settingsList[0] || null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getPackageName = (pkgId) => packages.find(p => p.id === pkgId)?.name || "—";
  const getOnuSignal = (custId) => {
    const o = onus.find(x => x.customer_id === custId);
    return o ? `${o.rx_power_dbm} dBm` : "—";
  };

  const customersWithLocation = customers.filter(c => c.latitude && c.longitude);
  const headOffice = offices.find(o => o.type === "head_office" && o.latitude && o.longitude);
  const officesWithLocation = offices.filter(o => o.latitude && o.longitude);
  const devicesWithLocation = devices.filter(d => d.latitude && d.longitude);

  const center = headOffice
    ? [headOffice.latitude, headOffice.longitude]
    : customersWithLocation.length > 0
      ? [customersWithLocation[0].latitude, customersWithLocation[0].longitude]
      : [23.8103, 90.4125];

  const useGoogle = mapSetting?.provider === "google" && mapSetting?.google_maps_api_key;
  const googleMapType = mapSetting?.google_map_type || "roadmap";
  const previewColor = cableForm.color || cableColor(cableForm.cable_type);

  const enterEdit = () => { setEditMode(true); setTool("cable"); };
  const exitEdit = () => { setEditMode(false); setTool(null); setDrawPoints([]); setDeviceDraft(null); };

  const handleMapClick = (lat, lng) => {
    if (tool === "cable") {
      setDrawPoints(prev => [...prev, [lat, lng]]);
    } else if (tool) {
      setDeviceDraft({ lat, lng, type: tool });
      setDeviceForm({ name: "", description: "", ports_total: "", notes: "" });
    }
  };

  const saveCable = async () => {
    if (drawPoints.length < 2) { toast({ variant: "destructive", title: "Add at least 2 points" }); return; }
    if (!cableForm.name.trim()) { toast({ variant: "destructive", title: "Route name is required" }); return; }
    setSaving(true);
    try {
      await netscaleApi.entities.CableRoute.create({
        name: cableForm.name,
        cable_type: cableForm.cable_type,
        color: cableForm.color,
        is_live: cableForm.is_live,
        path: drawPoints.map(([lat, lng]) => ({ lat, lng })),
        length_meters: Math.round(pathLength(drawPoints)),
        notes: cableForm.notes,
      });
      toast({ title: "Cable route saved" });
      setDrawPoints([]);
      setCableForm({ name: "", cable_type: cableForm.cable_type, notes: "", color: cableForm.color, is_live: cableForm.is_live });
      loadData();
    } catch (err) { toast({ variant: "destructive", title: "Save failed", description: err.message }); }
    finally { setSaving(false); }
  };

  const saveDevice = async () => {
    if (!deviceForm.name.trim()) { toast({ variant: "destructive", title: "Device name is required" }); return; }
    setSaving(true);
    try {
      await netscaleApi.entities.NetworkDevice.create({
        name: deviceForm.name,
        type: deviceDraft.type,
        latitude: deviceDraft.lat,
        longitude: deviceDraft.lng,
        description: deviceForm.description,
        ports_total: deviceForm.ports_total === "" ? 0 : parseInt(deviceForm.ports_total, 10),
        notes: deviceForm.notes,
      });
      toast({ title: "Device placed" });
      setDeviceDraft(null);
      loadData();
    } catch (err) { toast({ variant: "destructive", title: "Save failed", description: err.message }); }
    finally { setSaving(false); }
  };

  const deleteRoute = async (id) => {
    if (!confirm("Delete this cable route?")) return;
    try { await netscaleApi.entities.CableRoute.delete(id); toast({ title: "Route deleted" }); loadData(); }
    catch (err) { toast({ variant: "destructive", title: "Delete failed", description: err.message }); }
  };

  const deleteDevice = async (id) => {
    if (!confirm("Delete this device?")) return;
    try { await netscaleApi.entities.NetworkDevice.delete(id); toast({ title: "Device deleted" }); loadData(); }
    catch (err) { toast({ variant: "destructive", title: "Delete failed", description: err.message }); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  const hasContent = customersWithLocation.length > 0 || cableRoutes.length > 0 || officesWithLocation.length > 0 || devicesWithLocation.length > 0;
  const rendererProps = {
    center, offices, devices, customers, cableRoutes, packages, onus,
    editMode, drawPoints, previewColor, deviceDraft,
    onMapClick: handleMapClick, onDeleteRoute: deleteRoute, onDeleteDevice: deleteDevice,
    getPackageName, getOnuSignal,
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-heading">Network Map</h1>
          <p className="text-sm text-slate-500 mt-1">{officesWithLocation.length} offices · {devicesWithLocation.length} devices · {customersWithLocation.length} customers · {cableRoutes.length} cable routes</p>
        </div>
        {!editMode ? (
          <Button onClick={enterEdit} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Pencil className="w-4 h-4" /> Edit Map
          </Button>
        ) : (
          <Button onClick={exitEdit} size="sm" variant="outline">
            <Check className="w-4 h-4" /> Done Editing
          </Button>
        )}
      </div>

      {/* Editor toolbar */}
      {editMode && (
        <div className="glass-card p-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 mr-1">Tool:</span>
          <button
            onClick={() => setTool("cable")}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${tool === "cable" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            <Cable className="w-3.5 h-3.5" /> Draw Cable
          </button>
          {DEVICE_TYPES.map(dt => {
            const Icon = dt.icon;
            return (
              <button
                key={dt.value}
                onClick={() => { setTool(dt.value); setDrawPoints([]); }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${tool === dt.value ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                style={tool === dt.value ? { background: dt.color, borderColor: dt.color } : {}}
              >
                <Icon className="w-3.5 h-3.5" /> {dt.label}
              </button>
            );
          })}
          <span className="text-[11px] text-slate-400 ml-auto">
            {tool === "cable" ? "Click the map to add route points" : `Click the map to place a ${DEVICE_TYPES.find(d => d.value === tool)?.label}`}
          </span>
        </div>
      )}

      {/* Cable drawing form */}
      {editMode && tool === "cable" && drawPoints.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-900">{drawPoints.length} point(s) · ~{Math.round(pathLength(drawPoints))} m</span>
            <button onClick={() => setDrawPoints([])} className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1"><X className="w-3 h-3" /> Clear</button>
          </div>
          <div className="grid sm:grid-cols-5 gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Route Name</Label>
              <Input value={cableForm.name} onChange={e => setCableForm({ ...cableForm, name: e.target.value })} placeholder="e.g. Main fiber trunk" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Cable Type</Label>
              <Select value={cableForm.cable_type} onValueChange={v => setCableForm({ ...cableForm, cable_type: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CABLE_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Color</Label>
              <div className="flex items-center gap-2 h-8">
                <input type="color" value={cableForm.color} onChange={e => setCableForm({ ...cableForm, color: e.target.value })} className="w-9 h-8 rounded border border-slate-200 cursor-pointer bg-white p-0.5" />
                <span className="text-xs text-slate-500 font-mono">{cableForm.color}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Live (running)</Label>
              <div className="flex items-center h-8">
                <Switch checked={cableForm.is_live} onCheckedChange={v => setCableForm({ ...cableForm, is_live: v })} />
              </div>
            </div>
            <Button onClick={saveCable} disabled={saving || drawPoints.length < 2} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Route
            </Button>
          </div>
        </div>
      )}

      {/* Device placement form */}
      {editMode && deviceDraft && (
        <div className="bg-white border border-blue-200 rounded-xl p-3 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-900">
              Place {DEVICE_TYPES.find(d => d.value === deviceDraft.type)?.label} at {deviceDraft.lat.toFixed(5)}, {deviceDraft.lng.toFixed(5)}
            </span>
            <button onClick={() => setDeviceDraft(null)} className="text-slate-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-4 gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Name</Label>
              <Input value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="e.g. Switch 01" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Description</Label>
              <Input value={deviceForm.description} onChange={e => setDeviceForm({ ...deviceForm, description: e.target.value })} placeholder="Optional" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Ports</Label>
              <Input type="number" value={deviceForm.ports_total} onChange={e => setDeviceForm({ ...deviceForm, ports_total: e.target.value })} placeholder="e.g. 24" className="h-8 text-sm" />
            </div>
            <Button onClick={saveDevice} disabled={saving} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Place
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Active</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Suspended</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Fiber</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" /> UTP</div>
        <div className="flex items-center gap-1.5"><span className="w-6 h-1 rounded-sm inline-block" style={{ background: "repeating-linear-gradient(90deg,#0ea5e9 0 6px,transparent 6px 10px)" }} /> Live cable (animated)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Head Office</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Sub Office</div>
        {DEVICE_TYPES.map(dt => (
          <div key={dt.value} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: dt.color }} /> {dt.label}</div>
        ))}
      </div>

      <div className="glass-card overflow-hidden" style={{ height: "calc(100vh - 240px)", minHeight: "400px" }}>
        {useGoogle ? (
          <GoogleNetworkMap apiKey={mapSetting.google_maps_api_key} mapType={googleMapType} {...rendererProps} />
        ) : !hasContent && !editMode ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MapIcon className="w-16 h-16 mb-4" />
            <p className="text-sm">Add an office, customer locations and cable routes to see your network</p>
          </div>
        ) : (
          <LeafletNetworkMap {...rendererProps} />
        )}
      </div>
    </div>
  );
}