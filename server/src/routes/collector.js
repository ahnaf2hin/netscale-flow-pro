import { Router } from "express";
import { prisma } from "../db.js";
import { requireCollectorKey } from "../lib/auth.js";

const router = Router();
router.use(requireCollectorKey);

// Returns MikroTik router credentials to the on-prem collector agent.
router.get("/routers", async (_req, res) => {
  const routers = await prisma.mikrotikRouter.findMany({ take: 500 });
  res.json({
    routers: routers.map((r) => ({
      id: r.id, name: r.name, host: r.host, api_port: r.api_port || 8728,
      username: r.username, password: r.password,
      snmp_community: r.snmp_community || "public", snmp_port: r.snmp_port || 161,
    })),
  });
});

// Ingests SNMP-polled PPPoE session + VLAN telemetry pushed by the collector.
router.post("/sync-mikrotik", async (req, res) => {
  try {
    const { router_id, router_name, sessions, vlans, system_info } = req.body || {};
    if (!router_id || !Array.isArray(sessions)) return res.status(400).json({ error: "Missing router_id or sessions array" });

    const now = new Date().toISOString();
    const results = [];

    await prisma.mikrotikRouter
      .update({ where: { id: router_id }, data: { status: "online", last_synced: now, ...(system_info || {}) } })
      .catch(() => {});

    for (const session of sessions) {
      const { pppoe_username, customer_id, customer_name, ip_address, download_bytes, upload_bytes, uptime, status } = session;
      if (!pppoe_username) continue;

      const existing = await prisma.pPPoESession.findMany({ where: { pppoe_username, router_id }, take: 1, orderBy: { last_synced: "desc" } });
      const prevDl = existing[0]?.download_bytes || 0;
      const prevUl = existing[0]?.upload_bytes || 0;
      const prevSynced = existing[0]?.last_synced ? new Date(existing[0].last_synced).getTime() : Date.now();
      const secs = (Date.now() - prevSynced) / 1000;
      const speedDl = secs > 0 ? Math.max(0, Math.round(((download_bytes || 0) - prevDl) / 1024 / secs)) : 0;
      const speedUl = secs > 0 ? Math.max(0, Math.round(((upload_bytes || 0) - prevUl) / 1024 / secs)) : 0;

      const data = {
        customer_id: customer_id || "", customer_name: customer_name || "", router_id, router_name: router_name || "",
        pppoe_username, ip_address: ip_address || "", download_bytes: download_bytes || 0, upload_bytes: upload_bytes || 0,
        download_speed_kbps: speedDl, upload_speed_kbps: speedUl, uptime: uptime || "", status: status || "offline", last_synced: now,
      };

      if (existing.length > 0) {
        await prisma.pPPoESession.update({ where: { id: existing[0].id }, data });
        results.push({ pppoe_username, action: "updated" });
      } else {
        await prisma.pPPoESession.create({ data });
        results.push({ pppoe_username, action: "created" });
      }
    }

    if (Array.isArray(vlans)) {
      for (const vlan of vlans) {
        const { vlan_id, vlan_name, tx_kbps, rx_kbps } = vlan;
        if (!vlan_id) continue;
        const existingV = await prisma.vlanTraffic.findMany({ where: { router_id, vlan_id }, take: 1, orderBy: { last_synced: "desc" } });
        const vData = { router_id, router_name: router_name || "", vlan_id, vlan_name: vlan_name || "", tx_kbps: tx_kbps || 0, rx_kbps: rx_kbps || 0, last_synced: now };
        if (existingV.length > 0) await prisma.vlanTraffic.update({ where: { id: existingV[0].id }, data: vData });
        else await prisma.vlanTraffic.create({ data: vData });
      }
    }

    const pendingCommands = await prisma.commandQueue.findMany({ where: { router_id, status: "pending" }, take: 50 });
    res.json({ success: true, synced: results.length, results, pending_commands: pendingCommands });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ingests SNMP-polled ONU optical telemetry pushed by the collector.
router.post("/sync-olt", async (req, res) => {
  try {
    const { olt_id, olt_name, onus } = req.body || {};
    if (!olt_id || !Array.isArray(onus)) return res.status(400).json({ error: "Missing olt_id or onus array" });
    const now = new Date().toISOString();
    const results = [];
    for (const onu of onus) {
      const { serial_number, pon_port, customer_id, customer_name, rx_power_dbm, tx_power_dbm, status } = onu;
      if (!serial_number) continue;
      const existing = await prisma.oNU.findMany({ where: { serial_number, olt_id }, take: 1, orderBy: { last_synced: "desc" } });
      const data = { olt_id, olt_name: olt_name || "", pon_port: pon_port || "", serial_number, customer_id: customer_id || "", customer_name: customer_name || "", rx_power_dbm: rx_power_dbm ?? null, tx_power_dbm: tx_power_dbm ?? null, status: status || "offline", last_synced: now };
      if (existing.length > 0) { await prisma.oNU.update({ where: { id: existing[0].id }, data }); results.push({ serial_number, action: "updated" }); }
      else { await prisma.oNU.create({ data }); results.push({ serial_number, action: "created" }); }
    }
    res.json({ success: true, synced: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
