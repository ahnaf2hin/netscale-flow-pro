import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Hosted MySQL providers (Railway, PlanetScale, etc.) usually inject one connection-string
// env var instead of discrete host/port/user vars — support both.
const connectionString = process.env.DATABASE_URL || process.env.MYSQL_URL;

const adapter = connectionString
  ? new PrismaMariaDb(connectionString)
  : new PrismaMariaDb({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "netscale",
      password: process.env.DB_PASSWORD || "netscale_dev_pw",
      database: process.env.DB_NAME || "netscale_flow_pro",
      connectionLimit: 10,
    });

export const prisma = new PrismaClient({ adapter });
