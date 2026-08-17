import { prisma } from "../db.js";
import { sendSms } from "./sms.js";
import { sendEmail } from "./email.js";

// Server-local "today" shifted to Asia/Dhaka, matching the existing generateMonthlyInvoices
// convention (functions.js) so both paths agree on which calendar day/month it currently is.
function todayInDhaka() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
}

// A customer's billing day: their own setting, falling back to their signup day, falling
// back to the 1st. Capped at 28 so it's always a valid day in every month (no Feb 30 issue).
function customerBillingDay(customer) {
  if (customer.billing_day && customer.billing_day >= 1 && customer.billing_day <= 28) return customer.billing_day;
  if (customer.connection_date) {
    const day = new Date(customer.connection_date).getDate();
    if (day >= 1 && day <= 28) return day;
  }
  return 1;
}

function portalLink() {
  const base = process.env.APP_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/portal/login` : "";
}

async function notifyNewInvoice(customer, invoice) {
  const link = portalLink();
  const message = `Your NetScale bill of ৳${invoice.amount} for ${invoice.billing_month} is due ${invoice.due_date}.${link ? ` Pay online: ${link}` : " Log in to your customer portal to pay."}`;
  if (customer.phone) {
    await sendSms({ recipient: customer.phone, recipient_name: customer.name, message, type: "billing" }).catch(() => {});
  }
  if (customer.email) {
    await sendEmail({
      to: customer.email,
      subject: `Your NetScale bill for ${invoice.billing_month}`,
      body: `Hi ${customer.name},\n\n${message}\n\nThank you for choosing NetScale.`,
    }).catch(() => {});
  }
}

// The daily job: for every active/suspended customer whose billing day has arrived this
// month and who doesn't already have an invoice for this billing_month, generates one and
// sends an SMS + email with a payment link. Safe to run more than once a day (or to miss a
// day and catch up later) — the billing_month dedup means each customer only ever gets one
// invoice per calendar month regardless of how many times this runs.
export async function runBillingCycle() {
  const now = todayInDhaka();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = now.getDate();

  const customers = await prisma.customer.findMany({
    where: { status: { in: ["active", "suspended"] }, package_id: { not: null } },
  });

  const result = { checked: customers.length, generated: 0, skipped: 0, errors: 0 };

  for (const customer of customers) {
    try {
      const billingDay = customerBillingDay(customer);
      if (today < billingDay) { result.skipped++; continue; }

      const existing = await prisma.invoice.findFirst({ where: { customer_id: customer.id, billing_month: billingMonth } });
      if (existing) { result.skipped++; continue; }

      const pkg = await prisma.package.findUnique({ where: { id: customer.package_id } });
      if (!pkg) { result.skipped++; continue; }

      const amount = Math.max(0, (pkg.monthly_price || 0) - (customer.discount || 0) - (customer.package_discount || 0));
      const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(billingDay).padStart(2, "0")}`;

      const invoice = await prisma.invoice.create({
        data: {
          customer_id: customer.id, customer_name: customer.name, package_name: pkg.name,
          amount, due_date: dueDate, billing_month: billingMonth, status: "unpaid",
        },
      });
      result.generated++;
      await notifyNewInvoice(customer, invoice);
    } catch (err) {
      console.error(`[billingCycle] failed for customer ${customer.id}: ${err.message}`);
      result.errors++;
    }
  }

  console.log(`[billingCycle] checked=${result.checked} generated=${result.generated} skipped=${result.skipped} errors=${result.errors}`);
  return result;
}

// Manual re-send for an already-generated (still unpaid) invoice — e.g. the customer says
// they never got the SMS, or an admin wants to nudge someone before the due date.
export async function sendInvoiceReminder(invoiceId) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  const customer = await prisma.customer.findUnique({ where: { id: invoice.customer_id } });
  if (!customer) throw new Error("Customer not found");
  await notifyNewInvoice(customer, invoice);
  return { success: true };
}
