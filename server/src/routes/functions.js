import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { ROSClient } from "../lib/routeros.js";
import { sendEmail } from "../lib/email.js";
import { startCheckout, completeIntent } from "../lib/checkout.js";

const router = Router();
router.use(requireAuth);

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

// ---------------------------------------------------------------------------
// managePppoe — list/add/update/delete/enable/disable PPP secrets, import_customers
// ---------------------------------------------------------------------------
router.post(
  "/managePppoe",
  wrap(async (req, res) => {
    const body = req.body || {};
    const { action, router_id } = body;
    if (!router_id) return res.status(400).json({ error: "router_id required" });

    const routerRow = await prisma.mikrotikRouter.findUnique({ where: { id: router_id } });
    if (!routerRow) return res.status(404).json({ error: "Router not found" });

    const ros = new ROSClient(routerRow.host, routerRow.api_port || 8728);
    let users = [], active = [], profiles = [];

    try {
      await ros.connect();
      await ros.login(routerRow.username, routerRow.password || "");

      if (action === "list") {
        users = await ros.write(["/ppp/secret/print"]);
        active = await ros.write(["/ppp/active/print"]);
        profiles = await ros.write(["/ppp/profile/print"]);
      } else if (action === "add") {
        const words = ["/ppp/secret/add", "=name=" + body.name, "=password=" + (body.password || ""), "=service=pppoe", "=profile=" + (body.profile || "default")];
        if (body.comment) words.push("=comment=" + body.comment);
        await ros.write(words);
      } else if (action === "update") {
        const words = ["/ppp/secret/set", "=.id=" + body.id];
        if (body.name) words.push("=name=" + body.name);
        if (body.password) words.push("=password=" + body.password);
        if (body.profile) words.push("=profile=" + body.profile);
        if (body.comment !== undefined && body.comment !== null) words.push("=comment=" + body.comment);
        await ros.write(words);
      } else if (action === "delete") {
        await ros.write(["/ppp/secret/remove", "=.id=" + body.id]);
      } else if (action === "enable") {
        await ros.write(["/ppp/secret/enable", "=.id=" + body.id]);
      } else if (action === "disable") {
        await ros.write(["/ppp/secret/disable", "=.id=" + body.id]);
      } else if (action === "import_customers") {
        users = await ros.write(["/ppp/secret/print"]);
      } else {
        ros.close();
        return res.status(400).json({ error: "Unknown action: " + action });
      }
      ros.close();
    } catch (e) {
      ros.close();
      await prisma.mikrotikRouter.update({ where: { id: router_id }, data: { status: "offline" } });
      return res.json({ success: false, error: e.message });
    }

    await prisma.mikrotikRouter.update({ where: { id: router_id }, data: { status: "online", last_synced: new Date().toISOString() } });

    if (action === "import_customers") {
      const existing = await prisma.customer.findMany({ take: 1000, orderBy: { created_date: "desc" } });
      const existByUser = {};
      for (const c of existing) if (c.pppoe_username) existByUser[c.pppoe_username] = true;
      const toCreate = [];
      for (const u of users) {
        if (!u.name || existByUser[u.name]) continue;
        toCreate.push({
          name: u.comment || u.name,
          phone: "",
          pppoe_username: u.name,
          pppoe_password: u.password || "",
          customer_code: "CUST-" + Math.floor(100000 + Math.random() * 900000),
          status: "active",
          notes: "Imported from MikroTik " + (routerRow.name || routerRow.host),
        });
      }
      if (toCreate.length > 0) await prisma.$transaction(toCreate.map((d) => prisma.customer.create({ data: d })));
      return res.json({ success: true, created: toCreate.length, skipped: users.length - toCreate.length, total: users.length });
    }

    if (action === "list") {
      const now = new Date().toISOString();
      const activeMap = {};
      for (const a of active) if (a.name) activeMap[a.name] = a;
      const allCustomers = await prisma.customer.findMany({ take: 1000, orderBy: { created_date: "desc" } });
      const custByUser = {};
      for (const c of allCustomers) if (c.pppoe_username) custByUser[c.pppoe_username] = c;
      const existingSessions = await prisma.pPPoESession.findMany({ where: { router_id }, take: 500, orderBy: { last_synced: "desc" } });
      const existByUser = {};
      for (const e of existingSessions) if (e.pppoe_username) existByUser[e.pppoe_username] = e;

      const toCreate = [], toUpdate = [], custUpdates = [];
      for (const u of users) {
        if (!u.name) continue;
        const live = activeMap[u.name];
        const linked = custByUser[u.name];
        const disabled = u.disabled === "true";
        const exist = existByUser[u.name];
        const curDl = live ? Number(live["rx-byte"] || 0) : 0;
        const curUl = live ? Number(live["tx-byte"] || 0) : 0;
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
          password: u.password || "",
          profile: u.profile || "default",
          secret_id: u[".id"] || "",
          disabled,
          customer_name: linked ? linked.name : u.comment || "",
          customer_id: linked ? linked.id : "",
          customer_code: linked ? linked.customer_code || "" : "",
          ip_address: live ? live.address : "",
          uptime: live ? live.uptime : "",
          download_speed_kbps: speedDl,
          upload_speed_kbps: speedUl,
          download_bytes: curDl,
          upload_bytes: curUl,
          status: disabled ? "suspended" : live ? "online" : "offline",
          router_id,
          router_name: routerRow.name,
          last_synced: now,
        };
        if (exist) toUpdate.push({ id: exist.id, ...data });
        else toCreate.push(data);
        if (linked) {
          if (disabled && linked.status !== "suspended") custUpdates.push({ id: linked.id, status: "suspended" });
          else if (!disabled && linked.status === "suspended") custUpdates.push({ id: linked.id, status: "active" });
        }
      }
      if (toCreate.length) await prisma.$transaction(toCreate.map((d) => prisma.pPPoESession.create({ data: d })));
      if (toUpdate.length) await prisma.$transaction(toUpdate.map(({ id, ...d }) => prisma.pPPoESession.update({ where: { id }, data: d })));
      if (custUpdates.length) await prisma.$transaction(custUpdates.map(({ id, ...d }) => prisma.customer.update({ where: { id }, data: d })));
    }

    res.json({
      success: true,
      users: users.map((u) => ({
        id: u[".id"], name: u.name, password: u.password || "", profile: u.profile || "default",
        service: u.service || "", comment: u.comment || "", disabled: u.disabled === "true",
        last_caller_id: u["last-caller-id"] || "", last_logged_out: u["last-logged-out"] || "",
      })),
      active: active.map((a) => ({ name: a.name, address: a.address, uptime: a.uptime, rx_byte: a["rx-byte"], tx_byte: a["tx-byte"] })),
      profiles: profiles.map((p) => ({ name: p.name, rate_limit: p["rate-limit"] || "" })),
    });
  })
);

