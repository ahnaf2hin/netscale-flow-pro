import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import net from 'node:net';
import crypto from 'node:crypto';

// ---------- Minimal RouterOS API client over node:net (TCP, no external deps) ----------
const enc = new TextEncoder();
const dec = new TextDecoder();

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// MD5 over a Uint8Array -> hex string, via node:crypto (used for RouterOS login challenge).
function md5(input) {
  return crypto.createHash('md5').update(Buffer.from(input)).digest('hex');
}

function lenBytes(n) {
  if (n < 0x80) return [n];
  if (n < 0x4000) return [0x80 | (n >> 8), n & 0xff];
  if (n < 0x200000) return [0xc0 | (n >> 16), (n >> 8) & 0xff, n & 0xff];
  if (n < 0x10000000) return [0xe0 | (n >> 24), (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  return [0xf0, (n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// Promise-based buffered TCP socket using node:net
class NetSocket {
  constructor(host, port) { this.host = host; this.port = port; this.chunks = []; this.waiters = []; this.closed = false; }
  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host: this.host, port: this.port });
      this.socket.on('connect', () => resolve());
      this.socket.on('error', (e) => reject(e));
      this.socket.on('data', (data) => { this.chunks.push(data); this._drain(); });
      this.socket.on('close', () => { this.closed = true; this._rejectAll(new Error('connection closed')); });
    });
  }
  _combined() { return Buffer.concat(this.chunks); }
  _drain() {
    while (this.waiters.length) {
      const w = this.waiters[0];
      const total = this._combined();
      if (total.length >= w.need) {
        this.chunks = [total.subarray(w.need)];
        this.waiters.shift();
        w.resolve(total.subarray(0, w.need));
      } else break;
    }
  }
  _rejectAll(e) { while (this.waiters.length) this.waiters.shift().reject(e); }
  readN(n) {
    if (this.closed) return Promise.reject(new Error('connection closed'));
    const total = this._combined();
    if (total.length >= n) { this.chunks = [total.subarray(n)]; return Promise.resolve(total.subarray(0, n)); }
    return new Promise((resolve, reject) => this.waiters.push({ need: n, resolve, reject }));
  }
  async readByte() { const b = await this.readN(1); return b[0]; }
  write(data) { return new Promise((resolve, reject) => this.socket.write(data, (e) => e ? reject(e) : resolve())); }
  close() { try { this.socket.destroy(); } catch (_) {} }
}

async function readWord(sock) {
  const b0 = await sock.readByte();
  let len;
  if ((b0 & 0x80) === 0) len = b0;
  else if ((b0 & 0xc0) === 0x80) { const b1 = await sock.readByte(); len = ((b0 & 0x3f) << 8) | b1; }
  else if ((b0 & 0xe0) === 0xc0) { const b1 = await sock.readByte(); const b2 = await sock.readByte(); len = ((b0 & 0x1f) << 16) | (b1 << 8) | b2; }
  else if ((b0 & 0xf0) === 0xe0) { const b1 = await sock.readByte(); const b2 = await sock.readByte(); const b3 = await sock.readByte(); len = ((b0 & 0x0f) << 24) | (b1 << 16) | (b2 << 8) | b3; }
  else { const b1 = await sock.readByte(); const b2 = await sock.readByte(); const b3 = await sock.readByte(); const b4 = await sock.readByte(); len = ((b0 & 0x0f) * 0x100000000) + (b1 << 16) + (b2 << 8) + b3; }
  if (len === 0) return null;
  return dec.decode(await sock.readN(len));
}

async function readSentence(sock) {
  const words = [];
  let w;
  while ((w = await readWord(sock)) !== null) words.push(w);
  return words;
}

async function writeWord(sock, str) {
  const bytes = enc.encode(str);
  await sock.write(Buffer.from(lenBytes(bytes.length)));
  await sock.write(Buffer.from(bytes));
}
async function writeSentence(sock, words) {
  for (const w of words) await writeWord(sock, w);
  await sock.write(Buffer.from([0]));
}

