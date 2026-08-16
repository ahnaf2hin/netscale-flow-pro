// Nagad Payment Gateway — RSA-signed request/response envelope.
// This is the least publicly documented of the three BD gateways; the crypto plumbing
// (sign with merchant private key, encrypt with Nagad's public key) follows Nagad's
// integration pattern, but exact endpoint paths/field names should be verified against
// your own Nagad Merchant Integration Guide PDF before enabling live mode.

import crypto from "node:crypto";

export class NagadService {
  constructor({ merchantId, merchantPrivateKey, nagadPublicKey, sandbox = true }) {
    this.merchantId = merchantId;
    this.merchantPrivateKey = merchantPrivateKey;
    this.nagadPublicKey = nagadPublicKey;
    this.sandbox = sandbox;
  }
  get baseUrl() {
    return this.sandbox
      ? "https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs"
      : "https://api.mynagad.com/remote-payment-gateway-1.0/api/dfs";
  }

  #sign(data) {
    const signer = crypto.createSign("SHA256");
    signer.update(data);
    signer.end();
    return signer.sign(this.merchantPrivateKey, "base64");
  }

  #encrypt(data) {
    return crypto.publicEncrypt(
      { key: this.nagadPublicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(data)
    ).toString("base64");
  }

  #decrypt(data) {
    return crypto.privateDecrypt(
      { key: this.merchantPrivateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(data, "base64")
    ).toString("utf8");
  }

  async initialize({ orderId, amount, clientIp, callbackUrl }) {
    const dateTime = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const sensitiveData = JSON.stringify({ merchantId: this.merchantId, datetime: dateTime, orderId, challenge: crypto.randomBytes(16).toString("hex") });
    const payload = {
      accountNumber: this.merchantId,
      dateTime,
      sensitiveData: this.#encrypt(sensitiveData),
      signature: this.#sign(sensitiveData),
    };

    const res = await fetch(`${this.baseUrl}/check-out/initialize/${this.merchantId}/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-KM-IP-V4": clientIp || "127.0.0.1", "X-KM-Client-Type": "PC_WEB" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.sensitiveData) throw new Error(data.message || "Nagad initialize failed");

    const decrypted = JSON.parse(this.#decrypt(data.sensitiveData));
    const paymentSensitive = JSON.stringify({
      merchantId: this.merchantId,
      orderId,
      amount: String(amount),
      currencyCode: "050",
      challenge: decrypted.paymentReferenceId,
    });

    const completeRes = await fetch(`${this.baseUrl}/check-out/complete/${decrypted.paymentReferenceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sensitiveData: this.#encrypt(paymentSensitive),
        signature: this.#sign(paymentSensitive),
        merchantCallbackURL: callbackUrl,
      }),
    });
    const completeData = await completeRes.json();
    if (!completeData.callBackUrl) throw new Error(completeData.message || "Nagad checkout completion failed");
    return { ...completeData, paymentReferenceId: decrypted.paymentReferenceId };
  }

  async verifyPayment(paymentReferenceId) {
    const res = await fetch(`${this.baseUrl}/verify/payment/${paymentReferenceId}`, {
      headers: { "Content-Type": "application/json" },
    });
    return res.json();
  }
}
