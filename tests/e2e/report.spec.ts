import { test, expect } from "@playwright/test";

/** Raport interaktywny (DEMO) — sekcje, tabela, filtry, zatwierdzanie, źródła. */
test.describe("Raport interaktywny /demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo");
  });

  test("nagłówek, oznaczenie DEMO i KPI z licznikami", async ({ page }) => {
    await expect(page.getByText("DLR/2026/0114-DEMO")).toBeVisible();
    await expect(page.getByText(/dane demonstracyjne/i).first()).toBeVisible();
    const summary = page.locator("#r-podsumowanie");
    await expect(summary).toContainText("Punkty pomiarowe");
    await expect(summary).toContainText("12");
    await expect(summary).toContainText("Nieprawidłowości");
  });

  test("tabela: 12 wierszy, filtr KRYTYCZNE zawęża do 1, wyszukiwarka działa", async ({ page }) => {
    const rows = page.locator("#r-wyniki table tbody tr");
    await expect(rows).toHaveCount(12);

    await page.getByRole("button", { name: /KRYTYCZNE/ }).first().click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("LP-05");

    await page.getByRole("button", { name: /Wszystkie/ }).click();
    await expect(rows).toHaveCount(12);

    await page.getByPlaceholder(/szukaj punktu/i).fill("lakiernia");
    await expect(rows).toHaveCount(2);
  });

  test("szczegóły punktu rozwijają się po kliknięciu wiersza", async ({ page }) => {
    const row = page.locator("#r-wyniki table tbody tr", { hasText: "LP-05" }).first();
    await row.click();
    await expect(page.locator("#r-wyniki")).toContainText("Impedancja pętli zwarcia");
    await expect(page.locator("#r-wyniki")).toContainText("samoczynne wyłączenie zasilania");
  });

  test("ostrzeżenia: akceptacja wpisu odnotowuje decyzję", async ({ page }) => {
    const findings = page.locator("#r-ostrzezenia");
    await findings.getByRole("button", { name: /akceptuj/i }).first().click();
    await expect(findings.getByText("Zaakceptowano").first()).toBeVisible();
    // Decyzja trafia do historii zatwierdzeń w sekcji źródeł
    await expect(page.locator("#r-zrodla")).toContainText(/zaakceptowano wpis/);
  });

  test("zatwierdzenie oceny wymaga potwierdzeń (brama checkboxów)", async ({ page }) => {
    const approveBtn = page.getByRole("button", { name: /zatwierdź raport/i }).first();
    await expect(approveBtn).toBeDisabled();

    await page.getByRole("radio", { name: "WARUNKOWA" }).click();
    await expect(approveBtn).toBeDisabled(); // bez checkboxów nadal zablokowane

    await page.getByText(/zweryfikowałem\/am wszystkie dane/).click();
    await page.getByText(/nie zastępuje moich kwalifikacji/).click();
    await expect(approveBtn).toBeEnabled();

    await approveBtn.click();
    await expect(page.getByText("Raport zatwierdzony").first()).toBeVisible();
  });

  test("źródła danych pokazują prawdziwy hash SHA-256 i QR", async ({ page }) => {
    await page.locator("#r-zrodla").scrollIntoViewIfNeeded();
    await expect(page.locator("#r-zrodla")).toContainText(/SHA-256/);
    await expect(page.locator("#r-zrodla")).toContainText(/[0-9a-f]{64}/, { timeout: 8000 });
    await expect(page.getByAltText(/kod qr/i)).toBeVisible();
  });

  test("Smart Compare+ pokazuje serie historyczne i ograniczenia modelu", async ({ page }) => {
    await page.locator("#r-historia").scrollIntoViewIfNeeded();
    await expect(page.locator("#r-historia")).toContainText(/Smart Compare\+/);
    await expect(page.locator("#r-historia")).toContainText(/ekstrapolację trendu/);
  });
});

test.describe("Panel bez logowania (tryb DEMO)", () => {
  test("panel informuje o trybie demonstracyjnym", async ({ page }) => {
    await page.goto("/panel");
    await expect(page.getByText(/tryb demonstracyjny panelu/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /\+ nowy raport/i }).first()).toBeVisible();
  });
});
