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
const OLT_POLL_INTERVAL = 60; // seconds between OLT/ONU optical polls (signal power changes slowly)
// ----------------------------

const SYNC_URL = `${APP_BASE}/api/collector/sync-mikrotik`;
const ROUTERS_URL = `${APP_BASE}/api/collector/routers`;
const OLTS_URL = `${APP_BASE}/api/collector/olts`;
const SYNC_OLT_URL = `${APP_BASE}/api/collector/sync-olt`;

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

// ============================================================
//  OLT / ONU Optical Monitoring (GPON/EPON, SNMP)
//  Polls each configured OLT for its ONUs' online/offline state and Rx/Tx
//  optical power (dBm), and pushes results to /api/collector/sync-olt.
//
//  OID profiles are data-driven (set per-OLT in the app's OLT Management
//  page) so this isn't locked to one vendor. A "huawei_ma5600" preset is
//  built in; for any other vendor/model, set oid_profile="custom" on the
//  OLT and fill in its custom_status_oid / custom_serial_oid /
//  custom_rx_power_oid / custom_tx_power_oid fields (find them via your
//  vendor's MIB docs or `snmpwalk -v2c -c <community> <ip> <base-oid>`).
//
//  Matching rows across the 4 SNMP tables doesn't require decoding each
//  vendor's frame/slot/port/onu-id index-packing scheme — every table is
//  indexed by the same composite key, so we just join on the OID *suffix*
//  after each column's base OID (same technique as the ifIndex matching
//  used for PPPoE/VLAN interfaces above).
// ============================================================

const OID_PROFILES = {
  huawei_ma5600: {
    // hwGponDeviceMIB (private enterprise 2011.6.128). Verify against your exact
    // MA5600T/MA5800 firmware via snmpwalk before relying on this in production —
    // switch oid_profile to "custom" on the OLT if these don't match your hardware.
    statusOid: '1.3.6.1.4.1.2011.6.128.1.1.2.46.1.15',  // hwGponDeviceOntRunState (1 = online)
    serialOid: '1.3.6.1.4.1.2011.6.128.1.1.2.46.1.3',   // hwGponDeviceOntSn
    rxPowerOid: '1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4',  // hwGponDeviceOntOpticalDdmRxPower
    txPowerOid: '1.3.6.1.4.1.2011.6.128.1.1.2.51.1.6',  // hwGponDeviceOntOpticalDdmTxPower
    onlineValue: 1,
  },
};

function profileFor(olt) {
  if (olt.oid_profile === 'custom') {
    return {
      statusOid: olt.custom_status_oid,
      serialOid: olt.custom_serial_oid,
      rxPowerOid: olt.custom_rx_power_oid,
      txPowerOid: olt.custom_tx_power_oid,
      onlineValue: 1,
    };
  }
  return OID_PROFILES[olt.oid_profile] || OID_PROFILES.huawei_ma5600;
}

const oltSnmpPool = new Map();
function getOltSnmpSession(olt) {
  if (oltSnmpPool.has(olt.id)) return oltSnmpPool.get(olt.id);
  const session = snmp.createSession(olt.ip_address, olt.snmp_community || 'public', {
    port: olt.snmp_port || 161,
    timeout: 4000,
    retries: 1,
  });
  oltSnmpPool.set(olt.id, session);
  return session;
}

// Re-key a walk's varbinds by the OID suffix after `base` — used as an opaque join key
// across the status/serial/rxPower/txPower tables (see header comment above).
function bySuffix(varbinds, base) {
  const map = {};
  for (const vb of varbinds) {
    const suffix = vb.oid.startsWith(base + '.') ? vb.oid.slice(base.length + 1) : vb.oid;
    map[suffix] = vb.value;
  }
  return map;
}

async function pullOltData(olt) {
  const profile = profileFor(olt);
  if (!profile.statusOid || !profile.serialOid || !profile.rxPowerOid || !profile.txPowerOid) {
    throw new Error('Incomplete OID profile — set oid_profile or the custom_*_oid fields on this OLT');
  }
  const session = getOltSnmpSession(olt);
  const [statusVb, serialVb, rxVb, txVb] = await Promise.all([
    walk(session, profile.statusOid),
    walk(session, profile.serialOid),
    walk(session, profile.rxPowerOid),
    walk(session, profile.txPowerOid),
  ]);

  const statuses = bySuffix(statusVb, profile.statusOid);
  const serials = bySuffix(serialVb, profile.serialOid);
  const rx = bySuffix(rxVb, profile.rxPowerOid);
  const tx = bySuffix(txVb, profile.txPowerOid);

  const divisor = olt.custom_power_divisor || 100; // raw SNMP int -> dBm (0.01 dBm steps is the common convention)
  const threshold = olt.low_signal_threshold_dbm ?? -27;

  const onus = [];
  for (const [suffix, serialRaw] of Object.entries(serials)) {
    const serial_number = serialRaw?.toString().trim();
    if (!serial_number) continue;
    const rawStatus = statuses[suffix];
    const online = rawStatus !== undefined && Number(rawStatus) === (profile.onlineValue ?? 1);
    const rx_power_dbm = rx[suffix] !== undefined ? Math.round((Number(rx[suffix]) / divisor) * 100) / 100 : null;
    const tx_power_dbm = tx[suffix] !== undefined ? Math.round((Number(tx[suffix]) / divisor) * 100) / 100 : null;

    // Loss-of-signal isn't a separate OID in this join — approximate it as "online per the
    // device, but no usable Rx light" so a fiber cut/dirty connector still surfaces as a fault
    // instead of silently reading as a healthy link.
    let status = 'offline';
    if (online) status = (rx_power_dbm === null || rx_power_dbm < threshold) ? 'los' : 'online';

    onus.push({ pon_port: suffix, serial_number, rx_power_dbm, tx_power_dbm, status });
  }
  return onus;
}

async function fetchOlts() {
  const res = await fetch(OLTS_URL, { method: 'GET', headers: { 'x-api-key': COLLECTOR_API_KEY } });
  if (!res.ok) throw new Error(`Failed to fetch OLTs: ${res.status}`);
  const data = await res.json();
  return data.olts || [];
}

async function syncOlt(olt) {
  let onus = [];
  let reachable = true;
  try {
    onus = await pullOltData(olt);
  } catch (err) {
    reachable = false;
    console.error(`  ✗ OLT SNMP failed for ${olt.name}: ${err.message}`);
  }
  try {
    await fetch(SYNC_OLT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ olt_id: olt.id, olt_name: olt.name, reachable, onus, api_key: COLLECTOR_API_KEY }),
    });
  } catch (err) {
    console.error(`  ✗ OLT sync error for ${olt.name}: ${err.message}`);
  }
}

async function oltTick() {
  try {
    const olts = await fetchOlts();
    for (const olt of olts) await syncOlt(olt);
  } catch (err) {
    console.error(`OLT tick failed: ${err.message}`);
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
console.log(`App: ${APP_BASE}  |  SNMP polling every ${POLL_INTERVAL}s  |  OLT polling every ${OLT_POLL_INTERVAL}s`);
console.log('Ensure SNMP is enabled on each router: /snmp set enabled=yes');
tick();
setInterval(tick, POLL_INTERVAL * 1000);
oltTick();
setInterval(oltTick, OLT_POLL_INTERVAL * 1000);