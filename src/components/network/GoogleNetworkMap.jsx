import React, { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

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

const svgIcon = (color, label, shape) => {
  const body = shape === "square"
    ? `<rect x="2" y="2" width="22" height="22" rx="4" fill="${color}" stroke="#fff" stroke-width="2"/>`
    : `<circle cx="13" cy="13" r="11" fill="${color}" stroke="#fff" stroke-width="2"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">${body}<text x="13" y="17" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="Arial">${label}</text></svg>`;
  return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new window.google.maps.Size(26, 26), anchor: new window.google.maps.Point(13, 13) };
};

const dotIcon = (color, r = 7) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="${r}" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`;
  return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new window.google.maps.Size(16, 16), anchor: new window.google.maps.Point(8, 8) };
};

export default function GoogleNetworkMap({
  apiKey, mapType, center,
  offices, devices, customers, cableRoutes, packages, onus,
  editMode, drawPoints, previewColor, deviceDraft,
  onMapClick, onDeleteRoute, onDeleteDevice, getPackageName, getOnuSignal,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const infoRef = useRef(null);
  const overlaysRef = useRef([]);
  const intervalsRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  // latest props in refs so listeners bound once use current values
  const editModeRef = useRef(editMode); editModeRef.current = editMode;
  const deviceDraftRef = useRef(deviceDraft); deviceDraftRef.current = deviceDraft;
  const onMapClickRef = useRef(onMapClick); onMapClickRef.current = onMapClick;
  const onDeleteRouteRef = useRef(onDeleteRoute); onDeleteRouteRef.current = onDeleteRoute;
  const onDeleteDeviceRef = useRef(onDeleteDevice); onDeleteDeviceRef.current = onDeleteDevice;
  const getPackageNameRef = useRef(getPackageName); getPackageNameRef.current = getPackageName;
  const getOnuSignalRef = useRef(getOnuSignal); getOnuSignalRef.current = getOnuSignal;

  // Load Google Maps script once
  useEffect(() => {
    if (!apiKey) { setError("No Google Maps API key configured"); return; }
    if (window.google?.maps) { setReady(true); return; }
    const cb = "__gmaps_init_cb";
    window[cb] = () => { setReady(true); try { delete window[cb]; } catch (_) {} };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${cb}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => setError("Failed to load Google Maps. Check your API key.");
    document.head.appendChild(s);
  }, [apiKey]);

  // Init map once script is ready
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const g = window.google.maps;
    const map = new g.Map(containerRef.current, {
      center: { lat: center[0], lng: center[1] },
      zoom: 15,
      mapTypeId: mapType,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });
    mapRef.current = map;
    infoRef.current = new g.InfoWindow();
    const clickListener = map.addListener("click", (e) => {
      if (editModeRef.current && !deviceDraftRef.current && onMapClickRef.current) {
        onMapClickRef.current(e.latLng.lat(), e.latLng.lng());
      }
    });
    return () => {
      g.event.removeListener(clickListener);
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      overlaysRef.current.forEach(o => o.setMap?.(null));
      overlaysRef.current = [];
      mapRef.current = null;
    };
  }, [ready, mapType]);

  // Recenter when center changes (e.g. after data load)
  useEffect(() => {
    if (mapRef.current) mapRef.current.setCenter({ lat: center[0], lng: center[1] });
  }, [center]);

  // Draw overlays whenever data / editor state changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const g = window.google.maps;
    const iw = infoRef.current;
    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];
    overlaysRef.current.forEach(o => o.setMap?.(null));
    overlaysRef.current = [];
    const add = (o) => { o.setMap(map); overlaysRef.current.push(o); return o; };
    const openInfo = (content, anchor) => {
      iw.setContent(content);
      if (anchor) iw.open(map, anchor); else iw.open(map);
    };
    const bindDel = (id, fn) => {
      const btn = document.getElementById(id);
      if (btn) btn.onclick = (ev) => { ev.preventDefault(); fn(); };
    };

    // Cable routes
    cableRoutes.forEach((route) => {
      const positions = routePositions(route);
      if (positions.length < 2) return;
      const col = route.color || cableColor(route.cable_type);
      const pl = add(new g.Polyline({
        path: positions.map(p => ({ lat: p[0], lng: p[1] })),
        strokeColor: col, strokeWeight: 3, strokeOpacity: 0.8,
      }));
      if (route.is_live) {
        const flow = { icon: { path: g.SymbolPath.CIRCLE, scale: 3, fillColor: "#ffffff", fillOpacity: 1, strokeOpacity: 0, strokeWeight: 0 }, repeat: "18px", offset: "0px" };
        pl.set("icons", [flow]);
        let off = 0;
        const iv = setInterval(() => {
          off = (off + 2) % 18;
          flow.offset = `${off}px`;
          pl.set("icons", [flow]);
        }, 40);
        intervalsRef.current.push(iv);
      }
      if (editMode) {
        g.event.addListener(pl, "click", (e) => {
          openInfo(`<div style="font-family:Arial;font-size:13px"><b>${route.name}</b><br/><span style="color:#64748b">${route.cable_type}</span>${route.length_meters ? `<br/>${Math.round(route.length_meters)} m` : ""}<br/><a href="#" id="del-route-${route.id}" style="color:#dc2626">Delete</a></div>`);
          g.event.addListenerOnce(iw, "domready", () => bindDel(`del-route-${route.id}`, () => onDeleteRouteRef.current(route.id)));
        });
      }
    });

    // Preview polyline
    if (editMode && drawPoints.length > 0) {
      add(new g.Polyline({
        path: drawPoints.map(p => ({ lat: p[0], lng: p[1] })),
        strokeColor: previewColor, strokeWeight: 4, strokeOpacity: 0.9,
      }));
      drawPoints.forEach((p) => add(new g.Marker({ position: { lat: p[0], lng: p[1] }, icon: dotIcon("#1d4ed8") })));
    }

    // Offices
    offices.filter(o => o.latitude && o.longitude).forEach((o) => {
      const m = add(new g.Marker({
        position: { lat: o.latitude, lng: o.longitude },
        icon: svgIcon(o.type === "head_office" ? "#4f46e5" : "#f59e0b", o.type === "head_office" ? "HQ" : "SUB", "circle"),
      }));
      g.event.addListener(m, "click", () => {
        openInfo(`<div style="font-family:Arial;font-size:13px"><b>${o.name}</b><br/><span style="color:#64748b">${(o.type || "").replace("_", " ")}</span>${o.address ? `<br/>${o.address}` : ""}${o.phone ? `<br/>${o.phone}` : ""}</div>`, m);
      });
    });

    // Devices
    devices.filter(d => d.latitude && d.longitude).forEach((d) => {
      const meta = DEVICE_META[d.type] || DEVICE_META.switch;
      const m = add(new g.Marker({
        position: { lat: d.latitude, lng: d.longitude },
        icon: svgIcon(meta.color, meta.label, "square"),
      }));
      g.event.addListener(m, "click", () => {
        let c = `<div style="font-family:Arial;font-size:13px"><b>${d.name}</b><br/><span style="color:#64748b">${(d.type || "").replace("_", " ")}</span>${d.description ? `<br/>${d.description}` : ""}${d.ports_total > 0 ? `<br/>Ports: ${d.ports_used || 0}/${d.ports_total}` : ""}`;
        if (editMode) c += `<br/><a href="#" id="del-dev-${d.id}" style="color:#dc2626">Delete</a>`;
        c += `</div>`;
        openInfo(c, m);
        g.event.addListenerOnce(iw, "domready", () => bindDel(`del-dev-${d.id}`, () => onDeleteDeviceRef.current(d.id)));
      });
    });

    // Customers
    customers.filter(c => c.latitude && c.longitude).forEach((c) => {
      const m = add(new g.Marker({
        position: { lat: c.latitude, lng: c.longitude },
        icon: dotIcon(statusColor(c.status)),
      }));
      g.event.addListener(m, "click", () => {
        openInfo(`<div style="font-family:Arial;font-size:13px"><b>${c.name}</b><br/><span style="color:#64748b">${c.phone || ""}</span><br/>Package: ${getPackageNameRef.current(c.package_id)}<br/>Status: ${c.status}<br/>Signal: ${getOnuSignalRef.current(c.id)}</div>`, m);
      });
    });
  }, [ready, offices, devices, customers, cableRoutes, editMode, drawPoints, previewColor]);

  if (error) return <div className="flex items-center justify-center h-full text-sm text-red-500 text-center px-6">{error}</div>;
  if (!ready) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}