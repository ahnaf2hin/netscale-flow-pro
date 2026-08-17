// ============================================================
//  Mikrotik SNMP Collector Agent
//  Runs on a machine on the SAME network as your Mikrotik router(s).
//  Polls PPPoE session traffic + system resource via SNMP (UDP,
//  no login overhead) and pushes to your ISP app's backend every
//  POLL_INTERVAL seconds.
//
//  RouterOS API is used ONLY for command execution (suspend /
//  reconnect) — SNMP is read-only so commands still need API.
//
//  PREREQUISITE: Enable SNMP on each Mikrotik router:
//    /snmp set enabled=yes
//    /snmp set communities=public
//  Then set snmp_community / snmp_port on each router in the app.
// ============================================================

import snmp from 'net-snmp';
import { RouterOSAPI } from 'node-routeros';

// ---------- CONFIG ----------
// APP_BASE should point at wherever the NetScale Flow Pro Express server (server/) is
// reachable from this collector machine, e.g. http://192.168.1.10:8787 for a LAN box,
// or your public API domain if the server is internet-facing.
const APP_BASE = 'http://localhost:8787';
const COLLECTOR_API_KEY = 'dev-collector-key-change-me'; // must match server/.env's COLLECTOR_API_KEY

const POLL_INTERVAL = 1; // seconds between syncs
const SYSTEM_INFO_EVERY = 30; // query system resource every N ticks
// ----------------------------

const SYNC_URL = `${APP_BASE}/api/collector/sync-mikrotik`;
const ROUTERS_URL = `${APP_BASE}/api/collector/routers`;

// ---------- SNMP OIDs ----------
const OID_ifDescr = '1.3.6.1.2.1.2.2.1.2';
const OID_ifHCInOctets = '1.3.6.1.2.1.31.1.1.1.6';
const OID_ifHCOutOctets = '1.3.6.1.2.1.31.1.1.1.10';
const OID_ifInOctets = '1.3.6.1.2.1.2.2.1.10';
const OID_ifOutOctets = '1.3.6.1.2.1.2.2.1.16';
const OID_sysDescr = '1.3.6.1.2.1.1.1.0';
const OID_hrSystemUptime = '1.3.6.1.2.1.25.1.1.0';
const OID_hrProcessorLoad = '1.3.6.1.2.1.25.3.3.1.5';
const OID_hrMemorySize = '1.3.6.1.2.1.25.2.2.0';
const OID_hrStorageDescr = '1.3.6.1.2.1.25.2.3.1.3';
const OID_hrStorageAllocationUnits = '1.3.6.1.2.1.25.2.3.1.4';
const OID_hrStorageSize = '1.3.6.1.2.1.25.2.3.1.5';
const OID_hrStorageUsed = '1.3.6.1.2.1.25.2.3.1.6';

// ---------- SNMP session pool (UDP — stateless, just reuse socket) ----------
const snmpPool = new Map();

function getSnmpSession(router) {
  if (snmpPool.has(router.id)) return snmpPool.get(router.id);
  const session = snmp.createSession(router.host, router.snmp_community || 'public', {
    port: router.snmp_port || 161,
    timeout: 2000,
    retries: 1,
  });
  snmpPool.set(router.id, session);
  return session;
}

// Walk an OID subtree — returns array of { oid, value }
function walk(session, oid) {
  return new Promise((resolve) => {
    const results = [];
    session.walk(oid, 20, (varbinds) => {
      for (const vb of varbinds) {
        if (!snmp.isVarbindError(vb)) {
          results.push({ oid: vb.oid, value: vb.value });
        }
      }
    }, () => resolve(results));
  });
}

// Get multiple scalar OIDs — returns array of values (null if missing)
function get(session, oids) {
  return new Promise((resolve) => {
    session.get(oids, (error, varbinds) => {
      if (error || !varbinds) { resolve(oids.map(() => null)); return; }
      resolve(varbinds.map(vb => snmp.isVarbindError(vb) ? null : vb.value));
    });
  });
}

// ---------- State: previous byte counters for VLAN kbps, tick counts ----------
const prevStats = new Map(); // router_id -> { ifIndex: { in, out, t } }
const tickCount = new Map(); // router_id -> count

