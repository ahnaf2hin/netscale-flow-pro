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

    const linkStaffId = role === "staff" ? staff_id || null : null;
    const linkResellerId = role === "reseller" ? reseller_id || null : null;
    if (linkStaffId) {
      const staff = await prisma.staff.findUnique({ where: { id: linkStaffId } });
      if (!staff) return res.status(400).json({ error: "Staff record not found" });
      if (staff.user_id) return res.status(409).json({ error: "This staff record is already linked to another login" });
    }
    if (linkResellerId) {
      const reseller = await prisma.reseller.findUnique({ where: { id: linkResellerId } });
      if (!reseller) return res.status(400).json({ error: "Reseller record not found" });
      if (reseller.user_id) return res.status(409).json({ error: "This reseller record is already linked to another login" });
    }

    const tempPassword = randomPassword();
    const user = await prisma.user.create({
      data: {
        email,
        full_name: full_name || "",
        role,
        permissions: permissions ?? defaultPermissionsForRole(role),
        staff_id: linkStaffId,
        reseller_id: linkResellerId,
        password_hash: await hashPassword(tempPassword),
        must_change_password: true,
      },
    });

    if (linkResellerId) {
      await prisma.reseller.update({ where: { id: linkResellerId }, data: { user_id: user.id } });
    }
    if (linkStaffId) {
      await prisma.staff.update({ where: { id: linkStaffId }, data: { user_id: user.id } });
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

    const current = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "User not found" });

    // The resulting link is only kept if the *resulting* role still needs it — this is what
    // clears staff_id/reseller_id automatically when an admin changes a user's role away from
    // staff/reseller, instead of leaving a stale link to a record this account no longer maps to.
    const nextRole = role !== undefined ? role : current.role;
    const nextStaffId = nextRole === "staff" ? (staff_id !== undefined ? staff_id || null : current.staff_id) : null;
    const nextResellerId =
      nextRole === "reseller" ? (reseller_id !== undefined ? reseller_id || null : current.reseller_id) : null;

    if (nextStaffId && nextStaffId !== current.staff_id) {
      const staff = await prisma.staff.findUnique({ where: { id: nextStaffId } });
      if (!staff) return res.status(400).json({ error: "Staff record not found" });
      if (staff.user_id && staff.user_id !== current.id) {
        return res.status(409).json({ error: "This staff record is already linked to another login" });
      }
    }
    if (nextResellerId && nextResellerId !== current.reseller_id) {
      const reseller = await prisma.reseller.findUnique({ where: { id: nextResellerId } });
      if (!reseller) return res.status(400).json({ error: "Reseller record not found" });
      if (reseller.user_id && reseller.user_id !== current.id) {
        return res.status(409).json({ error: "This reseller record is already linked to another login" });
      }
    }

    const data = {};
    if (full_name !== undefined) data.full_name = full_name;
    if (role !== undefined) data.role = role;
    if (permissions !== undefined) data.permissions = permissions;
    data.staff_id = nextStaffId;
    data.reseller_id = nextResellerId;

    const user = await prisma.user.update({ where: { id: req.params.id }, data });

    // Keep the reverse links (Staff.user_id / Reseller.user_id) in sync with the change above.
    if (current.staff_id && current.staff_id !== nextStaffId) {
      await prisma.staff.updateMany({ where: { id: current.staff_id, user_id: current.id }, data: { user_id: null } });
    }
    if (nextStaffId && nextStaffId !== current.staff_id) {
      await prisma.staff.update({ where: { id: nextStaffId }, data: { user_id: user.id } });
    }
    if (current.reseller_id && current.reseller_id !== nextResellerId) {
      await prisma.reseller.updateMany({
        where: { id: current.reseller_id, user_id: current.id },
        data: { user_id: null },
      });
    }
    if (nextResellerId && nextResellerId !== current.reseller_id) {
      await prisma.reseller.update({ where: { id: nextResellerId }, data: { user_id: user.id } });
    }

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
