/**
 * Testy jednostkowe Modułu A — silnika obliczeniowego.
 * Pokrywamy: normalizację jednostek, limity kryteriów, klasyfikację wyników,
 * agregację raportu, mapowanie kolumn importu oraz Smart Compare+.
 * Konwencja: given / when / then w treści asercji.
 */

import { describe, it, expect } from "vitest";
import {
  parseLocalizedNumber,
  curveMultiplier,
  zsLimitOhm,
  evaluatePoint,
  analyzePoints,
  guessColumnMapping,
  rowsToPoints,
  compareHistory,
  sha256Hex,
  pointsToCsv,
  autoMapColumns,
  looksHeaderless,
  profileColumn,
  type RawPoint,
} from "@/lib/engine";
import { DEMO_POINTS } from "@/lib/demo-data";

/* ---------------- Normalizacja jednostek ---------------- */

describe("parseLocalizedNumber", () => {
  it("parsuje przecinek dziesiętny", () => {
    expect(parseLocalizedNumber("0,42")).toBe(0.42);
    expect(parseLocalizedNumber("1,94 Ω")).toBe(1.94);
  });

  it("skaluje jednostki SI", () => {
    expect(parseLocalizedNumber("1,2 kΩ")).toBe(1200);
    expect(parseLocalizedNumber("350 mΩ")).toBeCloseTo(0.35, 3);
    expect(parseLocalizedNumber("254 ms")).toBe(254);
    expect(parseLocalizedNumber("19,8 mA")).toBeCloseTo(19.8, 3);
  });

  it("rozróżnia megaom od milioomu (wielkość liter ma znaczenie)", () => {
    expect(parseLocalizedNumber("1,2 MΩ")).toBe(1.2); // megaom: rezystancja izolacji
    expect(parseLocalizedNumber("1,2 mΩ")).toBeCloseTo(0.0012, 4); // milioom: ciągłość
  });

  it("akceptuje wartości spoza zakresu miernika (>550 MΩ)", () => {
    expect(parseLocalizedNumber(">550 MΩ")).toBe(550);
    expect(parseLocalizedNumber(">999")).toBe(999);
  });

  it("zwraca null dla braków danych", () => {
    expect(parseLocalizedNumber(null)).toBeNull();
    expect(parseLocalizedNumber("")).toBeNull();
    expect(parseLocalizedNumber("—")).toBeNull();
    expect(parseLocalizedNumber("b/d")).toBeNull();
    expect(parseLocalizedNumber("abc")).toBeNull();
  });

  it("akceptuje liczby natywne", () => {
    expect(parseLocalizedNumber(2.5)).toBe(2.5);
    expect(parseLocalizedNumber(NaN)).toBeNull();
  });
});

/* ---------------- Limity impedancji pętli zwarcia ---------------- */

describe("zsLimitOhm", () => {
  it("liczy Zs ≤ Uo/Ia dla typowych zabezpieczeń", () => {
    expect(zsLimitOhm({ curve: "B", inA: 16 })).toBeCloseTo(2.875, 3); // Ia = 80 A
    expect(zsLimitOhm({ curve: "B", inA: 10 })).toBeCloseTo(4.6, 3); // Ia = 50 A
    expect(zsLimitOhm({ curve: "C", inA: 32 })).toBeCloseTo(0.719, 3); // Ia = 320 A
  });

  it("curveMultiplier pokrywa charakterystyki B/C/D", () => {
    expect(curveMultiplier("B")).toBe(5);
    expect(curveMultiplier("C")).toBe(10);
    expect(curveMultiplier("D")).toBe(20);
  });
});

/* ---------------- Ocena pojedynczego punktu ---------------- */

const basePoint: RawPoint = {
  code: "T-01",
  location: "Test",
  circuit: "Obwód testowy",
  protection: { curve: "B", inA: 16, rcdmA: 30 },
  zsOhm: 1.5,
  risoMOhm: 200,
  continuityOhm: 0.3,
  rcdTripMs: 24,
  rcdTripmA: 20,
};

