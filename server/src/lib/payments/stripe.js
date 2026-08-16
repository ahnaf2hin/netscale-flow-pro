export async function createStripeSession({ secretKey, amount, description, successUrl, cancelUrl, metadata, currency = "usd" }) {
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "payment_method_types[]": "card",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": currency,
      "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
      "line_items[0][price_data][product_data][name]": description,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...Object.fromEntries(Object.entries(metadata || {}).map(([k, v]) => [`metadata[${k}]`, String(v ?? "")])),
    }),
  });
  const session = await res.json();
  if (!session.url) throw new Error(session.error?.message || "Stripe session creation failed");
  return session;
}

export async function getStripeSession({ secretKey, sessionId }) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  return res.json();
}
