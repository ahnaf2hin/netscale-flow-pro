import React, { useState, useEffect, useRef } from "react";
import { Pause, Play } from "lucide-react";

const MAX_POINTS = 120;
const WINDOW_SECONDS = 5;
const KBPS_PER_MBPS = 1000;

function fmtAxis(kbps) {
  if (kbps >= KBPS_PER_MBPS) {
    const m = kbps / KBPS_PER_MBPS;
    if (m >= 100) return m.toFixed(0) + 'M';
    if (m >= 10) return m.toFixed(1) + 'M';
    return m.toFixed(2) + 'M';
  }
  if (kbps >= 100) return Math.round(kbps) + 'k';
  if (kbps >= 10) return kbps.toFixed(0) + 'k';
  return kbps.toFixed(1) + 'k';
}

function fmtSpeed(kbps) {
  if (kbps >= KBPS_PER_MBPS) return (kbps / KBPS_PER_MBPS).toFixed(2) + ' Mbps';
  return Math.round(kbps) + ' kbps';
}

export default function InterfaceSpeedChart({ txKbps, rxKbps, lastSynced }) {
  const canvasRef = useRef(null);
  const dataRef = useRef([]);
  const smoothMaxRef = useRef(0);
  const smoothMinRef = useRef(0);
  const displayTxRef = useRef(0);
  const displayRxRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const frozenTimeRef = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) frozenTimeRef.current = Date.now();
  }, [paused]);

  useEffect(() => {
    if (pausedRef.current) return;
    if (!lastSynced && txKbps == null && rxKbps == null) return;
    const now = Date.now();
    // Avoid duplicate points if last point has identical values and timestamp
    const last = dataRef.current[dataRef.current.length - 1];
    if (last && now - last.t < 300) return;
    dataRef.current = [...dataRef.current, { t: now, tx: txKbps || 0, rx: rxKbps || 0 }].slice(-MAX_POINTS);
  }, [lastSynced, txKbps, rxKbps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let W, H, dpr, ctx;
    let raf;

    const setupCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    };

    setupCanvas();
    const ro = new ResizeObserver(setupCanvas);
    ro.observe(canvas);

    const tracePath = (pts) => {
      if (pts.length < 2) return;
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
    };

    const draw = () => {
      const now = pausedRef.current ? frozenTimeRef.current : Date.now();
      const windowMs = WINDOW_SECONDS * 1000;
      const pts = dataRef.current;

      // Smooth interpolation toward the latest data point — the dot glides
      // fluidly toward each new value instead of jumping instantaneously.
      if (pts.length > 0 && !pausedRef.current) {
        const latest = pts[pts.length - 1];
        displayTxRef.current += (latest.tx - displayTxRef.current) * 0.08;
        displayRxRef.current += (latest.rx - displayRxRef.current) * 0.08;
      }

      const padLeft = 38;
      const padBottom = 16;
      const chartH = H - padBottom;
      const chartW = W - padLeft;
      const center = padLeft + chartW / 2;   // fixed center — live point always here
      const halfW = chartW / 2;

      // Dynamic auto-range Y: scale from dataMin to dataMax so even small
      // fluctuations fill the chart height and are always visible.
      const allVals = pts.length > 0 ? pts.flatMap(p => [p.tx, p.rx]) : [0];
      const dataMax = Math.max(...allVals);
      const dataMin = Math.min(...allVals);
      const targetMax = Math.max(dataMax, 1);
      const targetMin = Math.min(dataMin, 0);
      // Smooth max (rises fast, falls slow) and min (falls fast, rises slow)
      let sMax = smoothMaxRef.current || 0;
      sMax = targetMax > sMax ? targetMax : sMax * 0.92 + targetMax * 0.08;
      smoothMaxRef.current = sMax;
      let sMin = smoothMinRef.current || 0;
      sMin = targetMin < sMin ? targetMin : sMin * 0.92 + targetMin * 0.08;
      smoothMinRef.current = sMin;

      // Pad 15% above and below the data range; if flat, add a small spread
      const range = sMax - sMin;
      const pad = range > 0 ? range * 0.15 : Math.max(sMax * 0.1, 1);
      const yMin = sMin - pad;
      const yMaxVal = sMax + pad;
      const yScale = (v) => chartH - ((v - yMin) / (yMaxVal - yMin)) * chartH;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // Faint horizontal grid lines
      ctx.strokeStyle = '#f3f4f6';
      ctx.lineWidth = 1;
      for (let j = 0; j <= 4; j++) {
        const y = (j / 4) * chartH;
        ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Vertical center dashed line — marks the live point
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(center, 0); ctx.lineTo(center, chartH); ctx.stroke();
      ctx.setLineDash([]);

      // Y-axis labels — exact values spanning data min (bottom) to max (top)
      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px ui-sans-serif, system-ui';
      ctx.textAlign = 'right';
      for (let j = 0; j <= 4; j++) {
        const val = yMaxVal - (j / 4) * (yMaxVal - yMin);
        ctx.fillText(fmtAxis(val), padLeft - 5, (j / 4) * chartH + 3);
      }
      ctx.textAlign = 'start';

      // Map points: newest at center, history trails LEFT
      const mapped = pts.map(p => ({
        x: center - ((now - p.t) / windowMs) * halfW,
        txY: yScale(p.tx),
        rxY: yScale(p.rx),
      }));

      if (mapped.length >= 1) {
        const lastPt = mapped[mapped.length - 1];
        const firstPt = mapped[0];
        const clampedLast = { x: center, txY: yScale(displayTxRef.current), rxY: yScale(displayRxRef.current) };

        // Always extend the line to the left edge so a scrolling trail is
        // visible even when the only data point is still near the center.
        const leftEdge = { x: padLeft, txY: firstPt.txY, rxY: firstPt.rxY };
        const needLeftEdge = firstPt.x > padLeft;
        const txPts = [...(needLeftEdge ? [leftEdge] : []), ...mapped, clampedLast].map(p => ({ x: p.x, y: p.txY }));
        const rxPts = [...(needLeftEdge ? [leftEdge] : []), ...mapped, clampedLast].map(p => ({ x: p.x, y: p.rxY }));

        // --- Download bold line ---
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        tracePath(txPts);
        ctx.stroke();

        // --- Upload bold line ---
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        tracePath(rxPts);
        ctx.stroke();

        // --- Live dots at center (the "main point") — using smoothed values
        const dotTxY = yScale(displayTxRef.current);
        const dotRxY = yScale(displayRxRef.current);

        // DL dot — indigo ring + white core
        ctx.fillStyle = '#4f46e5';
        ctx.beginPath(); ctx.arc(center, dotTxY, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(center, dotTxY, 2, 0, Math.PI * 2); ctx.fill();

        // UL dot — emerald ring + white core
        ctx.fillStyle = '#10b981';
        ctx.beginPath(); ctx.arc(center, dotRxY, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(center, dotRxY, 2, 0, Math.PI * 2); ctx.fill();

        // Current speed labels at the live dots — exact values
        ctx.font = 'bold 8px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        // DL label (offset right of dot, clamped inside canvas)
        const dlLabelX = Math.min(center + 8, W - 48);
        ctx.fillStyle = '#4f46e5';
        ctx.fillText(fmtSpeed(displayTxRef.current), dlLabelX, dotTxY + 3);
        // UL label (offset right of dot)
        const ulLabelX = Math.min(center + 8, W - 48);
        ctx.fillStyle = '#10b981';
        ctx.fillText(fmtSpeed(displayRxRef.current), ulLabelX, dotRxY + 3);
        ctx.textAlign = 'start';
      }

      // X-axis time labels (spread across left half: padLeft → center)
      ctx.fillStyle = '#9ca3af';
      ctx.font = '8px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 3; i++) {
        const xRatio = i / 3;
        const x = padLeft + xRatio * halfW;
        const t = now - (1 - xRatio) * windowMs;
        const label = new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        ctx.fillText(label, x, H - 4);
      }
      ctx.textAlign = 'start';

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-100 bg-white" style={{ height: 120 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <button
        onClick={() => setPaused(p => !p)}
        className="absolute top-1 right-1 z-10 flex items-center justify-center w-6 h-6 rounded-md bg-white/80 hover:bg-white border border-slate-200 shadow-sm transition-colors"
        title={paused ? "Resume" : "Pause"}
      >
        {paused ? <Play className="w-3 h-3 text-slate-600" /> : <Pause className="w-3 h-3 text-slate-600" />}
      </button>
    </div>
  );
}