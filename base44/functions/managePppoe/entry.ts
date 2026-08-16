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
function md5(input) { return crypto.createHash('md5').update(Buffer.from(input)).digest('hex'); }
function lenBytes(n) {
  if (n < 0x80) return [n];
  if (n < 0x4000) return [0x80 | (n >> 8), n & 0xff];
  if (n < 0x200000) return [0xc0 | (n >> 16), (n >> 8) & 0xff, n & 0xff];
  if (n < 0x10000000) return [0xe0 | (n >> 24), (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  return [0xf0, (n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

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
  const words = []; let w;
  while ((w = await readWord(sock)) !== null) words.push(w);
  return words;
}
async function writeWord(sock, str) {
  const bytes = enc.encode(str);
  await sock.write(Buffer.from(lenBytes(bytes.length)));
  await sock.write(Buffer.from(bytes));
}
async function writeSentence(sock, words) {
  for (const w of words) if (w !== undefined && w !== null) await writeWord(sock, w);
  await sock.write(Buffer.from([0]));
}

class ROSClient {
  constructor(host, port) { this.host = host; this.port = port; }
  async connect() { this.sock = new NetSocket(this.host, this.port); await this.sock.connect(); }
  async login(user, pass) {
    // RouterOS v6.43+ plaintext login
    await writeSentence(this.sock, ["/login", "=name=" + user, "=password=" + (pass || "")]);
    const s = await readSentence(this.sock);
    if (s[0] === "!done") return;
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
          if (w.startsWith("=")) { const eq = w.indexOf("=", 1); item[w.slice(1, eq)] = w.slice(eq + 1); }
        }
        results.push(item);
      } else if (tag === "!done") { break; }
      else if (tag === "!trap" || tag === "!fatal") {
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const router_id = body.router_id;
    if (!router_id) return Response.json({ error: 'router_id required' }, { status: 400 });

    const router = await base44.asServiceRole.entities.MikrotikRouter.get(router_id);
    if (!router) return Response.json({ error: 'Router not found' }, { status: 404 });

    const ros = new ROSClient(router.host, router.api_port || 8728);
    let users = [];
    let active = [];
    let profiles = [];

    try {
      await ros.connect();
      await ros.login(router.username, router.password || '');

      if (action === 'list') {
        users = await ros.write(['/ppp/secret/print']);
        active = await ros.write(['/ppp/active/print']);
        profiles = await ros.write(['/ppp/profile/print']);
      } else if (action === 'add') {
        const words = ['/ppp/secret/add', '=name=' + body.name, '=password=' + (body.password || ''), '=service=pppoe', '=profile=' + (body.profile || 'default')];
        if (body.comment) words.push('=comment=' + body.comment);
        await ros.write(words);
      } else if (action === 'update') {
        const words = ['/ppp/secret/set', '=.id=' + body.id];
        if (body.name) words.push('=name=' + body.name);
        if (body.password) words.push('=password=' + body.password);
        if (body.profile) words.push('=profile=' + body.profile);
        if (body.comment !== undefined && body.comment !== null) words.push('=comment=' + body.comment);
        await ros.write(words);
      } else if (action === 'delete') {
        await ros.write(['/ppp/secret/remove', '=.id=' + body.id]);
      } else if (action === 'enable') {
        await ros.write(['/ppp/secret/enable', '=.id=' + body.id]);
      } else if (action === 'disable') {
        await ros.write(['/ppp/secret/disable', '=.id=' + body.id]);
      } else if (action === 'import_customers') {
        users = await ros.write(['/ppp/secret/print']);
      } else {
        ros.close();
        return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
      }
      ros.close();
    } catch (e) {
      ros.close();
      await base44.asServiceRole.entities.MikrotikRouter.update(router_id, { status: 'offline' });
      return Response.json({ success: false, error: e.message });
    }

    // Mark router online after a successful API conversation
    await base44.asServiceRole.entities.MikrotikRouter.update(router_id, {
      status: 'online',
      last_synced: new Date().toISOString(),
    });

    // Import PPPoE secrets into Customer records (only those not already present)
    if (action === 'import_customers') {
      const existing = await base44.asServiceRole.entities.Customer.list('-created_date', 1000);
      const existByUser = {};
      for (const c of existing) if (c.pppoe_username) existByUser[c.pppoe_username] = true;
      const toCreate = [];
      for (const u of users) {
        if (!u.name || existByUser[u.name]) continue;
        toCreate.push({
          name: u.comment || u.name,
          phone: '',
          pppoe_username: u.name,
          pppoe_password: u.password || '',
          customer_code: 'CUST-' + Math.floor(100000 + Math.random() * 900000),
          status: 'active',
          notes: 'Imported from MikroTik ' + (router.name || router.host),
        });
      }
      let created = 0;
      if (toCreate.length > 0) {
        await base44.asServiceRole.entities.Customer.bulkCreate(toCreate);
        created = toCreate.length;
      }
      return Response.json({ success: true, created, skipped: users.length - created, total: users.length });
    }

    // For 'list', cache full PPPoE user data into PPPoESession so the UI loads
    // instantly from the DB, and keep linked Customer status in sync with enable/disable.
    if (action === 'list') {
      const now = new Date().toISOString();
      const activeMap = {};
      for (const a of active) if (a.name) activeMap[a.name] = a;
      const allCustomers = await base44.asServiceRole.entities.Customer.list('-created_date', 1000);
      const custByUser = {};
      for (const c of allCustomers) if (c.pppoe_username) custByUser[c.pppoe_username] = c;
      const existingSessions = await base44.asServiceRole.entities.PPPoESession.filter({ router_id }, '-last_synced', 500);
      const existByUser = {};
      for (const e of existingSessions) if (e.pppoe_username) existByUser[e.pppoe_username] = e;
      const toCreate = [];
      const toUpdate = [];
      const custUpdates = [];
      for (const u of users) {
        if (!u.name) continue;
        const live = activeMap[u.name];
        const linked = custByUser[u.name];
        const disabled = u.disabled === 'true';
        const exist = existByUser[u.name];
        const curDl = live ? Number(live['rx-byte'] || 0) : 0;
        const curUl = live ? Number(live['tx-byte'] || 0) : 0;
        let speedDl = 0, speedUl = 0;
        if (exist && exist.last_synced && live) {
          const secs = (new Date(now) - new Date(exist.last_synced)) / 1000;
          if (secs > 0) {
            speedDl = Math.max(0, Math.round((curDl - (exist.download_bytes || 0)) / 1024 / secs));
            speedUl = Math.max(0, Math.round((curUl - (exist.upload_bytes || 0)) / 1024 / secs));
          }
        }
        const data = {
          pppoe_username: u.name,
          password: u.password || '',
          profile: u.profile || 'default',
          secret_id: u['.id'] || '',
          disabled,
          customer_name: linked ? linked.name : (u.comment || ''),
          customer_id: linked ? linked.id : '',
          customer_code: linked ? (linked.customer_code || '') : '',
          ip_address: live ? live.address : '',
          uptime: live ? live.uptime : '',
          download_speed_kbps: speedDl,
          upload_speed_kbps: speedUl,
          download_bytes: curDl,
          upload_bytes: curUl,
          status: disabled ? 'suspended' : (live ? 'online' : 'offline'),
          router_id,
          router_name: router.name,
          last_synced: now,
        };
        if (exist) toUpdate.push({ id: exist.id, ...data });
        else toCreate.push(data);
        if (linked) {
          if (disabled && linked.status !== 'suspended') custUpdates.push({ id: linked.id, status: 'suspended' });
          else if (!disabled && linked.status === 'suspended') custUpdates.push({ id: linked.id, status: 'active' });
        }
      }
      if (toCreate.length > 0) await base44.asServiceRole.entities.PPPoESession.bulkCreate(toCreate);
      if (toUpdate.length > 0) await base44.asServiceRole.entities.PPPoESession.bulkUpdate(toUpdate);
      if (custUpdates.length > 0) await base44.asServiceRole.entities.Customer.bulkUpdate(custUpdates);
    }

    return Response.json({
      success: true,
      users: users.map(u => ({
        id: u['.id'], name: u.name, password: u.password || '', profile: u.profile || 'default',
        service: u.service || '', comment: u.comment || '', disabled: u.disabled === 'true',
        last_caller_id: u['last-caller-id'] || '', last_logged_out: u['last-logged-out'] || '',
      })),
      active: active.map(a => ({ name: a.name, address: a.address, uptime: a.uptime, rx_byte: a['rx-byte'], tx_byte: a['tx-byte'] })),
      profiles: profiles.map(p => ({ name: p.name, rate_limit: p['rate-limit'] || '' })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});