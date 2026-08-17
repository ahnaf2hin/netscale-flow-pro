import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { requireAdmin, hashPassword, defaultPermissionsForRole, ALL_FEATURES } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin); // every route here is super_admin only

const VALID_ROLES = ["super_admin", "staff", "reseller", "customer"];
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars
function randomPassword() {
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, (b) => CHARSET[b % CHARSET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

function safeUser(u) {
  const { password_hash, otp_code, reset_token, ...safe } = u;
  return safe;
}

router.get("/features", (_req, res) => res.json({ features: ALL_FEATURES }));

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { created_date: "desc" } });
  res.json(users.map(safeUser));
});

router.post("/", async (req, res) => {
  try {
    const { email, full_name, role, permissions, staff_id, reseller_id } = req.body || {};
    if (!email || !role) return res.status(400).json({ error: "Email and role are required" });
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "An account with this email already exists" });

    const tempPassword = randomPassword();
    const user = await prisma.user.create({
      data: {
        email,
        full_name: full_name || "",
        role,
        permissions: permissions ?? defaultPermissionsForRole(role),
        staff_id: role === "staff" ? staff_id || null : null,
        reseller_id: role === "reseller" ? reseller_id || null : null,
        password_hash: await hashPassword(tempPassword),
        must_change_password: true,
      },
    });

    if (role === "reseller" && reseller_id) {
      await prisma.reseller.update({ where: { id: reseller_id }, data: { user_id: user.id } }).catch(() => {});
    }
    if (role === "staff" && staff_id) {
      await prisma.staff.update({ where: { id: staff_id }, data: { user_id: user.id } }).catch(() => {});
    }

    res.json({ user: safeUser(user), temp_password: tempPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { full_name, role, permissions, staff_id, reseller_id } = req.body || {};
    if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
    const data = {};
    if (full_name !== undefined) data.full_name = full_name;
    if (role !== undefined) data.role = role;
    if (permissions !== undefined) data.permissions = permissions;
    if (staff_id !== undefined) data.staff_id = staff_id || null;
    if (reseller_id !== undefined) data.reseller_id = reseller_id || null;
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json(safeUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/reset-password", async (req, res) => {
  try {
    const tempPassword = randomPassword();
    await prisma.user.update({
      where: { id: req.params.id },
      data: { password_hash: await hashPassword(tempPassword), must_change_password: true },
    });
    res.json({ temp_password: tempPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete your own account" });
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
