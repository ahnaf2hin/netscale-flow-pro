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
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

export function requireCollectorKey(req, res, next) {
  const expected = process.env.COLLECTOR_API_KEY;
  const provided = req.headers["x-api-key"] || req.body?.api_key;
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
