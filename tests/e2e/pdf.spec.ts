import { test, expect } from "@playwright/test";

/** Serwerowy generator PDF + publiczne linki udostępniania. */
test.describe("Generator PDF", () => {
  test("GET /api/demo/pdf zwraca prawdziwy dokument PDF (magic bytes)", async ({ request }) => {
    const res = await request.get("/api/demo/pdf", { timeout: 60_000 });
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect(res.headers()["content-disposition"]).toContain("diagolab-raport-demo");
    const body = await res.body();
    expect(body.slice(0, 5).toString("latin1")).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(20_000); // dokument z treścią, nie pusty
    expect(body.toString("latin1", body.length - 8)).toContain("EOF"); // stopka PDF
  });

  test("strona /demo ma przycisk pobierania PDF", async ({ page }) => {
    await page.goto("/demo");
    const link = page.getByRole("link", { name: /pobierz pdf/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/api/demo/pdf");
  });

  test("PDF raportu z bazy wymaga zalogowania (401 bez sesji)", async ({ request }) => {
    const res = await request.get("/api/reports/00000000-0000-0000-0000-000000000000/pdf");
    expect(res.status()).toBe(401);
  });

  test("publiczny podgląd bez tokenu lub z błędnym tokenem → 404", async ({ request }) => {
    const id = "00000000-0000-0000-0000-000000000000";
    const noToken = await request.get(`/r/${id}`);
    expect(noToken.status()).toBe(404);
    const badToken = await request.get(`/r/${id}?t=${"0".repeat(32)}`);
    expect(badToken.status()).toBe(404);
  });
});
