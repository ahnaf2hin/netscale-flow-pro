import { prisma } from "../db.js";
import { SslcommerzService } from "./payments/sslcommerz.js";
import { BkashService } from "./payments/bkash.js";
import { NagadService } from "./payments/nagad.js";
import { createStripeSession } from "./payments/stripe.js";
import { sendSms } from "./sms.js";

export async function getDefaultGateway() {
  return prisma.paymentGateway.findFirst({ where: { is_active: true, is_default: true } });
}

// type: "bill" | "upgrade" | "admin_bill"
export async function startCheckout({ type, invoiceId, packageId, customerId, amount, description, origin, clientIp }) {
  const gateway = await getDefaultGateway();

  const intent = await prisma.paymentIntent.create({
    data: {
      gateway: gateway?.provider || "simulated",
      type,
      invoice_id: invoiceId,
      package_id: packageId,
      customer_id: customerId,
      amount,
      status: "pending",
    },
  });

  const successPath =
    type === "admin_bill"
      ? `/customers/${customerId}?payment=success&session_id=${intent.id}`
      : `/portal/dashboard?status=success&session_id=${intent.id}`;
  const cancelPath = type === "admin_bill" ? `/customers/${customerId}?payment=canceled` : `/portal/dashboard?status=canceled`;
  const callbackBase = `${origin}/api/public/pay`;

  if (!gateway || !gateway.is_active) {
    await completeIntent(intent.id, "SIMULATED-" + intent.id);
    return { url: `${origin}${successPath}` };
  }

  try {
    if (gateway.provider === "stripe") {
      const session = await createStripeSession({
        secretKey: gateway.secret_key,
        amount,
        description,
        successUrl: `${origin}${successPath}`,
        cancelUrl: `${origin}${cancelPath}`,
        metadata: { intent_id: intent.id },
        currency: (gateway.currency || "usd").toLowerCase(),
      });
      await prisma.paymentIntent.update({ where: { id: intent.id }, data: { gateway_ref: session.id } });
      return { url: session.url };
    }

    if (gateway.provider === "sslcommerz") {
      const svc = new SslcommerzService({ storeId: gateway.api_key, storePassword: gateway.secret_key, sandbox: gateway.mode !== "live" });
      const session = await svc.initiate({
        amount,
        currency: gateway.currency || "BDT",
        tranId: intent.id,
        successUrl: `${callbackBase}/sslcommerz/callback?intent=${intent.id}`,
        failUrl: `${callbackBase}/sslcommerz/callback?intent=${intent.id}&result=failed`,
        cancelUrl: `${origin}${cancelPath}`,
        ipnUrl: `${callbackBase}/sslcommerz/callback?intent=${intent.id}`,
      });
      await prisma.paymentIntent.update({ where: { id: intent.id }, data: { gateway_ref: session.sessionkey } });
      return { url: session.GatewayPageURL };
    }

    if (gateway.provider === "bkash") {
      const svc = new BkashService({
        appKey: gateway.api_key,
        appSecret: gateway.secret_key,
        username: process.env.BKASH_USERNAME,
        password: process.env.BKASH_PASSWORD,
        sandbox: gateway.mode !== "live",
      });
      const session = await svc.createPayment({
        amount,
        currency: gateway.currency || "BDT",
        merchantInvoiceNumber: intent.id,
        callbackURL: `${callbackBase}/bkash/callback?intent=${intent.id}`,
      });
      await prisma.paymentIntent.update({ where: { id: intent.id }, data: { gateway_ref: session.paymentID } });
      return { url: session.bkashURL };
    }

    if (gateway.provider === "nagad") {
      const svc = new NagadService({
        merchantId: gateway.api_key,
        merchantPrivateKey: process.env.NAGAD_MERCHANT_PRIVATE_KEY,
        nagadPublicKey: process.env.NAGAD_PUBLIC_KEY,
        sandbox: gateway.mode !== "live",
      });
      const session = await svc.initialize({
        orderId: intent.id,
        amount,
        clientIp,
        callbackUrl: `${callbackBase}/nagad/callback?intent=${intent.id}`,
      });
      await prisma.paymentIntent.update({ where: { id: intent.id }, data: { gateway_ref: session.paymentReferenceId } });
      return { url: session.callBackUrl };
    }

    // cash / bank_transfer / unknown provider selected as default — simulate.
    await completeIntent(intent.id, "SIMULATED-" + intent.id);
    return { url: `${origin}${successPath}` };
  } catch (err) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "failed", raw_response: JSON.stringify({ error: err.message }) } });
    throw err;
  }
}

export async function completeIntent(intentId, gatewayRef, raw) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) throw new Error("Payment session not found");
  if (intent.status === "completed") return intent; // idempotent

  await prisma.paymentIntent.update({
    where: { id: intentId },
    data: { status: "completed", gateway_ref: gatewayRef, raw_response: raw ? JSON.stringify(raw) : undefined },
  });

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  await prisma.payment.create({
    data: {
      invoice_id: intent.invoice_id || undefined,
      customer_id: intent.customer_id,
      amount: intent.amount,
      gateway: intent.gateway,
      transaction_id: gatewayRef || intent.id,
      status: "completed",
      paid_at: now,
      description: intent.type === "upgrade" ? "Package upgrade" : "Bill payment",
    },
  });

  if (intent.invoice_id) {
    await prisma.invoice.update({
      where: { id: intent.invoice_id },
      data: { status: "paid", paid_date: today, payment_method: intent.gateway, paid_amount: intent.amount },
    });
  }
  if (intent.type === "upgrade" && intent.package_id) {
    await prisma.customer.update({ where: { id: intent.customer_id }, data: { package_id: intent.package_id } });
  }

  const customer = await prisma.customer.findUnique({ where: { id: intent.customer_id } });
  if (customer?.phone) {
    await sendSms({
      recipient: customer.phone,
      recipient_name: customer.name,
      message: `Dear ${customer.name}, your payment of ৳${intent.amount} has been received. Thank you.`,
      type: "notification",
    });
  }

  return prisma.paymentIntent.findUnique({ where: { id: intentId } });
}

export async function failIntent(intentId, raw) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent || intent.status === "completed") return intent;
  return prisma.paymentIntent.update({
    where: { id: intentId },
    data: { status: "failed", raw_response: raw ? JSON.stringify(raw) : undefined },
  });
}