// ---------------------------------------------------------------------------
// syncCustomerSpeed — single-session live byte-delta poll
// ---------------------------------------------------------------------------
router.post(
  "/syncCustomerSpeed",
  wrap(async (req, res) => {
    const { router_id, pppoe_username } = req.body || {};
    if (!router_id || !pppoe_username) return res.status(400).json({ error: "router_id and pppoe_username required" });

    const sessions = await prisma.pPPoESession.findMany({ where: { router_id, pppoe_username }, take: 1, orderBy: { last_synced: "desc" } });
    const exist = sessions[0] || null;
    const routerRow = await prisma.mikrotikRouter.findUnique({ where: { id: router_id } });
    if (!routerRow) return res.status(404).json({ error: "Router not found" });

    let downloadBytes = exist?.download_bytes || 0, uploadBytes = exist?.upload_bytes || 0;
    let uptime = exist?.uptime || "", ip_address = exist?.ip_address || "", online = false;

    const ros = new ROSClient(routerRow.host, routerRow.api_port || 8728);
    try {
      await ros.connect();
      await ros.login(routerRow.username, routerRow.password || "");
      const activeList = await ros.write(["/ppp/active/print", "?name=" + pppoe_username]);
      if (activeList.length > 0) {
        online = true;
        uptime = activeList[0].uptime || uptime;
        ip_address = activeList[0].address || ip_address;
      }
      const ifname = "<pppoe-" + pppoe_username + ">";
      const ifaces = await ros.write(["/interface/print", "?name=" + ifname, "=.proplist=name,tx-byte,rx-byte"]);
      if (ifaces.length > 0) {
        downloadBytes = Number(ifaces[0]["tx-byte"] || 0);
        uploadBytes = Number(ifaces[0]["rx-byte"] || 0);
      }
      ros.close();
    } catch (e) {
      ros.close();
      return res.status(500).json({ error: e.message });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    let speedDl = 0, speedUl = 0;
    if (exist && exist.last_synced) {
      const secs = (now - new Date(exist.last_synced)) / 1000;
      if (secs > 0) {
        speedDl = Math.max(0, Math.round((downloadBytes - (exist.download_bytes || 0)) / 1024 / secs));
        speedUl = Math.max(0, Math.round((uploadBytes - (exist.upload_bytes || 0)) / 1024 / secs));
      }
    }

    const updateData = {
      download_bytes: downloadBytes, upload_bytes: uploadBytes,
      download_speed_kbps: speedDl, upload_speed_kbps: speedUl,
      uptime, ip_address, status: online ? "online" : "offline", last_synced: nowIso,
    };
    if (exist) await prisma.pPPoESession.update({ where: { id: exist.id }, data: updateData });

    res.json({ success: true, ...updateData });
  })
);

// ---------------------------------------------------------------------------
// syncRouterInterfaces — full VLAN/interface kbps polling for a router
// ---------------------------------------------------------------------------
router.post(
  "/syncRouterInterfaces",
  wrap(async (req, res) => {
    const { router_id } = req.body || {};
    if (!router_id) return res.status(400).json({ error: "router_id required" });
    const routerRow = await prisma.mikrotikRouter.findUnique({ where: { id: router_id } });
    if (!routerRow) return res.status(404).json({ error: "Router not found" });

    let interfaces = [];
    const ros = new ROSClient(routerRow.host, routerRow.api_port || 8728);
    try {
      await ros.connect();
      await ros.login(routerRow.username, routerRow.password || "");
      interfaces = await ros.write(["/interface/print", "=.proplist=name,type,tx-byte,rx-byte,running"]);
      ros.close();
    } catch (e) {
      ros.close();
      return res.status(500).json({ error: "Router connection failed: " + e.message });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const existingRecords = await prisma.vlanTraffic.findMany({ where: { router_id }, take: 200, orderBy: { last_synced: "desc" } });
    const existingMap = new Map(existingRecords.map((r) => [r.vlan_id, r]));

    const toCreate = [], toUpdate = [], results = [];
    for (const iface of interfaces) {
      const name = iface.name;
      if (!name) continue;
      const txBytes = Number(iface["tx-byte"] || 0), rxBytes = Number(iface["rx-byte"] || 0);
      const exist = existingMap.get(name);
      let txKbps = 0, rxKbps = 0;
      if (exist && exist.last_synced) {
        const secs = (now - new Date(exist.last_synced)) / 1000;
        if (secs > 0) {
          txKbps = Math.max(0, Math.round((txBytes - (exist.tx_bytes || 0)) / 1024 / secs));
          rxKbps = Math.max(0, Math.round((rxBytes - (exist.rx_bytes || 0)) / 1024 / secs));
        }
      }
      const data = { router_id, router_name: routerRow.name, vlan_id: name, vlan_name: name, tx_kbps: txKbps, rx_kbps: rxKbps, tx_bytes: txBytes, rx_bytes: rxBytes, last_synced: nowIso };
      if (exist) toUpdate.push({ id: exist.id, ...data });
      else toCreate.push(data);
      results.push({ name, type: iface.type, tx_kbps: txKbps, rx_kbps: rxKbps, running: iface.running });
    }
    if (toCreate.length) await prisma.$transaction(toCreate.map((d) => prisma.vlanTraffic.create({ data: d })));
    if (toUpdate.length) await prisma.$transaction(toUpdate.map(({ id, ...d }) => prisma.vlanTraffic.update({ where: { id }, data: d })));
    await prisma.mikrotikRouter.update({ where: { id: router_id }, data: { status: "online", last_synced: nowIso } }).catch(() => {});

    res.json({ success: true, count: results.length, interfaces: results });
  })
);

// ---------------------------------------------------------------------------
// syncMonitoredInterfaces — targeted kbps refresh for a set of interface names
// ---------------------------------------------------------------------------
router.post(
  "/syncMonitoredInterfaces",
  wrap(async (req, res) => {
    const { router_id, interface_names } = req.body || {};
    if (!router_id || !Array.isArray(interface_names) || interface_names.length === 0) {
      return res.status(400).json({ error: "router_id and interface_names required" });
    }
    const routerRow = await prisma.mikrotikRouter.findUnique({ where: { id: router_id } });
    if (!routerRow) return res.status(404).json({ error: "Router not found" });

    let interfaces = [];
    const ros = new ROSClient(routerRow.host, routerRow.api_port || 8728);
    try {
      await ros.connect();
      await ros.login(routerRow.username, routerRow.password || "");
      interfaces = await ros.write(["/interface/print", "=.proplist=name,tx-byte,rx-byte"]);
      ros.close();
    } catch (e) {
      ros.close();
      return res.status(500).json({ error: "Router connection failed: " + e.message });
    }

    const nameSet = new Set(interface_names);
    const monitored = interfaces.filter((i) => nameSet.has(i.name));
    if (monitored.length === 0) return res.json({ success: true, interfaces: [] });

    const now = new Date();
    const nowIso = now.toISOString();
    const existingRecords = await prisma.vlanTraffic.findMany({ where: { router_id }, take: 200, orderBy: { last_synced: "desc" } });
    const existingMap = new Map();
    for (const rec of existingRecords) if (nameSet.has(rec.vlan_id)) existingMap.set(rec.vlan_id, rec);

    const toUpdate = [], results = [];
    for (const iface of monitored) {
      const name = iface.name;
      const txBytes = Number(iface["tx-byte"] || 0), rxBytes = Number(iface["rx-byte"] || 0);
      const exist = existingMap.get(name);
      let txKbps = 0, rxKbps = 0;
      if (exist && exist.last_synced) {
        const secs = (now - new Date(exist.last_synced)) / 1000;
        if (secs > 0) {
          txKbps = Math.max(0, Math.round(((txBytes - (exist.tx_bytes || 0)) * 8) / 1000 / secs));
          rxKbps = Math.max(0, Math.round(((rxBytes - (exist.rx_bytes || 0)) * 8) / 1000 / secs));
        }
      }
      if (exist) toUpdate.push({ id: exist.id, tx_kbps: txKbps, rx_kbps: rxKbps, tx_bytes: txBytes, rx_bytes: rxBytes, last_synced: nowIso });
      results.push({ name, tx_kbps: txKbps, rx_kbps: rxKbps });
    }
    if (toUpdate.length) await prisma.$transaction(toUpdate.map(({ id, ...d }) => prisma.vlanTraffic.update({ where: { id }, data: d })));

    res.json({ success: true, interfaces: results });
  })
);

// ---------------------------------------------------------------------------
// syncRouterNow — full active-session resync for one router
// ---------------------------------------------------------------------------
router.post(
  "/syncRouterNow",
  wrap(async (req, res) => {
    const router_id = req.body?.router_id;
    if (!router_id) return res.status(400).json({ error: "router_id required" });
    const routerRow = await prisma.mikrotikRouter.findUnique({ where: { id: router_id } });
    if (!routerRow) return res.status(404).json({ error: "Router not found" });

    let sessions = [], connected = false, errMsg = null;
    const ros = new ROSClient(routerRow.host, routerRow.api_port || 8728);
    try {
      await ros.connect();
      await ros.login(routerRow.username, routerRow.password || "");
      connected = true;
      const active = await ros.write(["/ppp/active/print"]);
      const ifaceBytes = {};
      try {
        const ifaces = await ros.write(["/interface/print"]);
        for (const iface of ifaces) {
          if (!iface.name) continue;
          const m = iface.name.match(/^<pppoe-(.+)>$/);
          if (m) ifaceBytes[m[1]] = { download: Number(iface["tx-byte"] || 0), upload: Number(iface["rx-byte"] || 0) };
        }
      } catch {}
      sessions = active.map((s) => {
        const bytes = ifaceBytes[s.name] || {};
        return { pppoe_username: s.name, customer_name: s.comment || "", ip_address: s.address, uptime: s.uptime, download_bytes: bytes.download || 0, upload_bytes: bytes.upload || 0, status: "online" };
      });
      ros.close();
    } catch (e) {
      errMsg = e.message;
    }

    const now = new Date().toISOString();
    await prisma.mikrotikRouter.update({ where: { id: router_id }, data: { status: connected ? "online" : "offline", last_synced: now } });
    if (!connected) return res.json({ success: false, error: errMsg || "Could not connect to router" });

    const customers = await prisma.customer.findMany({ take: 500, orderBy: { created_date: "desc" } });
    const custByUser = {};
    for (const c of customers) if (c.pppoe_username) custByUser[c.pppoe_username] = c.id;
    const existingSessions = await prisma.pPPoESession.findMany({ where: { router_id }, take: 500, orderBy: { last_synced: "desc" } });
    const existByUser = {};
    for (const e of existingSessions) if (e.pppoe_username) existByUser[e.pppoe_username] = e;

    const toCreate = [], toUpdate = [];
    for (const session of sessions) {
      if (!session.pppoe_username) continue;
      const customerId = custByUser[session.pppoe_username] || undefined;
      const exist = existByUser[session.pppoe_username];
      let speedDl = 0, speedUl = 0;
      if (exist && exist.last_synced) {
        const secs = (new Date(now) - new Date(exist.last_synced)) / 1000;
        if (secs > 0) {
          speedDl = Math.max(0, Math.round(((session.download_bytes || 0) - (exist.download_bytes || 0)) / 1024 / secs));
          speedUl = Math.max(0, Math.round(((session.upload_bytes || 0) - (exist.upload_bytes || 0)) / 1024 / secs));
        }
      }
      const data = { ...session, download_speed_kbps: speedDl, upload_speed_kbps: speedUl, customer_id: customerId, router_id, router_name: routerRow.name, last_synced: now };
      if (exist) toUpdate.push({ id: exist.id, ...data });
      else toCreate.push(data);
    }
    if (toCreate.length) await prisma.$transaction(toCreate.map((d) => prisma.pPPoESession.create({ data: d })));
    if (toUpdate.length) await prisma.$transaction(toUpdate.map(({ id, ...d }) => prisma.pPPoESession.update({ where: { id }, data: d })));

    res.json({ success: true, router: routerRow.name, sessions: sessions.length, upserted: toCreate.length + toUpdate.length });
  })
);

// ---------------------------------------------------------------------------
// fetchRouterSystemInfo — poll /system/resource for every router
// ---------------------------------------------------------------------------
router.post(
  "/fetchRouterSystemInfo",
  wrap(async (_req, res) => {
    const routers = await prisma.mikrotikRouter.findMany({ take: 50, orderBy: { created_date: "desc" } });
    const results = [];
    for (const routerRow of routers) {
      const info = {
        id: routerRow.id, name: routerRow.name, host: routerRow.host, status: "offline",
        router_version: routerRow.router_version || "", router_uptime: routerRow.router_uptime || "",
        free_memory: routerRow.free_memory || 0, cpu_load: routerRow.cpu_load || 0,
        board_name: routerRow.board_name || "", last_synced: routerRow.last_synced || "",
      };
      const ros = new ROSClient(routerRow.host, routerRow.api_port || 8728);
      try {
        await ros.connect();
        await ros.login(routerRow.username, routerRow.password || "");
        const resource = await ros.write(["/system/resource/print"]);
        if (resource.length > 0) {
          const r = resource[0];
          info.router_version = r.version || "";
          info.router_uptime = r.uptime || "";
          info.free_memory = Number(r["free-memory"] || 0);
          info.cpu_load = Number(r["cpu-load"] || 0);
          info.board_name = r["board-name"] || "";
          info.status = "online";
        }
        ros.close();
        await prisma.mikrotikRouter.update({
          where: { id: routerRow.id },
          data: { status: "online", last_synced: new Date().toISOString(), router_version: info.router_version, router_uptime: info.router_uptime, free_memory: info.free_memory, cpu_load: info.cpu_load, board_name: info.board_name },
        });
      } catch {
        ros.close();
        info.status = "offline";
        await prisma.mikrotikRouter.update({ where: { id: routerRow.id }, data: { status: "offline" } }).catch(() => {});
      }
      results.push(info);
    }
    res.json({ success: true, routers: results });
  })
);

// ---------------------------------------------------------------------------
// checkRouterStatus — mark stale routers offline (admin)
// ---------------------------------------------------------------------------
router.post(
  "/checkRouterStatus",
  requireAdmin,
  wrap(async (_req, res) => {
    const routers = await prisma.mikrotikRouter.findMany({ take: 500 });
    const now = Date.now();
    const STALE_MS = 5 * 60 * 1000;
    let markedOffline = 0;
    for (const r of routers) {
      const last = r.last_synced ? new Date(r.last_synced).getTime() : 0;
      if (now - last > STALE_MS && r.status !== "offline") {
        await prisma.mikrotikRouter.update({ where: { id: r.id }, data: { status: "offline" } });
        markedOffline++;
      }
    }
    res.json({ success: true, total_routers: routers.length, marked_offline: markedOffline, checked_at: new Date().toISOString() });
  })
);

// ---------------------------------------------------------------------------
// Invoicing
// ---------------------------------------------------------------------------
router.post(
  "/generateMonthlyInvoices",
  requireAdmin,
  wrap(async (_req, res) => {
    const now = new Date();
    const dhakaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
    const billingMonth = `${dhakaTime.getFullYear()}-${String(dhakaTime.getMonth() + 1).padStart(2, "0")}`;

    const customers = await prisma.customer.findMany({ take: 1000, orderBy: { created_date: "desc" } });
    const billable = customers.filter((c) => c.status === "active" || c.status === "suspended");
    const packages = await prisma.package.findMany({ take: 200 });
    const pkgMap = new Map(packages.map((p) => [p.id, p]));
    const existingInvoices = await prisma.invoice.findMany({ where: { billing_month: billingMonth }, take: 1000 });
    const existingCustomerIds = new Set(existingInvoices.map((i) => i.customer_id));
    const dueDate = `${dhakaTime.getFullYear()}-${String(dhakaTime.getMonth() + 1).padStart(2, "0")}-10`;

    const toCreate = [], notifications = [];
    for (const customer of billable) {
      if (!customer.package_id || existingCustomerIds.has(customer.id)) continue;
      const pkg = pkgMap.get(customer.package_id);
      if (!pkg) continue;
      toCreate.push({ customer_id: customer.id, customer_name: customer.name, package_name: pkg.name, amount: pkg.monthly_price, due_date: dueDate, billing_month: billingMonth, status: "unpaid" });
      if (customer.email) notifications.push({ to: customer.email, customer_name: customer.name, package_name: pkg.name, amount: pkg.monthly_price, due_date: dueDate, billing_month: billingMonth });
    }

    let createdCount = 0;
    if (toCreate.length) {
      await prisma.$transaction(toCreate.map((d) => prisma.invoice.create({ data: d })));
      createdCount = toCreate.length;
    }

    let notifiedCount = 0;
    for (const n of notifications) {
      const body = `Dear ${n.customer_name},\n\nYour monthly internet bill for ${n.billing_month} has been generated.\n\nPackage: ${n.package_name}\nAmount: ৳${n.amount}\nDue Date: ${n.due_date}\n\nPlease make your payment before the due date to avoid service suspension.\n\nThank you,\nISP Manager`;
      const sent = await sendEmail({ to: n.to, subject: `Monthly Invoice - ${n.billing_month} - ৳${n.amount}`, body });
      if (sent !== false) notifiedCount++;
    }

    res.json({ success: true, billing_month: billingMonth, invoices_generated: createdCount, notifications_sent: notifiedCount, skipped: existingCustomerIds.size });
  })
);

router.post(
  "/generateCustomerInvoices",
  wrap(async (req, res) => {
    const { customer_id } = req.body || {};
    if (!customer_id) return res.status(400).json({ error: "customer_id required" });
    const customer = await prisma.customer.findUnique({ where: { id: customer_id } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (!customer.connection_date) return res.json({ success: true, created: 0, message: "No connection date set" });
    if (!customer.package_id) return res.json({ success: true, created: 0, message: "No package assigned" });
    const pkg = await prisma.package.findUnique({ where: { id: customer.package_id } });
    if (!pkg) return res.json({ success: true, created: 0, message: "Package not found" });

    const monthlyAmount = Math.max(0, (pkg.monthly_price || 0) - (customer.discount || 0) - (customer.package_discount || 0));
    const connDate = new Date(customer.connection_date + "T00:00:00");
    const connDay = connDate.getDate(), connYear = connDate.getFullYear(), connMonth = connDate.getMonth();
    const now = new Date();
    const curYear = now.getFullYear(), curMonth = now.getMonth();

    const existing = await prisma.invoice.findMany({ where: { customer_id: customer.id }, take: 300 });
    const existingMonths = new Set(existing.map((i) => i.billing_month));
    const toCreate = [];

    const connChargeKey = `CONN-${connYear}-${String(connMonth + 1).padStart(2, "0")}`;
    if (!customer.free_connection && (customer.connection_charge || 0) > 0 && !existingMonths.has(connChargeKey)) {
      toCreate.push({ customer_id: customer.id, customer_name: customer.name, package_name: "Connection Charge", amount: customer.connection_charge, due_date: customer.connection_date, billing_month: connChargeKey, status: "unpaid" });
    }

    let y = connYear, m = connMonth;
    while (y < curYear || (y === curYear && m <= curMonth)) {
      const billingMonth = `${y}-${String(m + 1).padStart(2, "0")}`;
      if (!existingMonths.has(billingMonth)) {
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const dueDay = Math.min(connDay, daysInMonth);
        const dueDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
        toCreate.push({ customer_id: customer.id, customer_name: customer.name, package_name: pkg.name, amount: monthlyAmount, due_date: dueDate, billing_month: billingMonth, status: "unpaid" });
      }
      m++;
      if (m > 11) { m = 0; y++; }
    }

    if (toCreate.length) await prisma.$transaction(toCreate.map((d) => prisma.invoice.create({ data: d })));
    res.json({ success: true, created: toCreate.length });
  })
);

router.post(
  "/notifyOverdueInvoices",
  requireAdmin,
  wrap(async (_req, res) => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const overdueInvoices = await prisma.invoice.findMany({ where: { status: "overdue" }, take: 1000 });
    const overdue3d = overdueInvoices.filter((inv) => inv.due_date && new Date(inv.due_date) < threeDaysAgo);
    const customers = await prisma.customer.findMany({ take: 1000 });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    let notifiedCount = 0;
    for (const inv of overdue3d) {
      const customer = customerMap.get(inv.customer_id);
      if (!customer || !customer.email) continue;
      const body = `Dear ${customer.name},\n\nThis is a reminder that your internet bill is overdue.\n\nInvoice Month: ${inv.billing_month}\nAmount Due: ৳${inv.amount}\nDue Date: ${inv.due_date}\n\nYour service may be suspended if payment is not made soon.\n\nThank you,\nISP Manager`;
      const sent = await sendEmail({ to: customer.email, subject: `Overdue Payment Reminder - ৳${inv.amount}`, body });
      if (sent !== false) notifiedCount++;
    }
    res.json({ success: true, overdue_total: overdueInvoices.length, overdue_more_than_3_days: overdue3d.length, notifications_sent: notifiedCount });
  })
);

// ---------------------------------------------------------------------------
// Payments / portal
// ---------------------------------------------------------------------------
function requestOrigin(req) {
  return req.headers.origin || `${req.protocol}://${req.get("host")}`;
}

router.post(
  "/getPortalData",
  wrap(async (req, res) => {
    const customer = await prisma.customer.findFirst({ where: { email: req.user.email } });
    if (!customer) return res.status(404).json({ error: "no_customer", message: "No customer account is linked to your email. Please contact support." });
    const invoices = await prisma.invoice.findMany({ where: { customer_id: customer.id } });
    const currentPackage = customer.package_id ? await prisma.package.findUnique({ where: { id: customer.package_id } }) : null;
    const packages = await prisma.package.findMany({ where: { is_active: true } });
    res.json({ customer, currentPackage, invoices, packages, user: { full_name: req.user.full_name, email: req.user.email } });
  })
);

router.post(
  "/createCheckout",
  wrap(async (req, res) => {
    const { type, invoice_id, package_id } = req.body || {};
    const customer = await prisma.customer.findFirst({ where: { email: req.user.email } });
    if (!customer) return res.status(404).json({ error: "No customer account linked to your email" });

    let amount = 0, description = "";
    if (type === "bill") {
      if (!invoice_id) return res.status(400).json({ error: "Invoice ID required" });
      const invoice = await prisma.invoice.findUnique({ where: { id: invoice_id } });
      if (!invoice || invoice.customer_id !== customer.id) return res.status(404).json({ error: "Invoice not found" });
      if (invoice.status === "paid") return res.status(400).json({ error: "Invoice already paid" });
      amount = invoice.amount;
      description = `Bill Payment - ${invoice.billing_month || invoice.package_name || "Invoice"}`;
    } else if (type === "upgrade") {
      if (!package_id) return res.status(400).json({ error: "Package ID required" });
      const pkg = await prisma.package.findUnique({ where: { id: package_id } });
      if (!pkg) return res.status(404).json({ error: "Package not found" });
      if (customer.package_id === package_id) return res.status(400).json({ error: "You are already on this package" });
      amount = pkg.monthly_price;
      description = `Package Upgrade - ${pkg.name} (${pkg.speed_mbps}Mbps)`;
    } else {
      return res.status(400).json({ error: "Invalid payment type" });
    }

    try {
      const result = await startCheckout({ type, invoiceId: invoice_id, packageId: package_id, customerId: customer.id, amount, description, origin: requestOrigin(req), clientIp: req.ip });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  })
);

router.post(
  "/confirmPayment",
  wrap(async (req, res) => {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });
    const intent = await prisma.paymentIntent.findUnique({ where: { id: session_id } });
    if (!intent) return res.status(404).json({ error: "Payment session not found" });
    const customer = await prisma.customer.findFirst({ where: { email: req.user.email } });
    if (!customer || intent.customer_id !== customer.id) return res.status(403).json({ error: "Customer verification failed" });

    if (intent.status === "pending") return res.status(400).json({ error: "Payment not completed yet", payment_status: "pending" });
    if (intent.status === "failed" || intent.status === "cancelled") return res.status(400).json({ error: "Payment not completed", payment_status: intent.status });

    res.json({ success: true, already_processed: true, type: intent.type, amount: intent.amount });
  })
);

router.post(
  "/adminPayInvoice",
  requireAdmin,
  wrap(async (req, res) => {
    const { invoice_id } = req.body || {};
    if (!invoice_id) return res.status(400).json({ error: "Invoice ID required" });
    const invoice = await prisma.invoice.findUnique({ where: { id: invoice_id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status === "paid") return res.status(400).json({ error: "Invoice already paid" });
    const description = `Invoice - ${invoice.billing_month || invoice.package_name || invoice.customer_name || "Bill"}`;
    try {
      const result = await startCheckout({ type: "admin_bill", invoiceId: invoice_id, customerId: invoice.customer_id, amount: invoice.amount, description, origin: requestOrigin(req), clientIp: req.ip });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  })
);

router.post(
  "/adminConfirmPayment",
  requireAdmin,
  wrap(async (req, res) => {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });
    const intent = await prisma.paymentIntent.findUnique({ where: { id: session_id } });
    if (!intent) return res.status(404).json({ error: "Payment session not found" });
    if (intent.status === "pending") return res.status(400).json({ error: "Payment not completed", payment_status: "pending" });
    res.json({ success: true, amount: intent.amount });
  })
);

// ---------------------------------------------------------------------------
// Bandwidth logging (admin, cron-shaped)
// ---------------------------------------------------------------------------
router.post(
  "/logBandwidth",
  requireAdmin,
  wrap(async (_req, res) => {
    const sessions = await prisma.pPPoESession.findMany({ take: 1000, orderBy: { last_synced: "desc" } });
    const online = sessions.filter((s) => s.status === "online");
    const byRouter = new Map();
    for (const s of online) {
      const key = s.router_id || "unknown";
      if (!byRouter.has(key)) byRouter.set(key, { router_id: s.router_id || "", router_name: s.router_name || "Unknown", total_download_kbps: 0, total_upload_kbps: 0, active_sessions: 0 });
      const e = byRouter.get(key);
      e.total_download_kbps += s.download_speed_kbps || 0;
      e.total_upload_kbps += s.upload_speed_kbps || 0;
      e.active_sessions += 1;
    }
    const today = new Date().toISOString().split("T")[0];
    const existing = await prisma.bandwidthLog.findMany({ where: { log_date: today }, take: 100 });
    if (existing.length > 0) {
      const existingByRouter = new Map(existing.map((l) => [l.router_id || "unknown", l]));
      for (const [key, entry] of byRouter) {
        if (existingByRouter.has(key)) await prisma.bandwidthLog.update({ where: { id: existingByRouter.get(key).id }, data: entry });
        else await prisma.bandwidthLog.create({ data: { log_date: today, ...entry } });
      }
    } else {
      const logs = Array.from(byRouter.values()).map((e) => ({ log_date: today, ...e }));
      if (logs.length) await prisma.$transaction(logs.map((d) => prisma.bandwidthLog.create({ data: d })));
      else await prisma.bandwidthLog.create({ data: { log_date: today, router_id: "", router_name: "All Routers", total_download_kbps: 0, total_upload_kbps: 0, active_sessions: 0 } });
    }
    res.json({ success: true, date: today, routers_logged: byRouter.size });
  })
);

router.post(
  "/logCustomerBandwidth",
  requireAdmin,
  wrap(async (_req, res) => {
    const sessions = await prisma.pPPoESession.findMany({ take: 2000, orderBy: { last_synced: "desc" } });
    const online = sessions.filter((s) => s.status === "online" && s.customer_id);
    const today = new Date().toISOString().split("T")[0];
    const kbpsToGB = (kbps) => ((kbps || 0) * 1000) / 8 * 86400 / 1e9;
    const existing = await prisma.customerBandwidthLog.findMany({ where: { log_date: today }, take: 500 });
    const existingByCustomer = new Map(existing.map((l) => [l.customer_id, l]));
    let created = 0, updated = 0;
    for (const s of online) {
      const entry = { customer_id: s.customer_id, log_date: today, avg_download_kbps: s.download_speed_kbps || 0, avg_upload_kbps: s.upload_speed_kbps || 0, download_gb: kbpsToGB(s.download_speed_kbps), upload_gb: kbpsToGB(s.upload_speed_kbps) };
      const prev = existingByCustomer.get(s.customer_id);
      if (prev) { await prisma.customerBandwidthLog.update({ where: { id: prev.id }, data: entry }); updated++; }
      else { await prisma.customerBandwidthLog.create({ data: entry }); created++; }
    }
    res.json({ success: true, date: today, sessions_logged: online.length, created, updated });
  })
);

export default router;
