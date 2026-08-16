import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../lib/auth.js";

// Map of Base44 entity name -> Prisma model delegate name (camelCase).
const ENTITY_MODELS = {
  Customer: "customer",
  Invoice: "invoice",
  Payment: "payment",
  Package: "package",
  PaymentGateway: "paymentGateway",
  SmsProvider: "smsProvider",
  SMSMessage: "sMSMessage",
  MapSetting: "mapSetting",
  MikrotikRouter: "mikrotikRouter",
  PPPoESession: "pPPoESession",
  PPPoEProfile: "pPPoEProfile",
  CommandQueue: "commandQueue",
  BandwidthLog: "bandwidthLog",
  CustomerBandwidthLog: "customerBandwidthLog",
  VlanTraffic: "vlanTraffic",
  OLTDevice: "oLTDevice",
  ONU: "oNU",
  NetworkDevice: "networkDevice",
  CableRoute: "cableRoute",
  Office: "office",
  Zone: "zone",
  Staff: "staff",
  WorkReport: "workReport",
  Reseller: "reseller",
  SupportTicket: "supportTicket",
  SupportCategory: "supportCategory",
  SignupRequest: "signupRequest",
  AccountingTransaction: "accountingTransaction",
  HotspotUser: "hotspotUser",
  HotspotProfile: "hotspotProfile",
  HotspotVoucher: "hotspotVoucher",
};

// These entities are safe to read without auth (used by the public /portal landing page).
const PUBLIC_READ_ENTITIES = new Set(["Package"]);

function parseSort(sortStr) {
  if (!sortStr) return undefined;
  const desc = sortStr.startsWith("-");
  const field = desc ? sortStr.slice(1) : sortStr;
  return { [field]: desc ? "desc" : "asc" };
}

function parseFilter(filterStr) {
  if (!filterStr) return {};
  try {
    const obj = JSON.parse(filterStr);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function modelFor(entityName) {
  const key = ENTITY_MODELS[entityName];
  return key ? prisma[key] : null;
}

const router = Router();

router.use((req, res, next) => {
  const entity = req.params.entity;
  if (req.method === "GET" && PUBLIC_READ_ENTITIES.has(entity)) return next();
  return requireAuth(req, res, next);
});

router.get("/:entity", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  try {
    const where = parseFilter(req.query.filter);
    const orderBy = parseSort(req.query.sort);
    const take = req.query.limit ? Number(req.query.limit) : undefined;
    const rows = await model.findMany({ where, orderBy, take });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:entity/:id", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  try {
    const row = await model.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:entity", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  try {
    const row = await model.create({ data: req.body });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:entity/bulk-create", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  const records = Array.isArray(req.body) ? req.body : [];
  try {
    const created = await prisma.$transaction(records.map((r) => model.create({ data: r })));
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:entity/bulk-update", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  const records = Array.isArray(req.body) ? req.body : [];
  try {
    const updated = await prisma.$transaction(
      records.map(({ id, ...data }) => model.update({ where: { id }, data }))
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:entity/:id", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  try {
    const row = await model.update({ where: { id: req.params.id }, data: req.body });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:entity/:id", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  try {
    await model.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
