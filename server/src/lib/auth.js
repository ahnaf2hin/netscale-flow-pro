import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = "30d";

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

// Attaches req.user (or leaves it undefined) — never rejects.
export function attachUser(prisma) {
  return async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) return next();
    const payload = verifyToken(token);
    if (!payload) return next();
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user) req.user = user;
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== "super_admin") return res.status(403).json({ error: "Super admin access required" });
  next();
}

// Feature keys used both for backend permission checks and to filter the sidebar nav
// client-side. super_admin always passes regardless of the `permissions` JSON blob.
export const ALL_FEATURES = [
  "customers", "billing", "hotspot", "mikrotik", "olt", "network",
  "resellers", "staff", "support", "sms", "accounting", "reports", "configuration",
];

// Applied to a user's `permissions` column when an admin creates the account with this
// role and doesn't customize it — after creation, each flag is editable per-user.
export function defaultPermissionsForRole(role) {
  if (role === "staff") return Object.fromEntries(ALL_FEATURES.map((f) => [f, true]));
  if (role === "reseller") return { customers: true, billing: true, support: true };
  return {}; // customer (and any unrecognized role) starts with no generic-API access
}

// Hard ceiling on what a reseller can ever be granted, independent of the `permissions` JSON
// an admin sets via the Users & Roles UI. Reseller data access is row-scoped per-customer
// (see scopeWhere/assertResellerCanWrite in entities.js) only for these entities/features —
// granting a reseller e.g. "mikrotik" or "resellers" would otherwise hand them unscoped,
// system-wide access to every router or every other reseller's data, since no row-level
// scoping exists for those tables. Enforced here (not just in the UI) so it holds even if a
// super_admin mis-sets a reseller's permissions JSON directly via the API.
const RESELLER_ALLOWED_FEATURES = new Set(["customers", "billing", "support"]);

export function hasPermission(user, feature) {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.role === "customer") return false; // customers only use the dedicated portal endpoints
  if (user.role === "reseller" && !RESELLER_ALLOWED_FEATURES.has(feature)) return false;
  const perms = user.permissions || {};
  return perms[feature] === true;
}

export function requirePermission(feature) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!hasPermission(req.user, feature)) return res.status(403).json({ error: "You don't have access to this feature" });
    next();
  };
}

export function requireCollectorKey(req, res, next) {
  const expected = process.env.COLLECTOR_API_KEY;
  const provided = req.headers["x-api-key"] || req.body?.api_key;
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
