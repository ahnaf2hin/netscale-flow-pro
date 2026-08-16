import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Fetch all overdue invoices
    const overdueInvoices = await base44.asServiceRole.entities.Invoice.filter({
      status: 'overdue',
    }, '-due_date', 1000);

    // Filter to those overdue more than 3 days
    const overdueMoreThanThreeDays = overdueInvoices.filter(inv => {
      if (!inv.due_date) return false;
      const dueDate = new Date(inv.due_date);
      return dueDate < threeDaysAgo;
    });

    // Fetch customer details
    const customerIds = [...new Set(overdueMoreThanThreeDays.map(i => i.customer_id).filter(Boolean))];
    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 1000);
    const customerMap = new Map(customers.map(c => [c.id, c]));

    let notifiedCount = 0;
    const notifications = [];

    for (const inv of overdueMoreThanThreeDays) {
      const customer = customerMap.get(inv.customer_id);
      if (!customer || !customer.email) continue;

      try {
        const body = `Dear ${customer.name},\n\nThis is a reminder that your internet bill is overdue.\n\nInvoice Month: ${inv.billing_month}\nAmount Due: ৳${inv.amount}\nDue Date: ${inv.due_date}\n\nYour service may be suspended if payment is not made soon. Please make your payment at your earliest convenience.\n\nThank you,\nISP Manager`;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: customer.email,
          subject: `Overdue Payment Reminder - ৳${inv.amount}`,
          body: body,
        });
        notifiedCount++;
        notifications.push({ customer: customer.name, invoice_id: inv.id });
      } catch (emailErr) {
        console.error(`Failed to send to ${customer.email}:`, emailErr.message);
      }
    }

    return Response.json({
      success: true,
      overdue_total: overdueInvoices.length,
      overdue_more_than_3_days: overdueMoreThanThreeDays.length,
      notifications_sent: notifiedCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});