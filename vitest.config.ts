import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      // Importy modułów serwerowych wymagają zmiennej — w testach nie łączymy się z bazą.
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/app_db",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
