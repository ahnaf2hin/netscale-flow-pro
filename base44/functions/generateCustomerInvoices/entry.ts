import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { customer_id } = body;
    if (!customer_id) return Response.json({ error: 'customer_id required' }, { status: 400 });

    const customer = await base44.asServiceRole.entities.Customer.get(customer_id);
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });
    if (!customer.connection_date) return Response.json({ success: true, created: 0, message: 'No connection date set' });
    if (!customer.package_id) return Response.json({ success: true, created: 0, message: 'No package assigned' });

    const pkg = await base44.asServiceRole.entities.Package.get(customer.package_id);
    if (!pkg) return Response.json({ success: true, created: 0, message: 'Package not found' });

    // Monthly amount after all discounts
    const monthlyAmount = Math.max(0, (pkg.monthly_price || 0) - (customer.discount || 0) - (customer.package_discount || 0));

    // Parse connection date
    const connDate = new Date(customer.connection_date + 'T00:00:00');
    const connDay = connDate.getDate();
    const connYear = connDate.getFullYear();
    const connMonth = connDate.getMonth(); // 0-indexed

    // Current month
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    // Get existing invoices for this customer to avoid duplicates
    const existing = await base44.asServiceRole.entities.Invoice.filter({ customer_id: customer.id }, '-created_date', 300);
    const existingMonths = new Set(existing.map(i => i.billing_month));

    const invoicesToCreate = [];

    // One-time connection charge invoice (if not free and has a charge)
    const connChargeKey = `CONN-${connYear}-${String(connMonth + 1).padStart(2, '0')}`;
    if (!customer.free_connection && (customer.connection_charge || 0) > 0 && !existingMonths.has(connChargeKey)) {
      invoicesToCreate.push({
        customer_id: customer.id,
        customer_name: customer.name,
        package_name: 'Connection Charge',
        amount: customer.connection_charge,
        due_date: customer.connection_date,
        billing_month: connChargeKey,
        status: 'unpaid',
      });
    }

    // Generate monthly invoices from connection month to current month
    let y = connYear, m = connMonth;
    while (y < curYear || (y === curYear && m <= curMonth)) {
      const billingMonth = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!existingMonths.has(billingMonth)) {
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const dueDay = Math.min(connDay, daysInMonth);
        const dueDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

        invoicesToCreate.push({
          customer_id: customer.id,
          customer_name: customer.name,
          package_name: pkg.name,
          amount: monthlyAmount,
          due_date: dueDate,
          billing_month: billingMonth,
          status: 'unpaid',
        });
      }
      m++;
      if (m > 11) { m = 0; y++; }
    }

    let created = 0;
    if (invoicesToCreate.length > 0) {
      const result = await base44.asServiceRole.entities.Invoice.bulkCreate(invoicesToCreate);
      created = result.length;
    }

    return Response.json({ success: true, created: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});