import { test, expect } from "@playwright/test";

/**
 * Lejek produktu: rejestracja → weryfikacja e-mail + SMS (kody DEV)
 * → profil instalatora → aktywacja → panel z sesją.
 * Tryb DEV zwraca kody w UI tylko gdy brak konfiguracji bramek SMTP/SMS.
 */

const EMAIL = `e2e-${Date.now()}@test.diagolab.dev`;
const PASSWORD = "SilneHaslo123!";

async function extractDevCode(page: import("@playwright/test").Page, channel: "e-mail" | "sms" = "e-mail"): Promise<string> {
  // Marker kanału zapobiega złapaniu kodu z poprzedniego kroku w trakcie przełączenia widoku
  const el = page.getByTestId(channel === "e-mail" ? "dev-code-email" : "dev-code-sms");
  await expect(el).toBeVisible({ timeout: 15_000 });
  const text = await el.textContent();
  const code = text?.match(/kod = ([0-9]{6})/)?.[1];
  if (!code) throw new Error(`Nie znaleziono kodu DEV w: ${text}`);
  return code;
}

test.describe("Lejek: rejestracja → weryfikacje → profil → panel", () => {
  test.describe.configure({ mode: "serial" });

  test("pełna ścieżba konta gratis", async ({ page }) => {
    /* 1. Konto */
    await page.goto("/rejestracja");
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#phone").fill("+48123123123");
    await page.getByRole("button", { name: /wyślij kody weryfikacyjne/i }).click();

    /* 2. Kod e-mail (DEV) */
    const emailCode = await extractDevCode(page, "e-mail");
    await page.locator("#code").fill(emailCode);
    await page.getByRole("button", { name: /potwierdź i kontynuuj/i }).click();

    /* 3. Kod SMS (DEV) */
    const smsCode = await extractDevCode(page, "sms");
    await page.locator("#code").fill(smsCode);
    await page.getByRole("button", { name: /potwierdź i kontynuuj/i }).click();

    /* 4. Profil instalatora */
    await expect(page.getByRole("heading", { name: /profil instalatora/i })).toBeVisible();
    await page.locator("#fn").fill("Ewa");
    await page.locator("#ln").fill("Testerka");
    await page.locator("#cn").fill("ET-Tests Sp. z o.o.");
    await page.locator("#nip").fill("9876543210");
    await page.locator("#cert").fill("E/99/000/2026");
    await page.getByRole("button", { name: /aktywuj raport gratis/i }).click();

    /* 5. Start — konto aktywne */
    await expect(page.getByRole("heading", { name: /konto gotowe/i })).toBeVisible({ timeout: 15_000 });

    /* Panel pokazuje zalogowanego użytkownika (sesja po auto-loginie) */
    await page.goto("/panel");
    await expect(page.getByText(EMAIL).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/tryb demonstracyjny panelu/i)).toHaveCount(0);
  });

  test("logowanie odrzuca błędne hasło", async ({ page }) => {
    await page.goto("/logowanie");
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill("ZleHaslo999");
    await page.getByRole("button", { name: /zaloguj się/i }).click();
    await expect(page.getByText(/nieprawidłowy e-mail lub hasło/i)).toBeVisible();
  });

  test("logowanie poprawnym hasłem prowadzi do panelu", async ({ page }) => {
    await page.goto("/logowanie");
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: /zaloguj się/i }).click();
    await page.waitForURL("**/panel**", { timeout: 15_000 });
    await expect(page.getByText(EMAIL).first()).toBeVisible();
  });
});

test.describe("Tryb terenowy (offline JSON)", () => {
  test("dodanie punktu pokazuje ocenę silnika; dane przetrwają przeładowanie", async ({ page }) => {
    await page.goto("/teren");
    await expect(page.getByRole("heading", { name: /notatnik pomiarowy offline/i })).toBeVisible();
    // Poczekaj na hydratację notatnika (stan kontrolowanych inputów)
    await expect(page.locator("[data-ready='true']")).toBeAttached();

    await page.getByPlaceholder("LP-01").fill("T-01");
    await page.getByPlaceholder("np. Strefa A").fill("Biuro");
    await page.getByPlaceholder("np. Gniazda 230V").fill("Gniazda");
    await page.getByPlaceholder("np. 1,94").fill("1,2");
    await page.getByPlaceholder("np. 220").fill("300");
    await page.getByPlaceholder("np. 0,34").fill("0,2");
    await page.getByRole("button", { name: /dodaj punkt do notatnika/i }).click();

    const list = page.locator("ul");
    await expect(list).toContainText("T-01");
    await expect(list).toContainText("Biuro");

    // Podsumowanie offline: 1 OK
    await expect(page.locator(".card", { hasText: /Punkty pomiarowe/ })).toContainText("OK");

    // JSON w przeglądarce: przeładowanie zachowuje notatnik
    await page.reload();
    await expect(page.locator("ul")).toContainText("T-01");
    await expect(page.locator("ul")).toContainText("Biuro");
  });

  test("ocena na żywo: przekroczony Zs pokazuje status KRYTYCZNY przed dodaniem", async ({ page }) => {
    await page.goto("/teren");
    await expect(page.locator("[data-ready='true']")).toBeAttached();
    await page.getByPlaceholder("LP-01").fill("T-09");
    await page.getByPlaceholder("np. Strefa A").fill("Lakiernia");
    await page.getByPlaceholder("np. 1,94").fill("3,41"); // B16 → limit 2,875 Ω
    await expect(page.getByTestId("draft-status")).toHaveText(/KRYT/);
  });
});
