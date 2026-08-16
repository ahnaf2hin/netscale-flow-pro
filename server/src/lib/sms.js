import { prisma } from "../db.js";

// Sends via the default active SmsProvider row. Falls back to logging (simulated)
// if no provider is configured or active, so the rest of the app keeps working.
export async function sendSms({ recipient, recipient_name, message, type = "single" }) {
  const log = await prisma.sMSMessage.create({
    data: { recipient, recipient_name, message, type, status: "queued" },
  });

  const provider = await prisma.smsProvider.findFirst({ where: { is_active: true, is_default: true } });
  if (!provider || !provider.api_url) {
    console.log(`[sms:simulated] to=${recipient} "${message}"`);
    return prisma.sMSMessage.update({ where: { id: log.id }, data: { status: "sent", sent_at: new Date().toISOString() } });
  }

  try {
    const url = new URL(provider.api_url);
    if (provider.api_key) url.searchParams.set("api_key", provider.api_key);
    if (provider.api_secret) url.searchParams.set("api_secret", provider.api_secret);
    if (provider.sender_id) url.searchParams.set("senderid", provider.sender_id);
    url.searchParams.set("number", recipient);
    url.searchParams.set("message", message);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`SMS gateway responded ${res.status}`);

    return prisma.sMSMessage.update({ where: { id: log.id }, data: { status: "sent", sent_at: new Date().toISOString() } });
  } catch (err) {
    console.warn(`[sms] send failed to ${recipient}: ${err.message}`);
    return prisma.sMSMessage.update({ where: { id: log.id }, data: { status: "failed" } });
  }
}
