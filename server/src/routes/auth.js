import { Router } from "express";
import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db.js";
import { signToken, hashPassword, comparePassword, requireAuth } from "../lib/auth.js";
import { sendEmail } from "../lib/email.js";

const router = Router();
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
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
  res.json({ access_token: token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
});

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
    user = await prisma.user.create({
      data: { email: payload.email, full_name: payload.name || "", google_id: payload.sub },
    });
  } else if (!user.google_id) {
    user = await prisma.user.update({ where: { id: user.id }, data: { google_id: payload.sub } });
  }

  const token = signToken(user);
  res.json({ access_token: token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
});

router.post("/register", async (req, res) => {
  const { email, password, full_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const otp_code = randomOtp();
  const otp_expires = new Date(Date.now() + 10 * 60 * 1000);
  const user = await prisma.user.create({
    data: { email, password_hash: await hashPassword(password), full_name: full_name || "", otp_code, otp_expires },
  });

  const sent = await sendEmail({
    to: email,
    subject: "Verify your NetScale account",
    body: `Your verification code is ${otp_code}. It expires in 10 minutes.`,
  });

  res.json({ success: true, ...(sent ? {} : { dev_otp: otp_code }) });
});

router.post("/verify-otp", async (req, res) => {
  const { email, otpCode } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.otp_code) return res.status(400).json({ error: "No pending verification for this email" });
  if (user.otp_expires && user.otp_expires < new Date()) return res.status(400).json({ error: "Code expired, please resend" });
  if (user.otp_code !== otpCode) return res.status(400).json({ error: "Invalid code" });

  await prisma.user.update({ where: { id: user.id }, data: { otp_code: null, otp_expires: null } });
  const token = signToken(user);
  res.json({ access_token: token });
});

router.post("/resend-otp", async (req, res) => {
  const email = typeof req.body === "string" ? req.body : req.body?.email;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ success: true }); // anti-enumeration
  const otp_code = randomOtp();
  const otp_expires = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { otp_code, otp_expires } });
  const sent = await sendEmail({ to: email, subject: "Your new verification code", body: `Your verification code is ${otp_code}.` });
  res.json({ success: true, ...(sent ? {} : { dev_otp: otp_code }) });
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
