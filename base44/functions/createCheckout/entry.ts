import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { type, invoice_id, package_id } = await req.json();

    const customers = await base44.asServiceRole.entities.Customer.filter({ email: user.email });
    const customer = customers[0];
    if (!customer) return Response.json({ error: 'No customer account linked to your email' }, { status: 404 });

    let amount = 0;
    let description = '';

    if (type === 'bill') {
      if (!invoice_id) return Response.json({ error: 'Invoice ID required' }, { status: 400 });
      const invoice = await base44.asServiceRole.entities.Invoice.get(invoice_id);
      if (!invoice || invoice.customer_id !== customer.id) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }
      if (invoice.status === 'paid') return Response.json({ error: 'Invoice already paid' }, { status: 400 });
      amount = invoice.amount;
      description = `Bill Payment - ${invoice.billing_month || invoice.package_name || 'Invoice'}`;
    } else if (type === 'upgrade') {
      if (!package_id) return Response.json({ error: 'Package ID required' }, { status: 400 });
      const pkg = await base44.asServiceRole.entities.Package.get(package_id);
      if (!pkg) return Response.json({ error: 'Package not found' }, { status: 404 });
      if (customer.package_id === package_id) return Response.json({ error: 'You are already on this package' }, { status: 400 });
      amount = pkg.monthly_price;
      description = `Package Upgrade - ${pkg.name} (${pkg.speed_mbps}Mbps)`;
    } else {
      return Response.json({ error: 'Invalid payment type' }, { status: 400 });
    }

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) return Response.json({ error: 'Stripe is not configured yet. Please add your Stripe secret key.' }, { status: 500 });

    const origin = req.headers.get('origin') || (req.headers.get('referer') || '').replace(/\/portal\/.*$/, '') || 'https://example.com';

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
        'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
        'line_items[0][price_data][product_data][name]': description,
        mode: 'payment',
        'success_url': `${origin}/portal/dashboard?session_id={CHECKOUT_SESSION_ID}&status=success`,
        'cancel_url': `${origin}/portal/dashboard?status=canceled`,
        'metadata[type]': type,
        'metadata[invoice_id]': invoice_id || '',
        'metadata[package_id]': package_id || '',
        'metadata[customer_id]': customer.id,
        'metadata[customer_email]': customer.email || user.email,
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