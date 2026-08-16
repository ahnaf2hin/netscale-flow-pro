import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import net from 'node:net';
import crypto from 'node:crypto';

// ---------- Minimal RouterOS API client (inlined — no local imports) ----------
const enc = new TextEncoder();
const dec = new TextDecoder();

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
    await writeSentence(this.sock, ["/login", "=name=" + user, "=password=" + pass || ""]);
    const s = await readSentence(this.sock);
    if (s[0] === "!done") return;
    const ret = s.find(w => w.startsWith("=ret="));
    if (ret) {
      const hex = ret.slice(5);
      const chalBytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < chalBytes.length; i++) chalBytes[i] = parseInt(hex.substr(i * 2, 2), 16);
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { router_id, pppoe_username } = body;
    if (!router_id || !pppoe_username) {
      return Response.json({ error: 'router_id and pppoe_username required' }, { status: 400 });
    }

    // Find the existing session to get previous byte counters for delta calculation
    const sessions = await base44.asServiceRole.entities.PPPoESession.filter(
      { router_id, pppoe_username }, '-last_synced', 1
    );
    const exist = sessions.length > 0 ? sessions[0] : null;

    const router = await base44.asServiceRole.entities.MikrotikRouter.get(router_id);
    if (!router) return Response.json({ error: 'Router not found' }, { status: 404 });

    let downloadBytes = exist?.download_bytes || 0;
    let uploadBytes = exist?.upload_bytes || 0;
    let uptime = exist?.uptime || '';
    let ip_address = exist?.ip_address || '';
    let online = false;

    try {
      const ros = new ROSClient(router.host, router.api_port || 8728);
      await ros.connect();
      await ros.login(router.username, router.password || '');

      // Get the single active PPPoE session for this user
      const active = await ros.write(['/ppp/active/print', '?name=' + pppoe_username]);
      if (active.length > 0) {
        online = true;
        uptime = active[0].uptime || uptime;
        ip_address = active[0].address || ip_address;
      }

      // Get byte counters for just this interface
      const ifname = '<pppoe-' + pppoe_username + '>';
      const ifaces = await ros.write([
        '/interface/print',
        '?name=' + ifname,
        '=.proplist=name,tx-byte,rx-byte'
      ]);
      if (ifaces.length > 0) {
        downloadBytes = Number(ifaces[0]['tx-byte'] || 0);
        uploadBytes = Number(ifaces[0]['rx-byte'] || 0);
      }

      ros.close();
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }

    // Compute live speed from byte delta since last sync
    const now = new Date();
    const nowIso = now.toISOString();
    let speedDl = 0, speedUl = 0;
    if (exist && exist.last_synced) {
      const secs = (now - new Date(exist.last_synced)) / 1000;
      if (secs > 0) {
        speedDl = Math.max(0, Math.round(((downloadBytes - (exist.download_bytes || 0)) / 1024 / secs)));
        speedUl = Math.max(0, Math.round(((uploadBytes - (exist.upload_bytes || 0)) / 1024 / secs)));
      }
    }

    // Update the session record
    const updateData = {
      download_bytes: downloadBytes,
      upload_bytes: uploadBytes,
      download_speed_kbps: speedDl,
      upload_speed_kbps: speedUl,
      uptime,
      ip_address,
      status: online ? 'online' : 'offline',
      last_synced: nowIso,
    };

    if (exist) {
      await base44.asServiceRole.entities.PPPoESession.update(exist.id, updateData);
    }

    return Response.json({
      success: true,
      download_speed_kbps: speedDl,
      upload_speed_kbps: speedUl,
      download_bytes: downloadBytes,
      upload_bytes: uploadBytes,
      uptime,
      ip_address,
      status: online ? 'online' : 'offline',
      last_synced: nowIso,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});