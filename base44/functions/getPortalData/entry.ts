import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const customers = await base44.asServiceRole.entities.Customer.filter({ email: user.email });
    const customer = customers[0];
    if (!customer) {
      return Response.json({ error: 'no_customer', message: 'No customer account is linked to your email. Please contact support.' }, { status: 404 });
    }

    const invoices = await base44.asServiceRole.entities.Invoice.filter({ customer_id: customer.id });

    let currentPackage = null;
    if (customer.package_id) {
      try {
        currentPackage = await base44.asServiceRole.entities.Package.get(customer.package_id);
      } catch (e) {
        currentPackage = null;
      }
    }

    const allPackages = await base44.asServiceRole.entities.Package.filter({ is_active: true });

    return Response.json({
      customer,
      currentPackage,
      invoices,
      packages: allPackages,
      user: { full_name: user.full_name, email: user.email }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});