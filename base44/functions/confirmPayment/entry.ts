import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id } = await req.json();
    if (!session_id) return Response.json({ error: 'Missing session_id' }, { status: 400 });

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) return Response.json({ error: 'Stripe is not configured' }, { status: 500 });

    const sessionRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const session = await sessionRes.json();
    if (session.payment_status !== 'paid') {
      return Response.json({ error: 'Payment not completed', payment_status: session.payment_status }, { status: 400 });
    }

    const meta = session.metadata || {};
    const customers = await base44.asServiceRole.entities.Customer.filter({ email: user.email });
    const customer = customers[0];
    if (!customer || meta.customer_id !== customer.id) {
      return Response.json({ error: 'Customer verification failed' }, { status: 403 });
    }

    // Idempotency: skip if this session was already processed
    const existing = await base44.asServiceRole.entities.Payment.filter({ transaction_id: session.id });
    if (existing.length > 0) {
      return Response.json({ success: true, already_processed: true, type: meta.type });
    }

    const amount = session.amount_total / 100;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    if (meta.type === 'bill' && meta.invoice_id) {
      await base44.asServiceRole.entities.Payment.create({
        invoice_id: meta.invoice_id,
        customer_id: customer.id,
        amount,
        gateway: 'stripe',
        transaction_id: session.id,
        status: 'completed',
        paid_at: now,
        description: 'Bill payment via customer portal',
      });
      await base44.asServiceRole.entities.Invoice.update(meta.invoice_id, {
        status: 'paid',
        paid_date: today,
        payment_method: 'stripe',
        paid_amount: amount,
      });
    } else if (meta.type === 'upgrade' && meta.package_id) {
      await base44.asServiceRole.entities.Payment.create({
        customer_id: customer.id,
        amount,
        gateway: 'stripe',
        transaction_id: session.id,
        status: 'completed',
        paid_at: now,
        description: 'Package upgrade via customer portal',
      });
      await base44.asServiceRole.entities.Customer.update(customer.id, { package_id: meta.package_id });
    }

    return Response.json({ success: true, type: meta.type, amount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});