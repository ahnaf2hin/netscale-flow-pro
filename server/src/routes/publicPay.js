import { Router } from "express";
import { prisma } from "../db.js";
import { completeIntent, failIntent, getDefaultGateway } from "../lib/checkout.js";
import { SslcommerzService } from "../lib/payments/sslcommerz.js";
import { BkashService } from "../lib/payments/bkash.js";
import { NagadService } from "../lib/payments/nagad.js";

const router = Router();

// Publicly readable — which gateways are enabled, so the portal can show payment buttons.
router.get("/payment-methods", async (_req, res) => {
  const gateways = await prisma.paymentGateway.findMany({ where: { is_active: true } });
  res.json({ gateways: gateways.map((g) => ({ provider: g.provider, display_name: g.display_name })) });
});

function redirectToOutcome(res, req, intentId, result) {
  const intentPromise = prisma.paymentIntent.findUnique({ where: { id: intentId } });
  intentPromise.then((intent) => {
    const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;
    if (!intent) return res.redirect(303, `${origin}/portal/dashboard?status=${result}`);
    const path = intent.type === "admin_bill" ? `/customers/${intent.customer_id}` : "/portal/dashboard";
    const params = intent.type === "admin_bill" ? `payment=${result}&session_id=${intentId}` : `status=${result}&session_id=${intentId}`;
    res.redirect(303, `${origin}${path}?${params}`);
  });
}

// SSLCommerz posts success/fail/cancel/IPN callbacks as application/x-www-form-urlencoded.
router.post("/sslcommerz/callback", async (req, res) => {
  const intentId = req.query.intent;
  const result = req.query.result;
  try {
    if (!intentId) return res.status(400).send("Missing intent");
    if (result === "failed") {
      await failIntent(intentId, req.body);
      return redirectToOutcome(res, req, intentId, "failed");
    }
    const gateway = await getDefaultGateway();
    const svc = new SslcommerzService({ storeId: gateway.api_key, storePassword: gateway.secret_key, sandbox: gateway.mode !== "live" });
    const valId = req.body?.val_id;
    if (!valId) throw new Error("Missing val_id in SSLCommerz callback");
    const validation = await svc.validate(valId);
    if (validation.status !== "VALID" && validation.status !== "VALIDATED") throw new Error("SSLCommerz validation failed: " + validation.status);
    await completeIntent(intentId, valId, validation);
    redirectToOutcome(res, req, intentId, "success");
  } catch (err) {
    await failIntent(intentId, { error: err.message }).catch(() => {});
    redirectToOutcome(res, req, intentId, "failed");
  }
});

// bKash redirects the browser back with ?paymentID=...&status=...
router.get("/bkash/callback", async (req, res) => {
  const intentId = req.query.intent;
  const { paymentID, status } = req.query;
  try {
    if (!intentId) return res.status(400).send("Missing intent");
    if (status !== "success") {
      await failIntent(intentId, req.query);
      return redirectToOutcome(res, req, intentId, "failed");
    }
    const gateway = await getDefaultGateway();
    const svc = new BkashService({ appKey: gateway.api_key, appSecret: gateway.secret_key, username: process.env.BKASH_USERNAME, password: process.env.BKASH_PASSWORD, sandbox: gateway.mode !== "live" });
    const result = await svc.executePayment({ paymentID });
    if (result.transactionStatus !== "Completed") throw new Error("bKash execute failed: " + (result.statusMessage || result.transactionStatus));
    await completeIntent(intentId, paymentID, result);
    redirectToOutcome(res, req, intentId, "success");
  } catch (err) {
    await failIntent(intentId, { error: err.message }).catch(() => {});
    redirectToOutcome(res, req, intentId, "failed");
  }
});

// Nagad redirects the browser back after checkout completion.
router.get("/nagad/callback", async (req, res) => {
  const intentId = req.query.intent;
  const paymentRefId = req.query.payment_ref_id;
  try {
    if (!intentId) return res.status(400).send("Missing intent");
    const gateway = await getDefaultGateway();
    const svc = new NagadService({ merchantId: gateway.api_key, merchantPrivateKey: process.env.NAGAD_MERCHANT_PRIVATE_KEY, nagadPublicKey: process.env.NAGAD_PUBLIC_KEY, sandbox: gateway.mode !== "live" });
    const result = await svc.verifyPayment(paymentRefId);
    if (result.status !== "Success") throw new Error("Nagad verification failed: " + (result.message || result.status));
    await completeIntent(intentId, paymentRefId, result);
    redirectToOutcome(res, req, intentId, "success");
  } catch (err) {
    await failIntent(intentId, { error: err.message }).catch(() => {});
    redirectToOutcome(res, req, intentId, "failed");
  }
});

export default router;
