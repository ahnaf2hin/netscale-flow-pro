import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db.js";
import { attachUser } from "./lib/auth.js";

import authRoutes from "./routes/auth.js";
import entitiesRoutes from "./routes/entities.js";
import functionsRoutes from "./routes/functions.js";
import collectorRoutes from "./routes/collector.js";
import publicPayRoutes from "./routes/publicPay.js";
import integrationsRoutes from "./routes/integrations.js";

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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`NetScale Flow Pro API listening on http://localhost:${PORT}`);
});
