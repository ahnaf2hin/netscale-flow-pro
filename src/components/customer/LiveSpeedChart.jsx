import React, { useState, useEffect, useRef } from "react";
import { Pause } from "lucide-react";
import { base44 } from "@/api/base44Client";

const MAX_POINTS = 180;
const WINDOW_SECONDS = 90;
const KBPS_PER_MBPS = 1024;

// Auto-format: < 1 Mbps → kbps, ≥ 1 Mbps → Mbps (like Winbox)
function fmtSpeed(kbps) {
  if (kbps >= KBPS_PER_MBPS) return (kbps / KBPS_PER_MBPS).toFixed(2) + ' Mbps';
  return Math.round(kbps) + ' kbps';
}

export default function LiveSpeedChart({ pppoeUsername, routerId, speedCapMbps, liveMode }) {
  const [, forceRender] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const canvasRef = useRef(null);
  const dataRef = useRef([]);
  const capRef = useRef((speedCapMbps || 0) * KBPS_PER_MBPS);
  const latestRef = useRef({ dl: 0, ul: 0 });
  const smoothMaxRef = useRef(0); // smoothed Y-axis max for stable scaling

  useEffect(() => { capRef.current = (speedCapMbps || 0) * KBPS_PER_MBPS; }, [speedCapMbps]);

  // --- Real-time speed: subscription + fallback polling ---
  // Primary: subscribe to PPPoESession updates pushed by the collector agent
  // (polls routers every 1s). Fallback: if no data arrives (collector not
  // running), poll syncCustomerSpeed directly every 1s. Deduplication prevents
  // double data points when both sources deliver simultaneously.
  useEffect(() => {
    if (!liveMode || !pppoeUsername) return;
    setWaiting(true);
    let lastPushTime = 0;

    const pushDataPoint = (dl, ul) => {
      const now = Date.now();
      if (now - lastPushTime < 500) return; // deduplicate overlap
      lastPushTime = now;
      latestRef.current = { dl, ul };
      dataRef.current = [...dataRef.current, { t: now, dl, ul }].slice(-MAX_POINTS);
      setWaiting(false);
      forceRender(n => n + 1);
    };

    // Load initial data point immediately
    base44.entities.PPPoESession.filter({ pppoe_username: pppoeUsername }, '-last_synced', 1)
      .then(sessions => {
        if (sessions.length > 0) {
          const s = sessions[0];
          pushDataPoint(s.download_speed_kbps || 0, s.upload_speed_kbps || 0);
        }
      })
      .catch(() => {});

    // Subscribe to real-time updates pushed by the collector
    const unsubscribe = base44.entities.PPPoESession.subscribe((event) => {
      const data = event.data;
      if (!data || data.pppoe_username !== pppoeUsername) return;
      pushDataPoint(data.download_speed_kbps || 0, data.upload_speed_kbps || 0);
    });

    // Fallback: poll directly when collector isn't pushing data
    const pollTimer = setInterval(() => {
      if (!routerId || Date.now() - lastPushTime < 800) return;
      base44.functions.invoke('syncCustomerSpeed', {
        router_id: routerId,
        pppoe_username: pppoeUsername,
      }).then(res => {
        const d = res.data;
        pushDataPoint(d?.download_speed_kbps || 0, d?.upload_speed_kbps || 0);
      }).catch(() => {});
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(pollTimer);
    };
  }, [pppoeUsername, routerId, liveMode]);

  // --- Smooth scroll animation ---
  useEffect(() => {
    if (!liveMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 800, H = 200;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    let raf;

    const draw = () => {
      const now = Date.now();
      const windowMs = WINDOW_SECONDS * 1000;
      const cap = capRef.current || 0;
      const pts = dataRef.current;
      const chartH = H - 18; // leave space for time labels at bottom

      // Auto-scale Y-axis
      const dataMax = pts.length > 0 ? Math.max(...pts.map(p => Math.max(p.dl, p.ul))) : 0;
      const targetMax = Math.max(dataMax, 1);
      const prev = smoothMaxRef.current || 0;
      const smoothMax = targetMax > prev ? targetMax : prev * 0.95 + targetMax * 0.05;
      smoothMaxRef.current = smoothMax;

      const useMbps = smoothMax >= KBPS_PER_MBPS;
      const divisor = useMbps ? KBPS_PER_MBPS : 1;
      const rawTop = (smoothMax * 1.2) / divisor;
      const niceStep = rawTop <= 1 ? 0.2 : rawTop <= 2 ? 0.5 : rawTop <= 5 ? 1 : rawTop <= 10 ? 2 : rawTop <= 20 ? 5 : rawTop <= 50 ? 10 : rawTop <= 100 ? 20 : 50;
      const niceTop = Math.ceil(rawTop / niceStep) * niceStep;
      const yMaxVal = niceTop * divisor;

      const padLeft = 42;
      const yScale = (v) => chartH - (v / yMaxVal) * chartH;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // Light grid
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const x = padLeft + (i / 12) * (W - padLeft);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, chartH); ctx.stroke();
      }
      for (let j = 0; j <= 5; j++) {
        const y = (j / 5) * chartH;
        ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Y-axis labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px ui-sans-serif, system-ui';
      ctx.textAlign = 'right';
      const unitSuffix = useMbps ? ' Mb' : ' kb';
      for (let j = 0; j <= 5; j++) {
        const displayVal = (niceTop * (1 - j / 5)).toFixed(useMbps && niceStep < 1 ? 1 : 0);
        const y = (j / 5) * chartH;
        ctx.fillText(displayVal + unitSuffix, padLeft - 4, y + 3);
      }
      ctx.textAlign = 'start';

      // Cap line
      if (cap > 0 && cap <= yMaxVal) {
        const capY = yScale(cap);
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(0, capY); ctx.lineTo(W, capY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#f59e0b';
        ctx.font = '9px ui-sans-serif, system-ui';
        ctx.fillText('Cap', W - 22, capY - 3);
      }

      // Map points: oldest on left, newest on right
      const mapped = pts
        .map(p => ({ x: W - ((now - p.t) / windowMs) * (W - padLeft), dlY: yScale(p.dl), ulY: yScale(p.ul) }))
        .filter(p => p.x >= padLeft - 10);

      if (mapped.length > 1) {
        const newest = mapped[mapped.length - 1];

        // DL line — purple with circular data points
        ctx.strokeStyle = '#6A1B9A';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(mapped[0].x, mapped[0].dlY);
        for (let i = 1; i < mapped.length; i++) ctx.lineTo(mapped[i].x, mapped[i].dlY);
        ctx.lineTo(W, newest.dlY);
        ctx.stroke();
        ctx.fillStyle = '#6A1B9A';
        for (const p of mapped) {
          ctx.beginPath();
          ctx.arc(p.x, p.dlY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // UL line — faint grey with circular data points
        ctx.strokeStyle = '#D1D1D1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mapped[0].x, mapped[0].ulY);
        for (let i = 1; i < mapped.length; i++) ctx.lineTo(mapped[i].x, mapped[i].ulY);
        ctx.lineTo(W, newest.ulY);
        ctx.stroke();
        ctx.fillStyle = '#D1D1D1';
        for (const p of mapped) {
          ctx.beginPath();
          ctx.arc(p.x, p.ulY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // X-axis time labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 6; i++) {
        const xRatio = i / 6;
        const x = padLeft + xRatio * (W - padLeft);
        const t = now - (1 - xRatio) * windowMs;
        const label = new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        ctx.fillText(label, x, H - 3);
      }
      ctx.textAlign = 'start';

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [liveMode]);

  if (!liveMode) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center h-[180px] text-slate-400 gap-1">
        <Pause className="w-6 h-6 text-slate-300" />
        <p className="text-xs">Paused — press Live to start monitoring</p>
      </div>
    );
  }
  if (!routerId) {
    return <div className="flex items-center justify-center h-[180px] text-xs text-slate-400">No router linked to this session</div>;
  }

  const { dl, ul } = latestRef.current;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-800" />
            <span className="text-slate-500">DL</span>
            <span className="font-bold text-purple-800">{fmtSpeed(dl)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span className="text-slate-500">UL</span>
            <span className="font-bold text-slate-400">{fmtSpeed(ul)}</span>
          </span>
        </div>
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          {waiting ? (
            <span className="w-3 h-3 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
          live
        </span>
      </div>
      <div className="rounded-lg overflow-hidden border border-slate-100" style={{ height: 180 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  );
}