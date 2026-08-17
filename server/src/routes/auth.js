import { Router } from "express";
import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db.js";
import { signToken, hashPassword, comparePassword, requireAuth } from "../lib/auth.js";
import { sendEmail } from "../lib/email.js";

const router = Router();
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

router.get("/me", requireAuth, (req, res) => {
  const { password_hash, otp_code, reset_token, ...safe } = req.user;
  res.json(safe);
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password_hash || !(await comparePassword(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(user);
  res.json({
    access_token: token,
    must_change_password: user.must_change_password,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, must_change_password: user.must_change_password },
  });
});

// Google Sign-In only logs in an EXISTING account — accounts are invite-only (created by a
// super admin from the Users page), so a Google login with no matching email is rejected
// rather than auto-creating one.
router.post("/google", async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "Missing Google credential" });
  if (!googleClient) return res.status(500).json({ error: "Google sign-in isn't configured on this server" });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Invalid Google credential" });
  }
  if (!payload?.email) return res.status(401).json({ error: "Google account has no email" });

  let user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (!user) {
    return res.status(403).json({ error: "No account found for this email. Ask your administrator to create one for you." });
  }
  if (!user.google_id) {
    user = await prisma.user.update({ where: { id: user.id }, data: { google_id: payload.sub } });
  }

  const token = signToken(user);
  res.json({
    access_token: token,
    must_change_password: user.must_change_password,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, must_change_password: user.must_change_password },
  });
});

// Forces the temporary/one-time password set by an admin to be replaced before the account
// can be used normally. Frontend redirects here whenever must_change_password is true.
router.post("/change-password", requireAuth, async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
  await prisma.user.update({
    where: { id: req.user.id },
    data: { password_hash: await hashPassword(newPassword), must_change_password: false },
  });
  res.json({ success: true });
});

router.post("/forgot-password", async (req, res) => {
  const email = typeof req.body === "string" ? req.body : req.body?.email;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ success: true }); // always report success (anti-enumeration)
  const reset_token = randomToken();
  const reset_token_expires = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { reset_token, reset_token_expires } });
  const resetUrl = `${req.headers.origin || ""}/reset-password?token=${reset_token}`;
  const sent = await sendEmail({ to: email, subject: "Reset your NetScale password", body: `Reset your password: ${resetUrl}` });
  res.json({ success: true, ...(sent ? {} : { dev_reset_url: resetUrl }) });
});

router.post("/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !newPassword) return res.status(400).json({ error: "Missing token or new password" });
  const user = await prisma.user.findFirst({ where: { reset_token: resetToken } });
  if (!user || !user.reset_token_expires || user.reset_token_expires < new Date()) {
    return res.status(400).json({ error: "Reset link is invalid or has expired" });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash: await hashPassword(newPassword), reset_token: null, reset_token_expires: null },
  });
  res.json({ success: true });
});

export default router;
