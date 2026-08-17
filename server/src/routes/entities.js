import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, hasPermission } from "../lib/auth.js";

// Map of entity name -> Prisma model delegate name (camelCase).
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
  OnuOpticalLog: "onuOpticalLog",
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

// Which permission flag (see server/src/lib/auth.js) gates each entity. Entities not
// listed here (e.g. AppSetting) fall back to "configuration".
const ENTITY_FEATURE = {
  Customer: "customers", SignupRequest: "customers", CustomerBandwidthLog: "customers",
  Invoice: "billing", Payment: "billing", PaymentGateway: "billing", Package: "billing",
  HotspotUser: "hotspot", HotspotProfile: "hotspot", HotspotVoucher: "hotspot",
  MikrotikRouter: "mikrotik", PPPoESession: "mikrotik", PPPoEProfile: "mikrotik",
  CommandQueue: "mikrotik", BandwidthLog: "mikrotik", VlanTraffic: "mikrotik",
  OLTDevice: "olt", ONU: "olt", OnuOpticalLog: "olt",
  NetworkDevice: "network", CableRoute: "network",
  Reseller: "resellers",
  Staff: "staff", WorkReport: "staff",
  SupportTicket: "support", SupportCategory: "support",
  SMSMessage: "sms", SmsProvider: "sms",
  AccountingTransaction: "accounting",
};
function featureFor(entity) {
  return ENTITY_FEATURE[entity] || "configuration";
}

// Entities a reseller's results get scoped to (their own customers only). Any entity not
// listed here is simply denied to resellers via their default permissions (see auth.js).
const RESELLER_SCOPED_ENTITIES = new Set(["Customer", "Invoice", "Payment", "SupportTicket"]);

async function resellerCustomerIds(resellerId) {
  const rows = await prisma.customer.findMany({ where: { reseller_id: resellerId }, select: { id: true } });
  return rows.map((r) => r.id);
}

// Merges reseller row-level scoping into a where-clause. No-op for every other role
// (including the public/unauthenticated Package read, where `user` is undefined).
async function scopeWhere(user, entity, where) {
  if (user?.role !== "reseller" || !RESELLER_SCOPED_ENTITIES.has(entity)) return where;
  if (entity === "Customer") return { ...where, reseller_id: user.reseller_id };
  const ids = await resellerCustomerIds(user.reseller_id);
  return { ...where, customer_id: { in: ids } };
}

// Throws (via thrown Response-shaped error) if a reseller is trying to write a record
// outside their own customers. Call before create/update/delete on a scoped entity.
async function assertResellerCanWrite(user, entity, data, existingId) {
  if (user?.role !== "reseller" || !RESELLER_SCOPED_ENTITIES.has(entity)) return;
  if (entity === "Customer") {
    if (existingId) {
      const existing = await prisma.customer.findUnique({ where: { id: existingId }, select: { reseller_id: true } });
      if (!existing || existing.reseller_id !== user.reseller_id) throw { status: 403, message: "Not your customer" };
    }
    return;
  }
  const customerId = existingId ? undefined : data.customer_id;
  if (existingId) {
    const model = modelFor(entity);
    const existing = await model.findUnique({ where: { id: existingId }, select: { customer_id: true } });
    if (!existing) throw { status: 404, message: "Not found" };
    const ids = await resellerCustomerIds(user.reseller_id);
    if (!ids.includes(existing.customer_id)) throw { status: 403, message: "Not your customer's record" };
  } else if (customerId) {
    const ids = await resellerCustomerIds(user.reseller_id);
    if (!ids.includes(customerId)) throw { status: 403, message: "Not your customer" };
  }
}

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

// These entities are safe to read without auth (used by the public /portal landing page).
const PUBLIC_READ_ENTITIES = new Set(["Package"]);

// IMPORTANT: these are mounted with the "/:entity" path (not a bare router.use(fn)) so that
// req.params.entity is actually populated here — a path-less router.use() runs before Express
// matches any route pattern, so req.params would be empty and every check below would
// silently no-op (which is exactly what happened here originally: the permission gate below
// never read a real entity name, so it never denied anything).
router.use("/:entity", (req, res, next) => {
  const entity = req.params.entity;
  if (req.method === "GET" && PUBLIC_READ_ENTITIES.has(entity)) return next();
  return requireAuth(req, res, next);
});

// Customers never use the generic entity API — they only have the dedicated portal
// endpoints (see functions.js), which already scope everything to their own record.
router.use("/:entity", (req, res, next) => {
  if (req.params.entity && PUBLIC_READ_ENTITIES.has(req.params.entity) && req.method === "GET") return next();
  if (req.user?.role === "customer") return res.status(403).json({ error: "Not available for customer accounts" });
  const entity = req.params.entity;
  if (entity && !hasPermission(req.user, featureFor(entity))) {
    return res.status(403).json({ error: "You don't have access to this feature" });
  }
  next();
});

router.get("/:entity", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  try {
    let where = parseFilter(req.query.filter);
    where = await scopeWhere(req.user, req.params.entity, where);
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
    if (req.user?.role === "reseller" && RESELLER_SCOPED_ENTITIES.has(req.params.entity)) {
      const scoped = await scopeWhere(req.user, req.params.entity, { id: req.params.id });
      const allowed = await model.findFirst({ where: scoped, select: { id: true } });
      if (!allowed) return res.status(403).json({ error: "Not your record" });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:entity", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  try {
    const data = { ...req.body };
    if (req.user.role === "reseller" && req.params.entity === "Customer") data.reseller_id = req.user.reseller_id;
    await assertResellerCanWrite(req.user, req.params.entity, data);
    const row = await model.create({ data });
    res.json(row);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post("/:entity/bulk-create", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  if (req.user.role === "reseller") return res.status(403).json({ error: "Not available for reseller accounts" });
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
  if (req.user.role === "reseller") return res.status(403).json({ error: "Not available for reseller accounts" });
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
    await assertResellerCanWrite(req.user, req.params.entity, req.body, req.params.id);
    const row = await model.update({ where: { id: req.params.id }, data: req.body });
    res.json(row);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:entity/:id", async (req, res) => {
  const model = modelFor(req.params.entity);
  if (!model) return res.status(404).json({ error: "Unknown entity" });
  try {
    await assertResellerCanWrite(req.user, req.params.entity, {}, req.params.id);
    await model.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