describe("evaluatePoint", () => {
  it("punkt referencyjny → wszystko OK", () => {
    const ev = evaluatePoint(basePoint);
    expect(ev.overall).toBe("OK");
    expect(ev.zs.status).toBe("OK");
    expect(ev.riso.status).toBe("OK");
    expect(ev.rcdTime?.status).toBe("OK");
  });

  it("Zs powyżej limitu → KRYTYCZNE", () => {
    const ev = evaluatePoint({ ...basePoint, zsOhm: 3.0 }); // limit 2.875
    expect(ev.zs.status).toBe("CRITICAL");
    expect(ev.overall).toBe("CRITICAL");
  });

  it("Zs w strefie 90–100% limitu → OSTRZEŻENIE", () => {
    const ev = evaluatePoint({ ...basePoint, zsOhm: 2.7 }); // 93,9% limitu
    expect(ev.zs.status).toBe("WARNING");
    expect(ev.overall).toBe("WARNING");
  });

  it("Riso poniżej 1 MΩ → KRYTYCZNE; 1–1,5 MΩ → OSTRZEŻENIE", () => {
    expect(evaluatePoint({ ...basePoint, risoMOhm: 0.86 }).riso.status).toBe("CRITICAL");
    expect(evaluatePoint({ ...basePoint, risoMOhm: 1.24 }).riso.status).toBe("WARNING");
  });

  it("RCD: czas > 300 ms → KRYTYCZNE; > 80% limitu → OSTRZEŻENIE", () => {
    expect(evaluatePoint({ ...basePoint, rcdTripMs: 310 }).rcdTime?.status).toBe("CRITICAL");
    expect(evaluatePoint({ ...basePoint, rcdTripMs: 254 }).rcdTime?.status).toBe("WARNING");
  });

  it("RCD: prąd wyzwalania poza 0,5–1×IΔn → KRYTYCZNE", () => {
    expect(evaluatePoint({ ...basePoint, rcdTripmA: 31 }).rcdCurrent?.status).toBe("CRITICAL");
    expect(evaluatePoint({ ...basePoint, rcdTripmA: 14 }).rcdCurrent?.status).toBe("CRITICAL");
  });

  it("brak pomiarów → status MISSING (ocena zablokowana)", () => {
    const ev = evaluatePoint({ ...basePoint, zsOhm: null });
    expect(ev.zs.status).toBe("MISSING");
    expect(ev.overall).toBe("MISSING");
  });
});

/* ---------------- Agregacja zbiorcza ---------------- */

describe("analyzePoints", () => {
  it("dane DEMO: 12 punktów = 9 OK / 2 ostrzeżenia / 1 krytyczny", () => {
    const a = analyzePoints(DEMO_POINTS);
    expect(a.summary.total).toBe(12);
    expect(a.summary.ok).toBe(9);
    expect(a.summary.warning).toBe(2);
    expect(a.summary.critical).toBe(1);
  });

  it("generuje ustalenia z kategoriami i działaniami", () => {
    const a = analyzePoints(DEMO_POINTS);
    const crit = a.findings.find((f) => f.category === "KRYTYCZNE");
    expect(crit).toBeDefined();
    expect(crit!.pointCode).toBe("LP-05");
    expect(crit!.action.length).toBeGreaterThan(20); // konkretne działanie, nie placeholder
    expect(a.findings.some((f) => f.category === "ZALECENIE")).toBe(true);
  });

  it("verdictCounts sumuje się do liczby punktów", () => {
    const a = analyzePoints(DEMO_POINTS);
    const sum = Object.values(a.verdictCounts).reduce((x, y) => x + y, 0);
    expect(sum).toBe(a.summary.total);
  });
});

/* ---------------- Mapowanie kolumn importu ---------------- */

describe("guessColumnMapping", () => {
  it("rozpoznaje polskie nagłówki z pliku przykładowego", () => {
    const headers = ["Lp", "Lokalizacja", "Obwód", "Charakterystyka", "In [A]", "RCD [mA]", "Zs [Ω]", "Riso [MΩ]", "Ciągłość PE [Ω]", "Czas RCD [ms]", "Prąd wyzwalania RCD [mA]"];
    const m = guessColumnMapping(headers);
    expect(m.code).toBe("Lp");
    expect(m.location).toBe("Lokalizacja");
    expect(m.breakerCurve).toBe("Charakterystyka");
    expect(m.breakerIn).toBe("In [A]");
    expect(m.zs).toBe("Zs [Ω]");
    expect(m.riso).toBe("Riso [MΩ]");
    expect(m.rcdTime).toBe("Czas RCD [ms]");
  });

  it("nie dublować kolumn między polami", () => {
    const headers = ["Zs", "Riso", "Lp"];
    const m = guessColumnMapping(headers);
    const used = Object.values(m).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
  });
});

/* ---------------- Autonomiczne rozpoznawanie kolumn ---------------- */

