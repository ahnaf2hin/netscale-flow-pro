import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { prisma } from "./db.js";
import { attachUser } from "./lib/auth.js";
import { runBillingCycle } from "./lib/billingCycle.js";

import authRoutes from "./routes/auth.js";
import entitiesRoutes from "./routes/entities.js";
import functionsRoutes from "./routes/functions.js";
import collectorRoutes from "./routes/collector.js";
import publicPayRoutes from "./routes/publicPay.js";
import integrationsRoutes from "./routes/integrations.js";
import adminUsersRoutes from "./routes/adminUsers.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(cors());

// SSLCommerz posts application/x-www-form-urlencoded callbacks.
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "5mb" }));

app.use(attachUser(prisma));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/entities", entitiesRoutes);
app.use("/api/functions", functionsRoutes);
app.use("/api/collector", collectorRoutes);
app.use("/api/public", publicPayRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/admin/users", adminUsersRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`NetScale Flow Pro API listening on http://localhost:${PORT}`);
});

// Daily billing cycle: generates each customer's invoice on their own billing day and sends
// the unpaid-bill SMS/email, without needing an external scheduler to hit an HTTP endpoint.
// 8:00 AM Asia/Dhaka — after office hours start, comfortably before most people check bills.
cron.schedule("0 8 * * *", () => {
  runBillingCycle().catch((err) => console.error(`[billingCycle] scheduled run failed: ${err.message}`));
}, { timezone: "Asia/Dhaka" });
