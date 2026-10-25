import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Fallback do bazy testowej w CI, jeśli process.env.DATABASE_URL nie zostanie wykryty
const databaseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/app_db";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: databaseUrl,
  },
});
