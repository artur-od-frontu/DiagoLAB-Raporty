import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — DiagoLAB Raporty+
 * Lokalnie: testy wolno pisać pod istniejący serwer (reuseExistingServer),
 * w CI: workflow buduje aplikację i startuje `npm run start`.
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pl-PL",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: `${baseURL.replace(/\/$/, "")}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
