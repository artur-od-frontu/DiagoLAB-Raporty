import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/app_db";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations", // <-- TA LINIA ROZWIĄZUJE BŁĄD Z AWS DATA API
  dbCredentials: {
    url: databaseUrl,
  },
});
