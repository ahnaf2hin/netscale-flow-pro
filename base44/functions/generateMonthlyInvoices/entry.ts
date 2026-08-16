import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Determine billing month (current month in Asia/Dhaka timezone)
    const now = new Date();
    const dhakaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
    const billingMonth = `${dhakaTime.getFullYear()}-${String(dhakaTime.getMonth() + 1).padStart(2, '0')}`;

    // Fetch all active and suspended customers (suspended may still owe invoices)
    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 1000);
    const billableCustomers = customers.filter(c => c.status === 'active' || c.status === 'suspended');

    // Fetch all packages
    const packages = await base44.asServiceRole.entities.Package.list('-created_date', 200);
    const pkgMap = new Map(packages.map(p => [p.id, p]));

    // Fetch existing invoices for this month to avoid duplicates
    const existingInvoices = await base44.asServiceRole.entities.Invoice.filter({
      billing_month: billingMonth,
    }, '-created_date', 1000);
    const existingCustomerIds = new Set(existingInvoices.map(i => i.customer_id));

    // Due date: 10th of the current month
    const dueDate = `${dhakaTime.getFullYear()}-${String(dhakaTime.getMonth() + 1).padStart(2, '0')}-10`;

    const invoicesToCreate = [];
    const notificationsToSend = [];

    for (const customer of billableCustomers) {
      if (!customer.package_id) continue;
      if (existingCustomerIds.has(customer.id)) continue;

      const pkg = pkgMap.get(customer.package_id);
      if (!pkg) continue;

      const invoice = {
        customer_id: customer.id,
        customer_name: customer.name,
        package_name: pkg.name,
        amount: pkg.monthly_price,
        due_date: dueDate,
        billing_month: billingMonth,
        status: 'unpaid',
      };

      invoicesToCreate.push(invoice);

      if (customer.email) {
        notificationsToSend.push({
          to: customer.email,
          subject: `Monthly Invoice - ${billingMonth} - ৳${pkg.monthly_price}`,
          customer_name: customer.name,
          package_name: pkg.name,
          amount: pkg.monthly_price,
          due_date: dueDate,
          billing_month: billingMonth,
        });
      }
    }

    // Bulk create invoices
    let createdCount = 0;
    if (invoicesToCreate.length > 0) {
      const created = await base44.asServiceRole.entities.Invoice.bulkCreate(invoicesToCreate);
      createdCount = created.length;
    }

    // Send email notifications
    let notifiedCount = 0;
    for (const notif of notificationsToSend) {
      try {
        const body = `Dear ${notif.customer_name},\n\nYour monthly internet bill for ${notif.billing_month} has been generated.\n\nPackage: ${notif.package_name}\nAmount: ৳${notif.amount}\nDue Date: ${notif.due_date}\n\nPlease make your payment before the due date to avoid service suspension.\n\nThank you,\nISP Manager`;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: notif.to,
          subject: notif.subject,
          body: body,
        });
        notifiedCount++;
      } catch (emailErr) {
        console.error(`Failed to send to ${notif.to}:`, emailErr.message);
      }
    }

    return Response.json({
      success: true,
      billing_month: billingMonth,
      invoices_generated: createdCount,
      notifications_sent: notifiedCount,
      skipped: existingCustomerIds.size,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});