/**
 * Testy bezpieczeństwa autoryzacji i logiki czasowej sesji czynnej.
 */

import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generateCode } from "@/lib/auth";
import { SESSION_TIMING, IDLE_AFTER_MS, SESSION_COUNTDOWN_S } from "@/lib/session-timing";

describe("hashPassword / verifyPassword (scrypt)", () => {
  it("poprawne hasło weryfikuje się pozytywnie", () => {
    const stored = hashPassword("SilneHaslo123!");
    expect(stored.startsWith("scrypt:")).toBe(true);
    expect(verifyPassword("SilneHaslo123!", stored)).toBe(true);
  });

  it("błędne hasło → false; hash nie zdradza hasła", () => {
    const stored = hashPassword("SilneHaslo123!");
    expect(verifyPassword("ZleHaslo", stored)).toBe(false);
    expect(stored).not.toContain("SilneHaslo123!");
  });

  it("ta sama para hasło/sól jest niedeterministyczna (unikalna sól)", () => {
    expect(hashPassword("abc12345")).not.toBe(hashPassword("abc12345"));
  });

  it("odporny na uszkodzony zapis", () => {
    expect(verifyPassword("x", "niepoprawny-format")).toBe(false);
    expect(verifyPassword("x", "scrypt::")).toBe(false);
  });
});

describe("generateCode", () => {
  it("zawsze 6 cyfr", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("SESSION_TIMING — sesja czynna", () => {
  it("licznik startuje po 5 minutach bezczynności", () => {
    expect(IDLE_AFTER_MS).toBe(5 * 60 * 1000);
  });

  it("serwerowe okno ważności = czas bezczynności + odliczanie + bufor sieciowy", () => {
    const minimalExpected = IDLE_AFTER_MS + SESSION_COUNTDOWN_S * 1000;
    expect(SESSION_TIMING.validWindowMs).toBeGreaterThanOrEqual(minimalExpected);
    // Bufor nie może być ogromny — twardy limit musi obowiązywać w rozsądnym czasie
    expect(SESSION_TIMING.validWindowMs).toBeLessThanOrEqual(IDLE_AFTER_MS + 3 * 60 * 1000);
  });

  it("odliczanie widoczne dla użytkownika jest sensownej długości (30–120 s)", () => {
    expect(SESSION_COUNTDOWN_S).toBeGreaterThanOrEqual(30);
    expect(SESSION_COUNTDOWN_S).toBeLessThanOrEqual(120);
  });
});
