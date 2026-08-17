import "dotenv/config";
import { prisma } from "./db.js";
import { hashPassword } from "./lib/auth.js";

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("Users already exist — skipping seed. Delete rows manually if you want to reseed.");
    return;
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@netscale.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";

  await prisma.user.create({
    data: { email: adminEmail, password_hash: await hashPassword(adminPassword), full_name: "Admin", role: "super_admin" },
  });

  const packages = await prisma.$transaction([
    prisma.package.create({ data: { name: "5 Mbps Home", speed_mbps: 5, monthly_price: 500, description: "Entry-level home package" } }),
    prisma.package.create({ data: { name: "10 Mbps Home", speed_mbps: 10, monthly_price: 800, description: "Popular home package" } }),
    prisma.package.create({ data: { name: "20 Mbps Business", speed_mbps: 20, monthly_price: 1500, description: "Small business package" } }),
  ]);

  const router = await prisma.mikrotikRouter.create({
    data: { name: "Core-Router-Gulshan", host: "192.168.88.1", api_port: 8728, username: "admin", password: "admin", location: "Gulshan DC", latitude: 23.7925, longitude: 90.4078 },
  });

  const zone = await prisma.zone.create({ data: { name: "Gulshan", description: "Gulshan service area" } });
  await prisma.zone.create({ data: { name: "Banani", description: "Banani service area" } });

  const customerEmail = "customer@netscale.local";
  await prisma.user.create({ data: { email: customerEmail, password_hash: await hashPassword("Customer@123"), full_name: "Rahim Uddin", role: "customer" } });

  await prisma.customer.create({
    data: {
      name: "Rahim Uddin", phone: "01712345678", email: customerEmail, address: "House 12, Gulshan-1",
      zone: zone.name, status: "active", package_id: packages[1].id, pppoe_username: "rahim_uddin", pppoe_password: "pass1234",
      customer_code: "CUST-100001", connection_date: new Date().toISOString().slice(0, 10),
      latitude: 23.7925, longitude: 90.4078,
    },
  });

  await prisma.paymentGateway.create({
    data: { provider: "sslcommerz", display_name: "SSLCommerz (Cards & Mobile Banking)", mode: "sandbox", currency: "BDT", is_active: false, is_default: false },
  });
  await prisma.smsProvider.create({
    data: { provider: "custom", display_name: "SMS Gateway", is_active: false, is_default: false },
  });
  await prisma.mapSetting.create({ data: { provider: "esri" } });

  console.log("Seed complete.");
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log(`Portal customer login: ${customerEmail} / Customer@123`);
  console.log(`Router: ${router.name} (${router.host}) — this points at a real IP, so live RouterOS calls will fail/offline until you edit it to a reachable device (no hardware = no mock fallback, matching the original app's behavior).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
