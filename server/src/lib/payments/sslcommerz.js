// SSLCommerz session-init (v4) + validator API.
// Docs: https://developer.sslcommerz.com/doc/v4/

export class SslcommerzService {
  constructor({ storeId, storePassword, sandbox = true }) {
    this.storeId = storeId;
    this.storePassword = storePassword;
    this.sandbox = sandbox;
  }
  get baseUrl() {
    return this.sandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";
  }

  async initiate({ amount, currency = "BDT", tranId, successUrl, failUrl, cancelUrl, ipnUrl, customerName, customerEmail, customerPhone, customerAddress = "N/A" }) {
    const body = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: String(amount),
      currency,
      tran_id: tranId,
      success_url: successUrl,
      fail_url: failUrl,
      cancel_url: cancelUrl,
      ipn_url: ipnUrl || successUrl,
      cus_name: customerName || "Customer",
      cus_email: customerEmail || "customer@example.com",
      cus_phone: customerPhone || "01700000000",
      cus_add1: customerAddress,
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      product_name: "Internet Service",
      product_category: "ISP",
      product_profile: "general",
    });

    const res = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
      throw new Error(data.failedreason || "SSLCommerz session init failed");
    }
    return data;
  }

  async validate(valId) {
    const url = new URL(`${this.baseUrl}/validator/api/validationserverAPI.php`);
    url.searchParams.set("val_id", valId);
    url.searchParams.set("store_id", this.storeId);
    url.searchParams.set("store_passwd", this.storePassword);
    url.searchParams.set("format", "json");
    const res = await fetch(url.toString());
    return res.json();
  }
}