describe("autoMapColumns — rozpoznawanie po wartościach", () => {
  // Plik BEZ sensownych nagłówków: nazwy kolumn nic nie znaczą
  const anonRows = [
    { A: "LP-01", B: "Rozdzielnia", C: "B", D: "16", E: "30", F: "1,94", G: "320", H: "0,34", I: "24", J: "19,8" },
    { A: "LP-02", B: "Hala", C: "C", D: "32", E: "", F: "0,58", G: "180", H: "0,21", I: "", J: "" },
    { A: "LP-03", B: "Magazyn", C: "B", D: "16", E: "30", F: "2,36", G: "210", H: "0,55", I: "25", J: "18,9" },
    { A: "LP-04", B: "Biuro", C: "B", D: "10", E: "30", F: "1,42", G: "440", H: "0,29", I: "22", J: "20,1" },
  ];
  const anonHeaders = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  it("rozpoznaje kod punktu, charakterystykę i prąd znamionowy z samych wartości", () => {
    const { mapping, details } = autoMapColumns(anonHeaders, anonRows);
    expect(mapping.code).toBe("A");
    expect(mapping.breakerCurve).toBe("C");
    expect(mapping.breakerIn).toBe("D");
    expect(details.code.source).toBe("values");
    expect(details.breakerCurve.confidence).toBeGreaterThan(0.8);
  });

  it("odróżnia Zs (ułamki ~1–3 Ω) od Riso (setki MΩ) i ciągłości (<1 Ω)", () => {
    const { mapping } = autoMapColumns(anonHeaders, anonRows);
    expect(mapping.zs).toBe("F");
    expect(mapping.riso).toBe("G");
    expect(mapping.continuity).toBe("H");
  });

  it("rozpoznaje IΔn RCD po typoszeregu (30/100/300 mA)", () => {
    const { mapping } = autoMapColumns(anonHeaders, anonRows);
    expect(mapping.rcdmA).toBe("E");
  });

  it("nie przypisuje tej samej kolumny do dwóch parametrów", () => {
    const { mapping } = autoMapColumns(anonHeaders, anonRows);
    const used = Object.values(mapping).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
  });

  it("wykrywa ciągłość PE mimo przekroczenia zakresu miernika (>1999) i nietypowych nagłówków", () => {
    // 1. nietypowe nagłówki (skróty, prąd pomiarowy)
    expect(autoMapColumns(["R kont."], [{ "R kont.": "0,15" }]).mapping.continuity).toBe("R kont.");
    expect(autoMapColumns(["±200mA"], [{ "±200mA": "0,15" }]).mapping.continuity).toBe("±200mA");
    
    // 2. brak nagłówka, zgadywanie po wartościach + overrange (bardzo małe wartości typowe dla ciągłości, ale z jednym >1999)
    const valsRows = [
      { A: "0,05" },
      { A: ">1999" }, // przesterowanie na przerwie
      { A: "0,12" },
      { A: "0,01" },
    ];
    const { mapping, details } = autoMapColumns(["A"], valsRows);
    expect(mapping.continuity).toBe("A");
    expect(details.continuity.source).toBe("values");
  });

  it("nagłówki mają pierwszeństwo przed wartościami i mają wysoką pewność", () => {
    const headers = ["Lp", "Lokalizacja", "Zs [Ω]", "Riso [MΩ]"];
    const rows = [{ Lp: "LP-01", Lokalizacja: "RG", "Zs [Ω]": "1,2", "Riso [MΩ]": "300" }];
    const { mapping, details } = autoMapColumns(headers, rows);
    expect(mapping.zs).toBe("Zs [Ω]");
    expect(details.zs.source).toBe("header");
    expect(details.zs.confidence).toBeGreaterThan(0.9);
  });

  it("dla nierozpoznanych parametrów zwraca jawny brak (do ręcznego wskazania)", () => {
    const { mapping, details } = autoMapColumns(["X"], [{ X: "???" }]);
    expect(mapping.zs).toBeNull();
    expect(details.zs.source).toBe("none");
    expect(details.zs.reason).toContain("ręcznie");
  });

  it("wynik auto-mapowania produkuje poprawne punkty pomiarowe", () => {
    const { mapping } = autoMapColumns(anonHeaders, anonRows);
    const { points } = rowsToPoints(anonRows, mapping);
    expect(points).toHaveLength(4);
    expect(points[0].code).toBe("LP-01");
    expect(points[0].zsOhm).toBe(1.94);
    expect(points[0].protection.curve).toBe("B");
    expect(points[0].protection.inA).toBe(16);
  });
});

describe("looksHeaderless", () => {
  it("wykrywa plik bez wiersza nagłówkowego", () => {
    expect(looksHeaderless(["LP-01", "Rozdzielnia", "16", "1,94"])).toBe(true);
  });
  it("nie myli prawidłowych nagłówków z danymi", () => {
    expect(looksHeaderless(["Lp", "Lokalizacja", "Zs [Ω]", "Riso [MΩ]"])).toBe(false);
  });
});