// ---------- Pull PPPoE sessions + VLAN traffic via SNMP ----------
async function pullRouterData(router) {
  const session = getSnmpSession(router);

  // 5 parallel walks: interface names + 64-bit & 32-bit byte counters
  const [ifDescrs, hcIn, hcOut, in32, out32] = await Promise.all([
    walk(session, OID_ifDescr),
    walk(session, OID_ifHCInOctets),
    walk(session, OID_ifHCOutOctets),
    walk(session, OID_ifInOctets),
    walk(session, OID_ifOutOctets),
  ]);

  // Build per-interface maps keyed by ifIndex (last OID component)
  const names = {};
  for (const vb of ifDescrs) { names[vb.oid.split('.').pop()] = vb.value.toString(); }

  const inBytes = {};
  for (const vb of hcIn) { inBytes[vb.oid.split('.').pop()] = Number(vb.value); }
  for (const vb of in32) { const i = vb.oid.split('.').pop(); if (inBytes[i] === undefined) inBytes[i] = Number(vb.value); }

  const outBytes = {};
  for (const vb of hcOut) { outBytes[vb.oid.split('.').pop()] = Number(vb.value); }
  for (const vb of out32) { const i = vb.oid.split('.').pop(); if (outBytes[i] === undefined) outBytes[i] = Number(vb.value); }

  // Extract PPPoE sessions — interface name: <pppoe-USERNAME> or pppoe-USERNAME
  // ifOut (router→client) = download, ifIn (client→router) = upload
  const sessions = [];
  for (const [idx, name] of Object.entries(names)) {
    const m = name.match(/^<?pppoe-(.+)>?$/);
    if (m) {
      sessions.push({
        pppoe_username: m[1],
        download_bytes: outBytes[idx] || 0,
        upload_bytes: inBytes[idx] || 0,
        status: 'online',
      });
    }
  }

  // Compute VLAN / interface kbps from byte deltas (non-PPPoE interfaces)
  const now = Date.now();
  const prev = prevStats.get(router.id) || {};
  const vlans = [];
  for (const [idx, name] of Object.entries(names)) {
    if (name.match(/^<?pppoe-/)) continue;
    const curIn = inBytes[idx] || 0;
    const curOut = outBytes[idx] || 0;
    const p = prev[idx];
    if (p && now - p.t > 0) {
      const dt = (now - p.t) / 1000;
      vlans.push({
        vlan_id: name,
        vlan_name: name,
        tx_kbps: Math.max(0, Math.round((curOut - p.out) / 1024 / dt)),
        rx_kbps: Math.max(0, Math.round((curIn - p.in) / 1024 / dt)),
      });
    } else {
      // First tick — send interface with 0 kbps so it appears in the list
      vlans.push({ vlan_id: name, vlan_name: name, tx_kbps: 0, rx_kbps: 0 });
    }
    prev[idx] = { in: curIn, out: curOut, t: now };
  }
  prevStats.set(router.id, prev);

  // System resource — query every SYSTEM_INFO_EVERY ticks (or first tick)
  let system_info;
  const count = (tickCount.get(router.id) || 0) + 1;
  tickCount.set(router.id, count);
  if (count === 1 || count % SYSTEM_INFO_EVERY === 0) {
    try { system_info = await pullSystemInfo(session); } catch (_) { /* SNMP HOST-RESOURCES not available */ }
  }

  return { sessions, vlans, system_info };
}

