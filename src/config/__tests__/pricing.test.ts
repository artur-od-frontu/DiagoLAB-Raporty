/** Testy konfiguracji cennika — model wyłącznie ilościowy (bez abonamentów). */
import { describe, it, expect } from "vitest";
import { PLANS, formatPlanPrice, pricePerReport, PACKAGE_VALIDITY_MONTHS } from "@/config/brand";

describe("cennik pakietów ilościowych", () => {
  it("zawiera dokładnie 4 pakiety o wymaganych cenach i liczbach raportów", () => {
    expect(PLANS).toHaveLength(4);
    expect(PLANS.map((p) => [p.reportsIncluded, p.pricePLN])).toEqual([
      [1, 0],
      [5, 149],
      [15, 249],
      [30, 399],
    ]);
  });

  it("darmowy pakiet START można wykorzystać tylko raz na konto", () => {
    const start = PLANS.find((p) => p.id === "START")!;
    expect(start.pricePLN).toBe(0);
    expect(start.oncePerAccount).toBe(true);
  });

  it("każdy pakiet ma ważność 12 miesięcy", () => {
    expect(PACKAGE_VALIDITY_MONTHS).toBe(12);
    for (const p of PLANS) expect(p.validityMonths).toBe(12);
  });

  it("nie ma już planów abonamentowych (model subskrypcyjny usunięty)", () => {
    const ids = PLANS.map((p) => p.id as string);
    for (const legacy of ["MINI", "PRO", "EXPERT", "BUSINESS"]) {
      expect(ids).not.toContain(legacy);
    }
    for (const p of PLANS) {
      expect(p).not.toHaveProperty("period");
    }
  });

  it("cena jednostkowa maleje wraz z wielkością pakietu", () => {
    const paid = PLANS.filter((p) => p.pricePLN > 0);
    const unit = paid.map((p) => p.pricePLN / p.reportsIncluded);
    expect(unit).toEqual([...unit].sort((a, b) => b - a)); // malejąco
    expect(pricePerReport(paid[0])).toContain("29,80"); // 149 / 5
    expect(pricePerReport(paid[2])).toContain("13,30"); // 399 / 30
  });

  it("formatowanie cen jest poprawne", () => {
    expect(formatPlanPrice(PLANS[0])).toBe("0 zł");
    expect(formatPlanPrice(PLANS[1])).toBe("149 zł");
    expect(pricePerReport(PLANS[0])).toBeNull();
  });
});