describe("profileColumn", () => {
  it("liczy statystyki rozpoznawcze kolumny", () => {
    const p = profileColumn("x", ["1,94", "0,58", "2,36", ""]);
    expect(p.count).toBe(3);
    expect(p.numericRatio).toBe(1);
    expect(p.decimalsRatio).toBe(1);
    expect(p.min).toBe(0.58);
    expect(p.max).toBe(2.36);
  });
});

describe("rowsToPoints", () => {
  it("buduje punkty i normalizuje wartości", () => {
    const rows = [
      { Lp: "LP-01", Lokalizacja: "RG", "Charakterystyka": "B", "In [A]": "16", "Zs [Ω]": "1,94 Ω", "Riso [MΩ]": "220" },
      { Lp: "", Lokalizacja: "Pusty" },
    ];
    const mapping = { code: "Lp", location: "Lokalizacja", breakerCurve: "Charakterystyka", breakerIn: "In [A]", zs: "Zs [Ω]", riso: "Riso [MΩ]" };
    const { points, errors } = rowsToPoints(rows, mapping as never);
    expect(points).toHaveLength(1);
    expect(points[0].zsOhm).toBe(1.94);
    expect(points[0].protection.curve).toBe("B");
    expect(errors).toHaveLength(1); // pusty wiersz raportowany, nie pomijany po cichu
  });
});

/* ---------------- Smart Compare+ ---------------- */

describe("compareHistory", () => {
  const history = [
    { date: "2023-01-01", values: { A: 1.0 } },
    { date: "2024-01-01", values: { A: 1.02 } },
    { date: "2025-01-01", values: { A: 1.06 } },
    { date: "2026-01-01", values: { A: 1.1 } },
  ];

  it("odmawia porównania przy < 3 seriach (uczciwe ograniczenie)", () => {
    const cmp = compareHistory(history.slice(0, 2), "A");
    expect(cmp.comparable).toBe(false);
    expect(cmp.note).toContain("Za mało pomiarów");
  });

  it("liczy trend i rozpoznaje wzrost", () => {
    const cmp = compareHistory(history, "A");
    expect(cmp.comparable).toBe(true);
    expect(cmp.trendPct).toBeCloseTo(10, 1);
    expect(cmp.note).toContain("Wzrost");
  });

  it("uznaje zmiany < 5% za stabilne", () => {
    const stable = history.map((h) => ({ ...h, values: { A: 1.0 } }));
    const cmp = compareHistory(stable, "A");
    expect(cmp.note).toContain("stabilne");
  });
});

/* ---------------- Eksport CSV (tryb terenowy) ---------------- */

describe("pointsToCsv", () => {
  it("tworzy nagłówek i wiersze zgodne z mapowaniem importu", () => {
    const csv = pointsToCsv([basePoint]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Zs [Ω]");
    expect(lines[0]).toContain("Punkt");
    expect(lines[1]).toContain("T-01");
    expect(lines[1]).toContain("1,5"); // przecinki dziesiętne
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM dla Excela
  });

  it("escapuje średniki i cudzysłowy w komórkach", () => {
    const csv = pointsToCsv([{ ...basePoint, location: 'Strefa "A"; północ' }]);
    expect(csv).toContain('"Strefa ""A""; północ"');
  });

  it("braki danych → puste komórki", () => {
    const csv = pointsToCsv([{ ...basePoint, zsOhm: null, rcdTripMs: null }]);
    const cells = csv.trim().split("\n")[1].split(";");
    expect(cells[6]).toBe(""); // Zs
  });

  it("eksport jest kompatybilny z rowsToPoints (round-trip przez guessColumnMapping)", () => {
    const csv = pointsToCsv(DEMO_POINTS.slice(0, 5));
    const lines = csv.trim().split("\n");
    const headers = lines[0].replace("﻿", "").split(";");
    const map = guessColumnMapping(headers);
    expect(map.code).toBe("Punkt");
    expect(map.zs).toBe("Zs [Ω]");
    expect(map.riso).toBe("Riso [MΩ]");
  });
});

/* ---------------- Integralność ---------------- */

describe("sha256Hex", () => {
  it("zwraca deterministyczny 64-znakowy skrót hex", async () => {
    const h1 = await sha256Hex("diagolab-test");
    const h2 = await sha256Hex("diagolab-test");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rozróżnia pojedynczy bit różnicy", async () => {
    const h1 = await sha256Hex("raport-1");
    const h2 = await sha256Hex("raport-2");
    expect(h1).not.toBe(h2);
  });
});
