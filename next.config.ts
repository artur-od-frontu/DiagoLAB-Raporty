import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright renderuje PDF po stronie serwera — nie bundlujemy go do klienta
  serverExternalPackages: ["playwright", "playwright-core", "@playwright/test"],
  // Docker: standalone output. Wyłączone w sandboxie — Dockerfile sam ustawia tę flagę.
  // output: "standalone",
};

export default nextConfig;
