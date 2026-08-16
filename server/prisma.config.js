import "dotenv/config";
import { defineConfig } from "prisma/config";

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DATABASE_URL: ENV_URL, MYSQL_URL } = process.env;
const DATABASE_URL = ENV_URL || MYSQL_URL || `mysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node src/seed.js",
  },
  datasource: {
    url: DATABASE_URL,
  },
});
