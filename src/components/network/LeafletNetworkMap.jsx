import React from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import MapClickHandler from "@/components/network/MapClickHandler";

const CABLE_COLORS = { fiber: "#3b82f6", utp: "#8b5cf6", coaxial: "#f59e0b", drop_cable: "#94a3b8" };
const DEVICE_META = {
  switch: { color: "#14b8a6", label: "SW" },
  splitter: { color: "#06b6d4", label: "SP" },
  distribution_box: { color: "#f43f5e", label: "FD" },
  joint: { color: "#64748b", label: "JN" },
};

const cableColor = (type) => CABLE_COLORS[type] || "#94a3b8";
const statusColor = (status) => status === "active" ? "#10b981" : status === "suspended" ? "#f59e0b" : "#94a3b8";

const routePositions = (r) => {
  if (r.path && r.path.length > 0) return r.path.map(p => [p.lat, p.lng]);
  if (r.start_lat != null && r.end_lat != null) return [[r.start_lat, r.start_lng], [r.end_lat, r.end_lng]];
  return [];
};

const officeIcon = (type) => L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:${type === "head_office" ? "#4f46e5" : "#f59e0b"};border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"><span style="transform:rotate(45deg);color:#fff;font-size:10px;font-weight:700">${type === "head_office" ? "HQ" : "SUB"}</span></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const deviceIcon = (type) => {
  const m = DEVICE_META[type] || DEVICE_META.switch;
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:${m.color};border:2px solid #fff;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.4)"><span style="color:#fff;font-size:9px;font-weight:700">${m.label}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

export default function LeafletNetworkMap({
  center, offices, devices, customers, cableRoutes, packages, onus,
  editMode, drawPoints, previewColor, deviceDraft,
  onMapClick, onDeleteRoute, onDeleteDevice, getPackageName, getOnuSignal,
}) {
  const officesWithLocation = offices.filter(o => o.latitude && o.longitude);
  const devicesWithLocation = devices.filter(d => d.latitude && d.longitude);
  const customersWithLocation = customers.filter(c => c.latitude && c.longitude);

  return (
    <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='&copy; Esri, Maxar, Earthstar Geographics' />
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" attribution='' />

      <MapClickHandler active={editMode && !deviceDraft} onClick={onMapClick} />

      {cableRoutes.map((route) => {
        const positions = routePositions(route);
        if (positions.length < 2) return null;
        const col = route.color || cableColor(route.cable_type);
        return (
          <Polyline key={route.id} positions={positions} pathOptions={{ color: col, weight: 3, opacity: 0.8, className: route.is_live ? "live-cable" : undefined }}>
            {editMode && (
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{route.name}</p>
                  <p className="text-slate-500 capitalize">{route.cable_type}</p>
                  {route.length_meters && <p>{Math.round(route.length_meters)} m</p>}
                  <button onClick={() => onDeleteRoute(route.id)} className="mt-1 text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </Popup>
            )}
          </Polyline>
        );
      })}

      {editMode && drawPoints.length > 0 && (
        <>
          <Polyline positions={drawPoints} color={previewColor} weight={4} opacity={0.9} dashArray="6,6" />
          {drawPoints.map((p, i) => (
            <CircleMarker key={i} center={p} radius={4} fillColor="#1d4ed8" fillOpacity={1} color="#fff" weight={1} />
          ))}
        </>
      )}

      {officesWithLocation.map((o) => (
        <Marker key={o.id} position={[o.latitude, o.longitude]} icon={officeIcon(o.type)}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{o.name}</p>
              <p className="text-slate-500 capitalize">{o.type?.replace("_", " ")}</p>
              {o.address && <p>{o.address}</p>}
              {o.phone && <p>{o.phone}</p>}
            </div>
          </Popup>
        </Marker>
      ))}

      {devicesWithLocation.map((d) => (
        <Marker key={d.id} position={[d.latitude, d.longitude]} icon={deviceIcon(d.type)}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{d.name}</p>
              <p className="text-slate-500 capitalize">{d.type?.replace("_", " ")}</p>
              {d.description && <p>{d.description}</p>}
              {d.ports_total > 0 && <p>Ports: {d.ports_used || 0}/{d.ports_total}</p>}
              {editMode && <button onClick={() => onDeleteDevice(d.id)} className="mt-1 text-xs text-red-600 hover:underline">Delete</button>}
            </div>
          </Popup>
        </Marker>
      ))}

      {customersWithLocation.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.latitude, c.longitude]}
          radius={8}
          fillColor={statusColor(c.status)}
          fillOpacity={0.9}
          color="#fff"
          weight={2}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{c.name}</p>
              <p className="text-slate-500">{c.phone}</p>
              <p>Package: {getPackageName(c.package_id)}</p>
              <p>Status: <span className="font-medium capitalize">{c.status}</span></p>
              <p>Signal: {getOnuSignal(c.id)}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}