// ---------- Pull system resource via SNMP (HOST-RESOURCES-MIB) ----------
async function pullSystemInfo(session) {
  const [sysVals, cpuLoads, storDescr, storUnits, storSize, storUsed] = await Promise.all([
    get(session, [OID_sysDescr, OID_hrSystemUptime, OID_hrMemorySize]),
    walk(session, OID_hrProcessorLoad),
    walk(session, OID_hrStorageDescr),
    walk(session, OID_hrStorageAllocationUnits),
    walk(session, OID_hrStorageSize),
    walk(session, OID_hrStorageUsed),
  ]);

  const desc = sysVals[0] ? sysVals[0].toString() : '';
  const versionMatch = desc.match(/RouterOS\s+(\S+)/);
  const boardMatch = desc.match(/RouterOS\s+\S+\s+\([^)]+\)\s+(.+)/);
  const cpuAvg = cpuLoads.length > 0
    ? Math.round(cpuLoads.reduce((s, c) => s + Number(c.value), 0) / cpuLoads.length)
    : 0;

  // Free memory: find the hrStorageEntry where descr = "memory"
  let freeMemory = 0;
  for (const vb of storDescr) {
    if (vb.value.toString().toLowerCase() === 'memory') {
      const idx = vb.oid.split('.').pop();
      const units = Number(storUnits.find(s => s.oid.endsWith('.' + idx))?.value || 1024);
      const size = Number(storSize.find(s => s.oid.endsWith('.' + idx))?.value || 0);
      const used = Number(storUsed.find(s => s.oid.endsWith('.' + idx))?.value || 0);
      freeMemory = (size - used) * units;
      break;
    }
  }

  return {
    router_version: versionMatch ? versionMatch[1] : desc,
    router_uptime: formatUptime(Number(sysVals[1] || 0)),
    free_memory: freeMemory,
    cpu_load: cpuAvg,
    board_name: boardMatch ? boardMatch[1].trim() : '',
  };
}

function formatUptime(hundredths) {
  const secs = Math.floor(hundredths / 100);
  const w = Math.floor(secs / 604800);
  const d = Math.floor((secs % 604800) / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts = [];
  if (w > 0) parts.push(w + 'w');
  if (d > 0 || w > 0) parts.push(d + 'd');
  if (h > 0 || d > 0 || w > 0) parts.push(h + 'h');
  if (m > 0 || h > 0 || d > 0 || w > 0) parts.push(m + 'm');
  parts.push(s + 's');
  return parts.join('');
}

// ---------- Fetch router list from app ----------
async function fetchRouters() {
  const res = await fetch(ROUTERS_URL, {
    method: 'GET',
    headers: { 'x-api-key': COLLECTOR_API_KEY },
  });
  if (!res.ok) throw new Error(`Failed to fetch routers: ${res.status}`);
  const data = await res.json();
  return data.routers || [];
}

// ---------- Sync one router ----------
async function syncRouter(router) {
  let sessions = [], vlans = [], system_info;
  try {
    ({ sessions, vlans, system_info } = await pullRouterData(router));
  } catch (err) {
    console.error(`  ✗ SNMP failed for ${router.name}: ${err.message}`);
  }

  const payload = {
    router_id: router.id,
    router_name: router.name,
    sessions,
    vlans,
    system_info,
    api_key: COLLECTOR_API_KEY,
  };

  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.pending_commands?.length) {
      await executeCommands(router, data.pending_commands);
    }
  } catch (err) {
    console.error(`  ✗ Sync error for ${router.name}: ${err.message}`);
  }
}

// ---------- Command execution (still needs RouterOS API — SNMP is read-only) ----------
async function executeCommands(router, commands) {
  const conn = new RouterOSAPI({
    host: router.host,
    port: router.api_port || 8728,
    user: router.username,
    password: router.password || '',
  });
  try {
    await conn.connect();
    for (const cmd of commands) {
      if (cmd.command_type === 'suspend') {
        await conn.write('/ppp/secret/disable', ['=.comment=' + (cmd.pppoe_username || '')]);
        await conn.write('/ppp/active/remove', ['?name=' + (cmd.pppoe_username || '')]);
      } else if (cmd.command_type === 'reconnect') {
        await conn.write('/ppp/secret/enable', ['=.comment=' + (cmd.pppoe_username || '')]);
      }
    }
    console.log(`  ✓ Executed ${commands.length} commands on ${router.name}`);
  } catch (e) {
    console.error(`  ✗ Command failed: ${e.message}`);
  } finally {
    try { conn.close(); } catch (_) {}
  }
}

// ---------- Main loop ----------
async function tick() {
  try {
    const routers = await fetchRouters();
    for (const router of routers) {
      await syncRouter(router);
    }
  } catch (err) {
    console.error(`Tick failed: ${err.message}`);
  }
}

console.log('Mikrotik SNMP Collector starting...');
console.log(`App: ${APP_BASE}  |  SNMP polling every ${POLL_INTERVAL}s`);
console.log('Ensure SNMP is enabled on each router: /snmp set enabled=yes');
tick();
setInterval(tick, POLL_INTERVAL * 1000);