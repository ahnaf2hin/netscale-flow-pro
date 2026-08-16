import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const { invoice_id } = await req.json();
    if (!invoice_id) return Response.json({ error: 'Invoice ID required' }, { status: 400 });

    const invoice = await base44.asServiceRole.entities.Invoice.get(invoice_id);
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status === 'paid') return Response.json({ error: 'Invoice already paid' }, { status: 400 });

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) return Response.json({ error: 'Stripe not configured' }, { status: 500 });

    const origin = req.headers.get('origin') || (req.headers.get('referer') || '').replace(/\/customers.*$/, '') || 'https://example.com';
    const description = `Invoice - ${invoice.billing_month || invoice.package_name || invoice.customer_name || 'Bill'}`;

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'aud',
        'line_items[0][price_data][unit_amount]': String(Math.round(invoice.amount * 100)),
        'line_items[0][price_data][product_data][name]': description,
        mode: 'payment',
        'success_url': `${origin}/customers/${invoice.customer_id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${origin}/customers/${invoice.customer_id}?payment=canceled`,
        'metadata[invoice_id]': invoice_id,
        'metadata[customer_id]': invoice.customer_id,
        'metadata[admin_paid]': 'true',
      }),
    });

    const session = await sessionRes.json();
    if (!session.url) {
      return Response.json({ error: session.error?.message || 'Stripe session creation failed' }, { status: 500 });
    }

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});