class ROSClient {
  constructor(host, port) { this.host = host; this.port = port; }
  async connect() {
    this.sock = new NetSocket(this.host, this.port);
    await this.sock.connect();
  }
  async login(user, pass) {
    // RouterOS v6.43+ prefers plaintext login. Send credentials with the initial /login.
    await writeSentence(this.sock, ["/login", "=name=" + user, "=password=" + pass || ""]);
    const s = await readSentence(this.sock);
    if (s[0] === "!done") return;
    // If the router replied with a challenge (!re + =ret=), fall back to challenge-response (pre-6.43).
    const ret = s.find(w => w.startsWith("=ret="));
    if (ret) {
      const chalBytes = hexToBytes(ret.slice(5));
      const passBytes = enc.encode(pass || "");
      const data = new Uint8Array(1 + passBytes.length + chalBytes.length);
      data[0] = 0; data.set(passBytes, 1); data.set(chalBytes, 1 + passBytes.length);
      const response = md5(data);
      await writeSentence(this.sock, ["/login", "=name=" + user, "=response=" + response]);
      const r2 = await readSentence(this.sock);
      if (r2[0] === "!done") return;
      throw new Error("Login failed: " + r2.join(" | "));
    }
    throw new Error("Login failed: " + s.join(" | "));
  }
  async write(words) {
    await writeSentence(this.sock, words);
    const results = [];
    while (true) {
      const sentence = await readSentence(this.sock);
      if (sentence.length === 0) break;
      const tag = sentence[0];
      if (tag === "!re") {
        const item = {};
        for (let i = 1; i < sentence.length; i++) {
          const w = sentence[i];
          if (w.startsWith("=")) {
            const eq = w.indexOf("=", 1);
            item[w.slice(1, eq)] = w.slice(eq + 1);
          }
        }
        results.push(item);
      } else if (tag === "!done") {
        break;
      } else if (tag === "!trap" || tag === "!fatal") {
        const msg = sentence.find(w => w.startsWith("=message=")) || sentence.join(" | ");
        throw new Error("RouterOS: " + msg);
      }
    }
    return results;
  }
  close() { try { this.sock.close(); } catch (_) {} }
}
// -------------------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const router_id = body?.router_id || body?.event?.entity_id || body?.data?.id;
    if (!router_id) return Response.json({ error: 'router_id required' }, { status: 400 });

    const router = await base44.asServiceRole.entities.MikrotikRouter.get(router_id);
    if (!router) return Response.json({ error: 'Router not found' }, { status: 404 });

    let sessions = [];
    let connected = false;
    let errMsg = null;

    try {
      const ros = new ROSClient(router.host, router.api_port || 8728);
      await ros.connect();
      await ros.login(router.username, router.password || '');
      connected = true;

      const active = await ros.write(['/ppp/active/print']);
      // Byte counters are NOT in /ppp/active/print — fetch them from the dynamic PPPoE interfaces.
      // Interface names are formatted as "<pppoe-USERNAME>"; tx-byte = download (router→client), rx-byte = upload (client→router).
      const ifaceBytes = {};
      try {
        const ifaces = await ros.write(['/interface/print']);
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
      } catch (_) { /* interface query failed; continue with zero bytes */ }
      sessions = active.map((s) => {
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
      ros.close();
    } catch (e) {
      errMsg = e.message;
    }

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.MikrotikRouter.update(router_id, {
      status: connected ? 'online' : 'offline',
      last_synced: now,
    });

    if (!connected) {
      return Response.json({ success: false, error: errMsg || 'Could not connect to router' });
    }

    // Upsert active sessions directly — batch-load customers + existing sessions to avoid per-row lookups.
    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 500);
    const custByUser = {};
    for (const c of customers) if (c.pppoe_username) custByUser[c.pppoe_username] = c.id;
    const existingSessions = await base44.asServiceRole.entities.PPPoESession.filter({ router_id }, '-last_synced', 500);
    const existByUser = {};
    for (const e of existingSessions) if (e.pppoe_username) existByUser[e.pppoe_username] = e;

    const toCreate = [];
    const toUpdate = [];
    for (const session of sessions) {
      if (!session.pppoe_username) continue;
      const customerId = custByUser[session.pppoe_username] || session.pppoe_username;
      const exist = existByUser[session.pppoe_username];
      // Compute live speed from byte delta since last sync (same method as managePppoe)
      let speedDl = 0, speedUl = 0;
      if (exist && exist.last_synced) {
        const secs = (new Date(now) - new Date(exist.last_synced)) / 1000;
        if (secs > 0) {
          speedDl = Math.max(0, Math.round(((session.download_bytes || 0) - (exist.download_bytes || 0)) / 1024 / secs));
          speedUl = Math.max(0, Math.round(((session.upload_bytes || 0) - (exist.upload_bytes || 0)) / 1024 / secs));
        }
      }
      const data = {
        ...session,
        download_speed_kbps: speedDl,
        upload_speed_kbps: speedUl,
        customer_id: customerId,
        router_id,
        router_name: router.name,
        last_synced: now,
      };
      if (exist) toUpdate.push({ id: exist.id, ...data });
      else toCreate.push(data);
    }
    if (toCreate.length > 0) await base44.asServiceRole.entities.PPPoESession.bulkCreate(toCreate);
    if (toUpdate.length > 0) await base44.asServiceRole.entities.PPPoESession.bulkUpdate(toUpdate);
    const upserted = toCreate.length + toUpdate.length;

    return Response.json({ success: true, router: router.name, sessions: sessions.length, upserted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});