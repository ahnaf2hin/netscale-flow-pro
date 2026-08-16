// bKash Tokenized Checkout (PGW).
// Docs: https://developer.bka.sh/docs/tokenized-checkout-url-1

export class BkashService {
  constructor({ appKey, appSecret, username, password, sandbox = true }) {
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.username = username;
    this.password = password;
    this.sandbox = sandbox;
  }
  get baseUrl() {
    return this.sandbox
      ? "https://checkout.sandbox.bka.sh/v1.2.0-beta/checkout"
      : "https://checkout.pay.bka.sh/v1.2.0-beta/checkout";
  }

  async #grantToken() {
    const res = await fetch(`${this.baseUrl}/token/grant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        username: this.username,
        password: this.password,
      },
      body: JSON.stringify({ app_key: this.appKey, app_secret: this.appSecret }),
    });
    const data = await res.json();
    if (!data.id_token) throw new Error(data.msg || "bKash token grant failed");
    return data.id_token;
  }

  async createPayment({ amount, currency = "BDT", merchantInvoiceNumber, callbackURL }) {
    const token = await this.#grantToken();
    const res = await fetch(`${this.baseUrl}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        "X-App-Key": this.appKey,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: merchantInvoiceNumber,
        callbackURL,
        amount: String(amount),
        currency,
        intent: "sale",
        merchantInvoiceNumber,
      }),
    });
    const data = await res.json();
    if (!data.bkashURL) throw new Error(data.statusMessage || "bKash payment creation failed");
    return { ...data, token };
  }

  async executePayment({ paymentID, token }) {
    const authToken = token || (await this.#grantToken());
    const res = await fetch(`${this.baseUrl}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authToken,
        "X-App-Key": this.appKey,
      },
      body: JSON.stringify({ paymentID }),
    });
    return res.json();
  }
}
