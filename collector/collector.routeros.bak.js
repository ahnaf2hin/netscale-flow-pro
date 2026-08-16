// ============================================================
//  BACKUP — RouterOS API version of the collector
//  This is a snapshot of the original collector before switching
//  to SNMP. To revert: rename this file back to collector.js
//  and restore the original package.json (remove net-snmp).
// ============================================================

// ============================================================
//  Mikrotik Collector Agent
//  Runs on a machine on the SAME network as your Mikrotik router(s).
//  Pulls live PPPoE sessions + interface traffic and pushes them
//  to your Base44 ISP app every POLL_INTERVAL seconds.
//
//  Maintains a PERSISTENT RouterOS connection per router — logs in
//  once and reuses the connection across polls. Reconnects
//  automatically if the connection drops.
// ============================================================

import { RouterOSAPI } from 'node-routeros';

// ---------- CONFIG ----------
// 1. APP_BASE: your app's default Base44 app link (from the browser URL bar when viewing your app).
//    Looks like: https://app--your-app-name.base44.app
// 2. APP_ID: your app id (in the Base44 dashboard: Settings -> General, or the URL).
// 3. COLLECTOR_API_KEY: the same value you set as the COLLECTOR_API_KEY secret in the app.
const APP_BASE = 'https://app--YOUR-APP-NAME.base44.app';
const APP_ID = 'YOUR-APP-ID';
const COLLECTOR_API_KEY = 'YOUR-COLLECTOR-API-KEY';

const POLL_INTERVAL = 1; // seconds between syncs
// ----------------------------

const SYNC_URL = `${APP_BASE}/api/apps/${APP_ID}/functions/syncMikrotikData`;
const ROUTERS_URL = `${APP_BASE}/api/apps/${APP_ID}/functions/getRoutersForCollector`;

// ---------- Persistent connection pool ----------
// One RouterOSAPI connection per router_id, kept alive across polls.
const connPool = new Map(); // router_id -> { conn, router, ready }

async function getConn(router) {
  const existing = connPool.get(router.id);
  if (existing && existing.ready && existing.conn) {
    return existing.conn;
  }
  // (Re)connect
  const conn = new RouterOSAPI({
    host: router.host,
    port: router.api_port || 8728,
    user: router.username,
    password: router.password || '',
  });
  try {
    await conn.connect();
    connPool.set(router.id, { conn, router, ready: true });
    console.log(`  ✓ Connected to ${router.name} (${router.host})`);
    return conn;
  } catch (e) {
    connPool.set(router.id, { conn: null, router, ready: false });
    throw e;
  }
}

function markConnDead(routerId) {
  const entry = connPool.get(routerId);
  if (entry) {
    try { entry.conn?.close(); } catch (_) {}
    connPool.set(routerId, { conn: null, router: entry.router, ready: false });
  }
}

// ---------- Data extraction (uses persistent connection) ----------
async function pullRouterData(router) {
  const conn = await getConn(router);

  // Active PPPoE sessions
  const active = await conn.write('/ppp/active/print');
  // Byte counters from dynamic PPPoE interfaces.
  // Interface names: "<pppoe-USERNAME>"; tx-byte = download, rx-byte = upload.
  const ifaces = await conn.write('/interface/print');
  const ifaceBytes = {};
  for (const iface of ifaces) {
    if (!iface.name) continue;
    const m = iface.name.match(/^<pppoe-(.+)>$/);
    if (m) {
      ifaceBytes[m[1]] = {
        download: Number(iface['tx-byte'] || 0),
        upload: Number(iface['rx-byte'] || 0),
      };
    }
  }
  const sessions = active.map((s) => {
    const bytes = ifaceBytes[s.name] || {};
    return {
      pppoe_username: s.name,
      customer_name: s.comment || '',
      ip_address: s.address,
      uptime: s.uptime,
      download_bytes: bytes.download || 0,
      upload_bytes: bytes.upload || 0,
      status: 'online',
    };
  });

  // Interface traffic (VLANs / bridges / ethers)
  const vlans = [];
  for (const iface of ifaces) {
    const name = iface.name || iface['.id'];
    if (!name) continue;
    try {
      const stats = await conn.write('/interface/print', [
        '?=name=' + name,
        '=stats=',
      ]);
      const st = (stats[0] && stats[0].stats) || {};
      const rxBps = Number(st['rx-bps'] || 0) || Math.round(Number(st['rx-byte'] || 0) * 8 / 1024);
      const txBps = Number(st['tx-bps'] || 0) || Math.round(Number(st['tx-byte'] || 0) * 8 / 1024);
      vlans.push({
        vlan_id: name,
        vlan_name: name,
        tx_kbps: txBps,
        rx_kbps: rxBps,
      });
    } catch (e) {
      // some interfaces don't support stats; skip
    }
  }

  return { sessions, vlans };
}

async function fetchRouters() {
  const res = await fetch(ROUTERS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': COLLECTOR_API_KEY },
    body: JSON.stringify({ api_key: COLLECTOR_API_KEY }),
  });
  if (!res.ok) throw new Error(`Failed to fetch routers: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.routers || [];
}

async function syncRouter(router) {
  let sessions = [];
  let vlans = [];
  try {
    ({ sessions, vlans } = await pullRouterData(router));
  } catch (err) {
    console.error(`  ✗ Connection lost for ${router.name}: ${err.message} — will reconnect next cycle`);
    markConnDead(router.id);
    // Push empty heartbeat so the app can detect staleness
  }

  const payload = {
    router_id: router.id,
    router_name: router.name,
    sessions,
    vlans,
    api_key: COLLECTOR_API_KEY,
  };

  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`  ✗ Sync failed: ${res.status}`, data);
    } else {
      if (data.pending_commands && data.pending_commands.length) {
        await executeCommands(router, data.pending_commands);
      }
    }
  } catch (err) {
    console.error(`  ✗ Network error syncing ${router.name}: ${err.message}`);
  }
}

async function executeCommands(router, commands) {
  const conn = await getConn(router);
  if (!conn) {
    console.error(`  ✗ Cannot connect to execute commands`);
    return;
  }
  for (const cmd of commands) {
    try {
      if (cmd.command_type === 'suspend') {
        await conn.write('/ppp/secret/disable', ['=.comment=' + (cmd.pppoe_username || '')]);
        await conn.write('/ppp/active/remove', ['?name=' + (cmd.pppoe_username || '')]);
      } else if (cmd.command_type === 'reconnect') {
        await conn.write('/ppp/secret/enable', ['=.comment=' + (cmd.pppoe_username || '')]);
      }
    } catch (e) {
      console.error(`  ✗ Command ${cmd.command_type} failed: ${e.message}`);
      markConnDead(router.id);
      break;
    }
  }
}

async function tick() {
  try {
    const routers = await fetchRouters();
    if (!routers.length) return;
    for (const router of routers) {
      await syncRouter(router);
    }
  } catch (err) {
    console.error(`Tick failed: ${err.message}`);
  }
}

console.log('Mikrotik Collector Agent starting...');
console.log(`App: ${APP_BASE}  |  Polling every ${POLL_INTERVAL}s (persistent connections)`);
tick();
setInterval(tick, POLL_INTERVAL * 1000);