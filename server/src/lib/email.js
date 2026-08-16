import nodemailer from "nodemailer";

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

// Returns true if a real email was sent, false if it only logged (no SMTP configured).
export async function sendEmail({ to, subject, body }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:simulated] to=${to} subject="${subject}"\n${body}`);
    return false;
  }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text: body });
    return true;
  } catch (err) {
    console.warn(`[email] send failed to ${to}: ${err.message}`);
    return false;
  }
}
