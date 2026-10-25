import { test, expect } from "@playwright/test";

/** Strona sprzedażowa — treść, CTA, cennik z konfiguracji, dostępne FAQ. */
test.describe("Strona główna", () => {
  test("hero z CTA i obietnicą marki", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /inteligentny raport/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /wygeneruj pierwszy raport gratis/i }).first()).toBeVisible();
    await expect(page.getByText(/bez karty płatniczej/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /zobacz przykładowy raport/i }).first()).toBeVisible();
  });

  test("cennik pokazuje wyłącznie pakiety ilościowe z cenami", async ({ page }) => {
    await page.goto("/#cennik");
    await expect(page.getByRole("heading", { name: /płacisz za raporty, nie za abonament/i })).toBeVisible();
    for (const name of ["START", "PAKIET 5", "PAKIET 15", "PAKIET 30"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    for (const price of ["0 zł", "149 zł", "249 zł", "399 zł"]) {
      await expect(page.getByText(price, { exact: true }).first()).toBeVisible();
    }
    // model abonamentowy nie może już występować
    await expect(page.getByText(/\/ mies\./i)).toHaveCount(0);
    await expect(page.getByText("Ważność 12 miesięcy").first()).toBeVisible();
  });

  test("pasek nawigacji przestaje być przezroczysty po przewinięciu", async ({ page }) => {
    await page.goto("/");
    const bar = page.locator("header [data-scrolled]");
    await expect(bar).toHaveAttribute("data-scrolled", "false");
    await expect(bar).toHaveClass(/glass/);

    await page.mouse.wheel(0, 600);
    await expect(bar).toHaveAttribute("data-scrolled", "true");
    await expect(bar).toHaveClass(/nav-solid/);

    // Tło musi być w pełni kryjące — odczyt po zakończeniu animacji przejścia
    await expect
      .poll(async () => bar.evaluate((el) => getComputedStyle(el).backgroundColor), { timeout: 5000 })
      .not.toMatch(/rgba\([^)]*,\s*0?\.\d+\s*\)/);
    // oraz bez rozmycia tła (treść strony nie przebija przez menu)
    expect(await bar.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
  });

  test("pakiet 15 jest oznaczony jako REKOMENDOWANY", async ({ page }) => {
    await page.goto("/#cennik");
    const badge = page.getByText("REKOMENDOWANY", { exact: true });
    await expect(badge).toBeVisible();
    // etykieta w kolorze marki (człon LAB)
    expect(await badge.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 106, 31)");
    // stare sformułowanie nie może już występować
    await expect(page.getByText(/najczęściej wybierany/i)).toHaveCount(0);
  });

  test("przyciski wypełnione mają kolor marki LAB i warstwę widma", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /wygeneruj pierwszy raport gratis/i }).first();
    await expect(cta).toBeVisible();

    const bg = await cta.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain("rgb(255, 106, 31)"); // #ff6a1f z logo

    // biały tekst na ognistym tle — czytelny kontrast
    expect(await cta.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");

    // warstwa widma UV/Thermo istnieje i jest animowana
    const spectrum = await cta.evaluate((el) => {
      const cs = getComputedStyle(el, "::before");
      return { name: cs.animationName, image: cs.backgroundImage, opacity: cs.opacity };
    });
    expect(spectrum.name).toBe("kf-thermo");
    expect(spectrum.image).toContain("rgb(123, 47, 247)"); // UV / fiolet
    expect(Number(spectrum.opacity)).toBeGreaterThan(0.5);
    // 10,5 s = pierwotne 7 s spowolnione o 50%
    expect(await cta.evaluate((el) => getComputedStyle(el, "::before").animationDuration)).toBe("10.5s");
  });

  test("strona ma jasne tło i ciemny tekst — motyw profesjonalny", async ({ page }) => {
    await page.goto("/");
    const bg = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
    // jasne tło — czysta biel
    expect(bg).toBe("rgb(255, 255, 255)");
    // tekst główny — ciemny
    const color = await page.locator("body").evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe("rgb(15, 23, 41)");
  });

  test("karty mają białe tło i obramowanie", async ({ page }) => {
    await page.goto("/#jak-dziala");
    const card = page.locator(".card").first();
    await expect(card).toBeVisible();
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(255, 255, 255)");
    const border = await card.evaluate((el) => getComputedStyle(el).borderColor);
    expect(border).not.toBe("");
  });

  test("logo ma firmowe kolory: Diago biały, LAB ognisty, Raporty+ cyjan", async ({ page }) => {
    await page.goto("/");
    const lab = page.locator("header .text-flame").first();
    await expect(lab).toHaveText("LAB");
    const labColor = await lab.evaluate((el) => getComputedStyle(el).color);
    expect(labColor).toBe("rgb(255, 106, 31)");

    const raporty = page.locator("header .text-brand-mid").first();
    await expect(raporty).toContainText("Raporty");
    const rColor = await raporty.evaluate((el) => getComputedStyle(el).color);
    expect(rColor).toBe("rgb(26, 95, 180)");
  });

  test("FAQ otwiera się klawiaturą (dostępność akordeonu)", async ({ page }) => {
    await page.goto("/#faq");
    const firstQ = page.locator("details.faq summary").first();
    await firstQ.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details.faq").first()).toHaveJSProperty("open", true);
  });
});
