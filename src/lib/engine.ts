/**
 * DiagoLAB Raporty+ — SILNIK OBLICZENIOWY (MODUŁ A)
 * ==================================================
 * Izomorficzny (serwer + przeglądarka), bez zależności Node.
 *
 * Odpowiada wyłącznie za:
 *  - normalizację jednostek i formatów liczbowych,
 *  - walidację danych wejściowych,
 *  - obliczenia (limity impedancji, progi RCD itd.),
 *  - porównanie wyników z kryteriami,
 *  - określenie stanu danych (OK / OSTRZEŻENIE / KRYTYCZNE / BRAK).
 *
 * Silnik NIE generuje narracji — to zadanie Modułu B (AI),
 * który nie może zmieniać wyników ani potwierdzać bezpieczeństwa.
 * Kryteria wg PN-HD 60364-6 (pomiary weryfikacyjne instalacji nn).
 */

import { ALGORITHM_VERSION, CRITERIA_SET } from "@/config/brand";

export { ALGORITHM_VERSION, CRITERIA_SET };

/* ------------------------------------------------------------------ */
/*  Typy danych                                                        */
/* ------------------------------------------------------------------ */

export type MeasureStatus = "OK" | "WARNING" | "CRITICAL" | "MISSING";
export type FindingCategory = "KRYTYCZNE" | "OSTRZEŻENIE" | "ZALECENIE" | "INFORMACJA";

export type BreakerCurve = "B" | "C" | "D";

export interface Protection {
  /** Charakterystyka wyłącznika nadmiarowoprądowego */
  curve: BreakerCurve;
  /** Prąd znamionowy [A] */
  inA: number;
  /** Prąd różnicowy RCD [mA] — jeśli obwód objęty ochroną różnicowoprądową */
  rcdmA?: number | null;
}

export interface RawPoint {
  code: string;            // oznaczenie punktu pomiarowego, np. LP-03
  location: string;        // pomieszczenie / strefa
  circuit: string;         // nazwa obwodu
  protection: Protection;
  /** Impedancja pętli zwarcia Zs [Ω] */
  zsOhm?: number | null;
  /** Rezystancja izolacji [MΩ] (napięcie pomiarowe 500 V DC) */
  risoMOhm?: number | null;
  /** Ciągłość przewodu ochronnego [Ω] */
  continuityOhm?: number | null;
  /** Czas zadziałania RCD przy 1×IΔn [ms] */
  rcdTripMs?: number | null;
  /** Prąd wyzwalania RCD [mA] */
  rcdTripmA?: number | null;
}

export interface MeasureVerdict {
  value: number | null;
  unit: string;
  limit: number | null;
  limitText: string;
  criterion: string;
  status: MeasureStatus;
}

export interface PointEval {
  point: RawPoint;
  zs: MeasureVerdict;
  riso: MeasureVerdict;
  continuity: MeasureVerdict;
  rcdTime: MeasureVerdict | null;
  rcdCurrent: MeasureVerdict | null;
  overall: MeasureStatus;
}

export interface Finding {
  id: string;
  pointCode: string;
  category: FindingCategory;
  parameter: string;
  result: string;
  criterion: string;
  cause: string;
  action: string;
}

export interface AnalysisResult {
  algorithmVersion: string;
  criteriaSet: string;
  points: PointEval[];
  summary: {
    total: number;
    ok: number;
    warning: number;
    critical: number;
    missing: number;
    rcdProtected: number;
  };
  findings: Finding[];
  verdictCounts: Record<MeasureStatus, number>;
}

export interface HistorySample {
  date: string; // ISO
  values: Record<string, number | null>; // pointCode -> Zs [Ω]
}

/* ------------------------------------------------------------------ */
/*  Kryteria graniczne                                                 */
/* ------------------------------------------------------------------ */

/** Współczynnik prądu wyzwalania magnetycznego wg charakterystyki. */
export function curveMultiplier(curve: BreakerCurve): number {
  switch (curve) {
    case "B": return 5;
    case "C": return 10;
    case "D": return 20;
  }
}

/** Maksymalna dopuszczalna impedancja pętli zwarcia: Zs ≤ Uo / Ia. */
export function zsLimitOhm(protection: Protection, uoV = 230): number {
  const ia = curveMultiplier(protection.curve) * protection.inA;
  return +(uoV / ia).toFixed(3);
}

/** Progi wg rodzaju pomiaru (PN-HD 60364-6, instalacja 230/400 V). */
export const THRESHOLDS = {
  risoMinMOhm: 1.0,          // Riso ≥ 1 MΩ przy 500 V DC
  risoWarnBand: 1.5,         // strefa "blisko progu"
  continuityMaxOhm: 1.0,     // ciągłość przewodu ochronnego
  continuityWarnOhm: 0.7,
  rcdTimeMaxMs: 300,         // czas zadziałania przy 1×IΔn (typ ogólny)
  rcdTimeWarnRatio: 0.8,     // ostrzeżenie powyżej 80% limitu
  rcdTripLowRatio: 0.5,      // RCD nie może zadziałać poniżej 0,5×IΔn
  zsWarnRatio: 0.9,          // ostrzeżenie powyżej 90% limitu Zs
} as const;

/* ------------------------------------------------------------------ */
/*  Normalizacja jednostek i formatów                                  */
/* ------------------------------------------------------------------ */

const UNIT_SCALE: Record<string, number> = {
  "mω": 0.001, "mohm": 0.001,
  "kω": 1000, "kohm": 1000,
  "ms": 1, "s": 1000,
  "ma": 1, "a": 1000,
  "ω": 1, "ohm": 1,
};

/**
 * Parsuje liczby w formatach polskich i technicznych:
 * "0,42 Ω" → 0.42 | "1,2 kΩ" → 1200 | "254 ms" → 254 | ">550 MΩ" → 550
 *
 * Zasady bezpieczeństwa:
 *  - sufiksy dopasowywane od najdłuższego (inaczej "kΩ" przegrałby z "Ω"),
 *  - rozróżnienie WIELKOŚCI liter: MΩ (megaom — izolacja) ≠ mΩ (milioom),
 *  - przekroczenie zakresu miernika ">550" przyjmujemy jako dolną granicę.
 */
export function parseLocalizedNumber(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let raw = String(input).trim();
  if (!raw || ["-", "—", "brak", "b/d"].includes(raw.toLowerCase())) return null;

  // Zakres miernika przekroczony: traktujemy wartość graniczną jako wynik.
  raw = raw.replace(/^>|^≥/, "").trim();

  let scale = 1;
  const mega = raw.match(/(MΩ|MOhm)$/); // megaom — case-sensitive (izolacja w MΩ)
  if (mega) {
    raw = raw.slice(0, -mega[0].length);
  } else {
    const lower = raw.toLowerCase();
    const sorted = Object.entries(UNIT_SCALE).sort((a, b) => b[0].length - a[0].length);
    for (const [suffix, factor] of sorted) {
      if (lower.endsWith(suffix)) {
        scale = factor;
        raw = raw.slice(0, -suffix.length);
        break;
      }
    }
  }

  const s = raw.replace(/\s+/g, "").replace(",", ".");
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return +(n * scale).toFixed(4);
}

/* ------------------------------------------------------------------ */
/*  Ocena pojedynczego punktu                                          */
/* ------------------------------------------------------------------ */

const C = {
  ZS: "Zs ≤ Uo/Ia — samoczynne wyłączenie zasilania (PN-HD 60364-6, tab. 41.3)",
  RISO: "Riso ≥ 1 MΩ przy 500 V DC dla obwodów 230/400 V (PN-HD 60364-6, tab. 6.1)",
  CONT: "Ciągłość przewodu ochronnego potwierdzona pomiarem (R ≤ 1 Ω)",
  RCD_T: "Czas zadziałania RCD ≤ 300 ms przy 1×IΔn (typ ogólny)",
  RCD_I: "Wyzwolenie RCD w przedziale 0,5×IΔn ÷ 1×IΔn",
};

function worst(a: MeasureStatus, b: MeasureStatus): MeasureStatus {
  const rank: Record<MeasureStatus, number> = { OK: 0, WARNING: 1, MISSING: 2, CRITICAL: 3 };
  return rank[a] >= rank[b] ? a : b;
}

export function evaluatePoint(point: RawPoint): PointEval {
  const zsLimit = zsLimitOhm(point.protection);

  const zs: MeasureVerdict = point.zsOhm == null
    ? { value: null, unit: "Ω", limit: zsLimit, limitText: `≤ ${zsLimit} Ω`, criterion: C.ZS, status: "MISSING" }
    : {
        value: point.zsOhm, unit: "Ω", limit: zsLimit,
        limitText: `≤ ${zsLimit} Ω`, criterion: C.ZS,
        status: point.zsOhm > zsLimit ? "CRITICAL" : point.zsOhm > zsLimit * THRESHOLDS.zsWarnRatio ? "WARNING" : "OK",
      };

  const riso: MeasureVerdict = point.risoMOhm == null
    ? { value: null, unit: "MΩ", limit: THRESHOLDS.risoMinMOhm, limitText: `≥ ${THRESHOLDS.risoMinMOhm} MΩ`, criterion: C.RISO, status: "MISSING" }
    : {
        value: point.risoMOhm, unit: "MΩ", limit: THRESHOLDS.risoMinMOhm,
        limitText: `≥ ${THRESHOLDS.risoMinMOhm} MΩ`, criterion: C.RISO,
        status: point.risoMOhm < THRESHOLDS.risoMinMOhm ? "CRITICAL" : point.risoMOhm < THRESHOLDS.risoWarnBand ? "WARNING" : "OK",
      };

  const continuity: MeasureVerdict = point.continuityOhm == null
    ? { value: null, unit: "Ω", limit: THRESHOLDS.continuityMaxOhm, limitText: `≤ ${THRESHOLDS.continuityMaxOhm} Ω`, criterion: C.CONT, status: "MISSING" }
    : {
        value: point.continuityOhm, unit: "Ω", limit: THRESHOLDS.continuityMaxOhm,
        limitText: `≤ ${THRESHOLDS.continuityMaxOhm} Ω`, criterion: C.CONT,
        status: point.continuityOhm > THRESHOLDS.continuityMaxOhm ? "CRITICAL" : point.continuityOhm > THRESHOLDS.continuityWarnOhm ? "WARNING" : "OK",
      };

  let rcdTime: MeasureVerdict | null = null;
  let rcdCurrent: MeasureVerdict | null = null;
  if (point.protection.rcdmA) {
    const idn = point.protection.rcdmA;
    rcdTime = point.rcdTripMs == null
      ? { value: null, unit: "ms", limit: THRESHOLDS.rcdTimeMaxMs, limitText: `≤ ${THRESHOLDS.rcdTimeMaxMs} ms`, criterion: C.RCD_T, status: "MISSING" }
      : {
          value: point.rcdTripMs, unit: "ms", limit: THRESHOLDS.rcdTimeMaxMs,
          limitText: `≤ ${THRESHOLDS.rcdTimeMaxMs} ms`, criterion: C.RCD_T,
          status: point.rcdTripMs > THRESHOLDS.rcdTimeMaxMs ? "CRITICAL" : point.rcdTripMs > THRESHOLDS.rcdTimeMaxMs * THRESHOLDS.rcdTimeWarnRatio ? "WARNING" : "OK",
        };
    const lowLim = +(idn * THRESHOLDS.rcdTripLowRatio).toFixed(1);
    rcdCurrent = point.rcdTripmA == null
      ? { value: null, unit: "mA", limit: idn, limitText: `${lowLim}–${idn} mA`, criterion: C.RCD_I, status: "MISSING" }
      : {
          value: point.rcdTripmA, unit: "mA", limit: idn,
          limitText: `${lowLim}–${idn} mA`, criterion: C.RCD_I,
          status: point.rcdTripmA > idn || point.rcdTripmA < lowLim
            ? "CRITICAL"
            : point.rcdTripmA > idn * THRESHOLDS.zsWarnRatio ? "WARNING" : "OK",
        };
  }

  let overall: MeasureStatus = "OK";
  for (const v of [zs, riso, continuity, rcdTime, rcdCurrent]) {
    if (!v) continue;
    if (v.status === "CRITICAL") overall = "CRITICAL";
    else overall = worst(overall, v.status);
  }
  if (overall !== "CRITICAL" && overall !== "WARNING") {
    const anyMissing = [zs, riso, continuity].some((v) => v.status === "MISSING");
    if (anyMissing) overall = "MISSING";
  }

  return { point, zs, riso, continuity, rcdTime, rcdCurrent, overall };
}

/* ------------------------------------------------------------------ */
/*  Analiza zbiorcza                                                   */
/* ------------------------------------------------------------------ */

function findingFromVerdict(p: RawPoint, parameter: string, v: MeasureVerdict, label: string): Finding | null {
  const fmt = (n: number | null) => (n === null ? "brak danych" : `${String(n).replace(".", ",")} ${v.unit}`);
  if (v.status === "CRITICAL") {
    return {
      id: `F-${p.code}-${parameter}`,
      pointCode: p.code,
      category: "KRYTYCZNE",
      parameter: label,
      result: `Wynik: ${fmt(v.value)} · Kryterium: ${v.limitText}`,
      criterion: v.criterion,
      cause: causeFor(parameter),
      action: actionFor(parameter),
    };
  }
  if (v.status === "WARNING") {
    return {
      id: `F-${p.code}-${parameter}`,
      pointCode: p.code,
      category: "OSTRZEŻENIE",
      parameter: label,
      result: `Wynik: ${fmt(v.value)} · Kryterium: ${v.limitText}`,
      criterion: v.criterion,
      cause: causeFor(parameter, true),
      action: actionFor(parameter, true),
    };
  }
  return null;
}

function causeFor(parameter: string, mild = false): string {
  switch (parameter) {
    case "ZS": return "Przekroczona impedancja pętli zwarcia — przy zwarciu zabezpieczenie może nie wyłączyć zasilania w wymaganym czasie.";
    case "RISO": return mild ? "Rezystancja izolacji bliska progu — możliwy początek degradacji izolacji lub wpływ wilgoci." : "Rezystancja izolacji poniżej minimum — ryzyko prądu upływowego i uszkodzenia izolacji.";
    case "CONT": return "Podwyższona rezystancja ciągłości PE — możliwe poluzowane lub skorodowane złącze na trasie przewodu ochronnego.";
    case "RCD_T": return "Czas zadziałania RCD w strefie granicznej — zalecana weryfikacja przyrządem i kontrola stanu wyłącznika różnicowoprądowego.";
    case "RCD_I": return "Prąd wyzwalania RCD poza przedziałem dopuszczalnym — ochrona różnicowoprądowa może działać niezgodnie z parametrami.";
    default: return "—";
  }
}

function actionFor(parameter: string, mild = false): string {
  switch (parameter) {
    case "ZS": return "Sprawdzić trasę obwodu (długość, przekrój, jakość połączeń). Rozważyć wymianę zabezpieczenia na niższy prąd znamionowy lub zastosowanie RCD jako ochrony uzupełniającej. Powtórzyć pomiar po korekcie.";
    case "RISO": return mild ? "Zaplanować kontrolny pomiar izolacji w ciągu 6 miesięcy; sprawdzić osłony przewodów i zawilgocenie puszek." : "Zlokalizować odcinek uszkodzonej izolacji metodą podziału obwodu; usunąć przyczynę; powtórzyć pomiar przed dalszą eksploatacją.";
    case "CONT": return "Dokręcić złącza przewodu ochronnego, oczyścić styki, wykonać pomiar kontrolny ciągłości.";
    case "RCD_T": return "Wykonać pełny test RCD (0,5×IΔn / 1×IΔn / 5×IΔn); przy powtarzalnym wyniku granicznym rozważyć wymianę wyłącznika różnicowoprądowego.";
    case "RCD_I": return "Zweryfikować wynik drugim przyrządem; jeśli potwierdzi się — wyłącznik RCD wymaga wymiany.";
    default: return "—";
  }
}

export function analyzePoints(points: RawPoint[]): AnalysisResult {
  const evals = points.map(evaluatePoint);

  const summary = { total: evals.length, ok: 0, warning: 0, critical: 0, missing: 0, rcdProtected: 0 };
  const verdictCounts: Record<MeasureStatus, number> = { OK: 0, WARNING: 0, CRITICAL: 0, MISSING: 0 };
  const findings: Finding[] = [];

  for (const ev of evals) {
    verdictCounts[ev.overall] += 1;
    if (ev.overall === "OK") summary.ok++;
    else if (ev.overall === "WARNING") summary.warning++;
    else if (ev.overall === "CRITICAL") summary.critical++;
    else summary.missing++;
    if (ev.point.protection.rcdmA) summary.rcdProtected++;

    const f1 = findingFromVerdict(ev.point, "ZS", ev.zs, "Impedancja pętli zwarcia Zs");
    const f2 = findingFromVerdict(ev.point, "RISO", ev.riso, "Rezystancja izolacji");
    const f3 = findingFromVerdict(ev.point, "CONT", ev.continuity, "Ciągłość przewodu ochronnego");
    const f4 = ev.rcdTime ? findingFromVerdict(ev.point, "RCD_T", ev.rcdTime, "Czas zadziałania RCD") : null;
    const f5 = ev.rcdCurrent ? findingFromVerdict(ev.point, "RCD_I", ev.rcdCurrent, "Prąd wyzwalania RCD") : null;
    for (const f of [f1, f2, f3, f4, f5]) if (f) findings.push(f);

    if ([ev.zs, ev.riso, ev.continuity].some((v) => v.status === "MISSING")) {
      findings.push({
        id: `F-${ev.point.code}-MISSING`,
        pointCode: ev.point.code,
        category: "INFORMACJA",
        parameter: "Kompletność danych",
        result: "Brak części pomiarów dla punktu",
        criterion: "Raport wymaga kompletu Zs / Riso / ciągłość",
        cause: "Nie wykonano pełnego zakresu lub dane nie zostały zaimportowane.",
        action: "Uzupełnić dane pomiarowe przed zatwierdzeniem oceny końcowej.",
      });
    }
  }

  // Zalecenia wynikające z kontekstu (deterministyczne — Moduł A)
  if (summary.critical > 0) {
    findings.push({
      id: "F-GEN-CRIT",
      pointCode: "—",
      category: "ZALECENIE",
      parameter: "Priorytet działań",
      result: `${summary.critical} pkt. z nieprawidłowością krytyczną`,
      criterion: "Ocena końcowa wymaga usunięcia nieprawidłowości krytycznych",
      cause: "Wyniki poza kryteriami bezpieczeństwa.",
      action: "Usunąć nieprawidłowości krytyczne przed zatwierdzeniem raportu; obwody oznaczyć jako wyłączone z eksploatacji do czasu korekty.",
    });
  }
  if (summary.missing > 0) {
    findings.push({
      id: "F-GEN-MISS",
      pointCode: "—",
      category: "ZALECENIE",
      parameter: "Zakres badań",
      result: `${summary.missing} pkt. z niekompletnymi danymi`,
      criterion: "Kompletny zakres pomiarów weryfikacyjnych",
      cause: "Pomiary częściowe.",
      action: "Uzupełnić zakres badań lub uzasadnić ograniczenie zakresu w raporcie.",
    });
  }

  return { algorithmVersion: ALGORITHM_VERSION, criteriaSet: CRITERIA_SET, points: evals, summary, findings, verdictCounts };
}

/* ------------------------------------------------------------------ */
/*  Integralność danych — SHA-256 (izomorficzne)                       */
/* ------------------------------------------------------------------ */

export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ */
/*  Mapowanie kolumn importu (CSV/XLSX)                                */
/* ------------------------------------------------------------------ */

export interface ColumnSpec {
  key: string;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const IMPORT_COLUMNS: ColumnSpec[] = [
  { key: "code", label: "Punkt / oznaczenie", required: true, synonyms: ["lp", "pkt", "punkt", "oznaczenie", "nr", "code", "id"] },
  { key: "location", label: "Lokalizacja", required: true, synonyms: ["lokalizacja", "pomieszczenie", "strefa", "miejsce", "location"] },
  { key: "circuit", label: "Obwód", required: false, synonyms: ["obwod", "obwód", "circuit", "nazwa obwodu"] },
  { key: "breakerCurve", label: "Charakterystyka zabezpieczenia", required: true, synonyms: ["charakterystyka", "krzywa", "curve", "typ"] },
  { key: "breakerIn", label: "Prąd znamionowy [A]", required: true, synonyms: ["in", "prad znamionowy", "prąd znamionowy", "a", "in[a]", "breaker"] },
  { key: "rcdmA", label: "IΔn RCD [mA]", required: false, synonyms: ["idn", "rcd", "iδn", "rcd[ma]", "prad roznicowy"] },
  { key: "zs", label: "Zs [Ω]", required: true, synonyms: ["zs", "z s", "impedancja", "petla zwarcia", "pętla zwarcia", "zs[ω]", "zs[ohm]"] },
  { key: "riso", label: "Riso [MΩ]", required: true, synonyms: ["riso", "r iso", "izolacja", "rezystancja izolacji", "riso[mω]", "iso"] },
  { key: "continuity", label: "Ciągłość PE [Ω]", required: false, synonyms: ["ciaglosc", "ciągłość", "rpe", "pe", "continuity", "przewod ochronny", "rkont", "r kont", "rcont", "200ma", "ochronny"] },
  { key: "rcdTime", label: "Czas RCD [ms]", required: false, synonyms: ["rcd t", "czas rcd", "t ia", "czas wyzwalania", "rcdtime", "t[ms]"] },
  { key: "rcdCurrent", label: "Prąd wyzwalania RCD [mA]", required: false, synonyms: ["rcd i", "prad wyzwalania", "prąd wyzwalania", "rcdcurrent", "ia[ma]"] },
];

/* ------------------------------------------------------------------ */
/*  Autonomiczne rozpoznawanie kolumn — profilowanie wartości          */
/* ------------------------------------------------------------------ */

/** Znormalizowany „odcisk palca" kolumny, liczony z jej wartości. */
export interface ColumnProfile {
  header: string;
  count: number;          // niepuste komórki
  numericRatio: number;   // udział wartości liczbowych
  min: number | null;
  max: number | null;
  median: number | null;
  decimalsRatio: number;  // udział wartości ułamkowych
  uniqueRatio: number;    // unikalność (1 = same unikaty)
  codeLike: number;       // udział wzorców typu "LP-01", "A12"
  curveLike: number;      // udział wartości B / C / D (ew. "B16")
  textRatio: number;      // udział wartości nieliczbowych
  values: number[];       // znormalizowane wartości liczbowe
}

const STD_BREAKER_IN = [2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160];
const STD_RCD = [6, 10, 30, 100, 300, 500, 1000];

/**
 * Czy nagłówek faktycznie OPISUJE kolumnę?
 * Etykiety arkuszowe („A”, „Kolumna 3”, „__4”, „7”) nie niosą znaczenia —
 * dla nich pomijamy dopasowanie po nazwie i przechodzimy od razu do
 * rozpoznawania po wartościach.
 */
export function isDescriptiveHeader(header: string): boolean {
  const h = header.trim();
  if (!h) return false;
  if (/^[A-Za-z]$/.test(h)) return false;                        // A, B, C…
  if (/^[A-Za-z]{1,2}\d{1,3}$/.test(h)) return false;            // A1, AB12 (etykiety arkusza)
  if (/^(kolumna|column|col|field|pole)[\s_-]*\d+$/i.test(h)) return false;
  if (/^_+\d*$/.test(h)) return false;
  if (parseLocalizedNumber(h) !== null) return false;            // nagłówek liczbowy = dane
  return true;
}

export function profileColumn(header: string, values: unknown[]): ColumnProfile {
  const raw = values.map((v) => (v === null || v === undefined ? "" : String(v).trim())).filter((v) => v !== "");
  const nums = raw.map((v) => parseLocalizedNumber(v)).filter((n): n is number => n !== null);
  const sorted = [...nums].sort((a, b) => a - b);
  const codeRe = /^[A-Za-zĄĆĘŁŃÓŚŹŻ]{1,5}[-_/ ]?\d{1,4}$/;
  const curveRe = /^[BCD]\s?\d{0,3}$/i;

  return {
    header,
    count: raw.length,
    numericRatio: raw.length ? nums.length / raw.length : 0,
    min: sorted.length ? sorted[0] : null,
    max: sorted.length ? sorted[sorted.length - 1] : null,
    median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    decimalsRatio: nums.length ? nums.filter((n) => !Number.isInteger(n)).length / nums.length : 0,
    uniqueRatio: raw.length ? new Set(raw).size / raw.length : 0,
    codeLike: raw.length ? raw.filter((v) => codeRe.test(v)).length / raw.length : 0,
    curveLike: raw.length ? raw.filter((v) => curveRe.test(v)).length / raw.length : 0,
    textRatio: raw.length ? 1 - nums.length / raw.length : 0,
    values: nums,
  };
}

/**
 * Ocena dopasowania kolumny do danego parametru WYŁĄCZNIE na podstawie
 * wartości (gdy nagłówek nic nie mówi lub go brak). Zwraca 0–1.
 * Progi wynikają z typowych zakresów pomiarów instalacji nn 230/400 V.
 */
export function scoreByValues(key: string, p: ColumnProfile): number {
  const inRange = (lo: number, hi: number) => p.min !== null && p.max !== null && p.min >= lo && p.max <= hi;
  const medianIn = (lo: number, hi: number) => p.median !== null && p.median >= lo && p.median <= hi;
  /** Wszystkie wartości pochodzą z typoszeregu (rozstrzyga RCD vs rezystancja). */
  const allFrom = (set: number[]) =>
    p.numericRatio > 0.9 && p.values.length > 0 && p.values.every((v) => set.includes(Math.round(v)));

  switch (key) {
    case "code":
      return p.codeLike > 0.7 && p.uniqueRatio > 0.8 ? 0.9 : p.uniqueRatio > 0.9 && p.textRatio > 0.5 ? 0.55 : 0;
    case "location":
      return p.textRatio > 0.8 && p.codeLike < 0.3 && p.uniqueRatio <= 0.95 ? 0.6 : 0;
    case "circuit":
      return p.textRatio > 0.8 && p.codeLike < 0.3 ? 0.45 : 0;
    case "breakerCurve":
      return p.curveLike > 0.8 ? 0.95 : 0;
    case "breakerIn":
      // Prąd znamionowy: wyłącznie wartości z typoszeregu wyłączników
      return allFrom(STD_BREAKER_IN) && p.decimalsRatio < 0.1 && !allFrom(STD_RCD) ? 0.88 : 0;
    case "rcdmA":
      // IΔn: wyłącznie wartości z typoszeregu RCD (rozstrzyga kolizję z Riso)
      return allFrom(STD_RCD) && p.decimalsRatio < 0.1 ? 0.9 : 0;
    case "zs":
      // Impedancja pętli: ułamkowa, typowo 0,05–20 Ω
      return p.numericRatio > 0.8 && inRange(0.01, 25) && medianIn(0.1, 10) && p.decimalsRatio > 0.5 ? 0.85 : 0;
    case "riso":
      // Rezystancja izolacji: duże wartości (MΩ), rozkład ciągły — nie typoszereg RCD
      if (allFrom(STD_RCD)) return 0;
      return p.numericRatio > 0.8 && medianIn(20, 100000) ? 0.85 : p.numericRatio > 0.8 && inRange(0.1, 1000) && medianIn(5, 1000) ? 0.5 : 0;
    case "continuity":
      // Ciągłość PE: bardzo małe wartości, ALE mierniki rzucają np. ">1999" (poza zakresem).
      // Zamiast sztywnego inRange na MAX, patrzymy na medianę i obecność ułamków/zera.
      return p.numericRatio > 0.7 && medianIn(0, 10) && (p.decimalsRatio > 0.3 || p.median === 0) && !allFrom(STD_RCD) ? 0.8 : 0;
    case "rcdTime":
      // Czas zadziałania RCD: 5–500 ms, zwykle całkowite
      return p.numericRatio > 0.8 && inRange(1, 600) && medianIn(8, 400) && p.decimalsRatio < 0.35 ? 0.65 : 0;
    case "rcdCurrent":
      // Prąd wyzwalania RCD: 5–500 mA, często ułamkowy (np. 19,8)
      return p.numericRatio > 0.8 && inRange(1, 600) && medianIn(8, 400) && p.decimalsRatio >= 0.35 ? 0.7 : 0;
    default:
      return 0;
  }
}

export type MappingSource = "header" | "values" | "manual" | "none";

export interface MappingDetail {
  source: MappingSource;
  confidence: number; // 0–1
  reason: string;
}

export interface AutoMapResult {
  mapping: Record<string, string | null>;
  details: Record<string, MappingDetail>;
}

/**
 * Wykrywa, czy wiersz nagłówkowy w rzeczywistości zawiera dane
 * (plik bez nagłówków) — wtedy warto wczytać go ponownie bez nagłówka.
 */
export function looksHeaderless(headers: string[]): boolean {
  if (!headers.length) return false;
  const dataLike = headers.filter((h) => {
    const t = h.trim();
    return parseLocalizedNumber(t) !== null || /^[A-Za-z]{1,5}[-_/ ]?\d{1,4}$/.test(t);
  }).length;
  return dataLike / headers.length >= 0.5;
}

/**
 * Pełne, autonomiczne mapowanie kolumn:
 *  1) dopasowanie po OPISIE kolumny (nagłówek + synonimy),
 *  2) uzupełnienie braków po WARTOŚCIACH (profilowanie statystyczne),
 *  3) wynik zawiera źródło i pewność — użytkownik może wszystko nadpisać.
 */
export function autoMapColumns(headers: string[], rows: Record<string, unknown>[]): AutoMapResult {
  const byHeader = guessColumnMapping(headers);
  const mapping: Record<string, string | null> = { ...byHeader };
  const details: Record<string, MappingDetail> = {};
  const used = new Set(Object.values(byHeader).filter(Boolean) as string[]);

  for (const col of IMPORT_COLUMNS) {
    if (mapping[col.key]) {
      details[col.key] = { source: "header", confidence: 0.95, reason: `Rozpoznano po nazwie kolumny „${mapping[col.key]}”.` };
    }
  }

  // Profilowanie kolumn nieprzypisanych
  const profiles = new Map<string, ColumnProfile>();
  for (const h of headers) {
    if (used.has(h)) continue;
    profiles.set(h, profileColumn(h, rows.map((r) => r[h])));
  }

  // Zachłanne dopasowanie: najpierw pary o najwyższym wyniku
  type Cand = { key: string; header: string; score: number };
  const candidates: Cand[] = [];
  for (const col of IMPORT_COLUMNS) {
    if (mapping[col.key]) continue;
    for (const [h, p] of profiles) {
      const score = scoreByValues(col.key, p);
      if (score > 0) candidates.push({ key: col.key, header: h, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  for (const c of candidates) {
    if (mapping[c.key] || used.has(c.header)) continue;
    mapping[c.key] = c.header;
    used.add(c.header);
    const p = profiles.get(c.header)!;
    const zakres = p.min !== null && p.max !== null ? `zakres ${p.min}–${p.max}` : "wartości tekstowe";
    details[c.key] = {
      source: "values",
      confidence: c.score,
      reason: `Rozpoznano po charakterze danych (${zakres}) — zweryfikuj przypisanie.`,
    };
  }

  for (const col of IMPORT_COLUMNS) {
    if (!details[col.key]) {
      details[col.key] = { source: "none", confidence: 0, reason: "Nie rozpoznano — wskaż kolumnę ręcznie." };
    }
  }

  return { mapping, details };
}

export function guessColumnMapping(headers: string[]): Record<string, string | null> {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" } as Record<string, string>)[c] ?? c).trim();
  const mapping: Record<string, string | null> = {};
  const used = new Set<string>();
  // Etykiety arkuszowe („A”, „Kolumna 2”) nie są opisem — pomijamy je tutaj.
  const describing = headers.filter(isDescriptiveHeader);

  /** Rozbicie nagłówka na tokeny: „Zs [Ω]” → ["zs","ω"], „In [A]” → ["in","a"]. */
  const tokens = (h: string) => norm(h).split(/[^a-z0-9ωδ]+/i).filter(Boolean);

  for (const col of IMPORT_COLUMNS) {
    mapping[col.key] = null;

    // 1) pełna zgodność nazwy
    for (const syn of col.synonyms) {
      const hit = describing.find((h) => !used.has(h) && norm(h) === norm(syn));
      if (hit) { mapping[col.key] = hit; used.add(hit); break; }
    }

    // 2) dopasowanie częściowe / sub-stringowe
    // Jeśli synonim ma spacyjną frazę (np. "przewod ochronny") lub ≥ 3 znaki,
    // szukamy go wprost jako podciągu w znormalizowanym nagłówku.
    if (!mapping[col.key]) {
      const hit = describing.find((h) =>
        !used.has(h) && col.synonyms.some((syn) => {
          const s = norm(syn);
          return (s.length >= 3 || s.includes(" ")) && norm(h).includes(s);
        })
      );
      if (hit) { mapping[col.key] = hit; used.add(hit); }
    }

    // 3) zgodność konkretnego tokenu (bezpieczna dla krótkich form: „zs”, „in”, „pe”)
    if (!mapping[col.key]) {
      const hit = describing.find(
        (h) => !used.has(h) && col.synonyms.some((syn) => tokens(h).includes(norm(syn)))
      );
      if (hit) { mapping[col.key] = hit; used.add(hit); }
    }
  }
  return mapping;
}

/** Buduje punkty pomiarowe z wierszy importu i mapowania kolumn. */
export function rowsToPoints(
  rows: Record<string, unknown>[],
  mapping: Record<string, string | null>
): { points: RawPoint[]; errors: string[] } {
  const errors: string[] = [];
  const points: RawPoint[] = [];
  const get = (row: Record<string, unknown>, key: string) => {
    const col = mapping[key];
    return col ? row[col] : undefined;
  };

  rows.forEach((row, i) => {
    const rawCode = get(row, "code");
    const rawLoc = get(row, "location");
    if (rawCode === undefined || rawCode === null || String(rawCode).trim() === "") {
      errors.push(`Wiersz ${i + 1}: brak oznaczenia punktu — wiersz pominięty.`);
      return;
    }
    const curveRaw = String(get(row, "breakerCurve") ?? "B").trim().toUpperCase();
    const curve: BreakerCurve = curveRaw.startsWith("C") ? "C" : curveRaw.startsWith("D") ? "D" : "B";
    const inA = parseLocalizedNumber(get(row, "breakerIn")) ?? 16;
    const rcdmA = parseLocalizedNumber(get(row, "rcdmA"));

    points.push({
      code: String(rawCode).trim(),
      location: rawLoc != null ? String(rawLoc).trim() : "—",
      circuit: String(get(row, "circuit") ?? "—").trim() || "—",
      protection: { curve, inA, rcdmA: rcdmA ?? null },
      zsOhm: parseLocalizedNumber(get(row, "zs")),
      risoMOhm: parseLocalizedNumber(get(row, "riso")),
      continuityOhm: parseLocalizedNumber(get(row, "continuity")),
      rcdTripMs: parseLocalizedNumber(get(row, "rcdTime")),
      rcdTripmA: parseLocalizedNumber(get(row, "rcdCurrent")),
    });
  });

  return { points, errors };
}

/** Eksport punktów pomiarowych do CSV (separator ';', przecinki dziesiętne — Excel PL). */
export function pointsToCsv(points: RawPoint[]): string {
  const header = [
    "Punkt", "Lokalizacja", "Obwód", "Charakterystyka", "In [A]", "RCD [mA]",
    "Zs [Ω]", "Riso [MΩ]", "Ciągłość PE [Ω]", "Czas RCD [ms]", "Prąd wyzwalania RCD [mA]",
  ];
  const num = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));
  const cell = (v: string) => (v.includes(";") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = points.map((p) =>
    [
      p.code, p.location, p.circuit, p.protection.curve, String(p.protection.inA),
      num(p.protection.rcdmA), num(p.zsOhm), num(p.risoMOhm), num(p.continuityOhm),
      num(p.rcdTripMs), num(p.rcdTripmA),
    ].map(cell).join(";")
  );
  // BOM — poprawne rozpoznawanie UTF-8 przez Excel.
  return "﻿" + header.join(";") + "\n" + lines.join("\n") + "\n";
}

/** Powiadomienia o zmianach trendów (Smart Compare+ — reguły podstawowe). */
export function compareHistory(
  history: HistorySample[],
  pointCode: string
): { dates: string[]; values: (number | null)[]; trendPct: number | null; comparable: boolean; note: string } {
  const dates = history.map((h) => h.date);
  const values = history.map((h) => h.values[pointCode] ?? null);
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 3) {
    return {
      dates, values, trendPct: null, comparable: false,
      note: "Za mało pomiarów historycznych dla wiarygodnego porównania (wymagane ≥ 3 serie).",
    };
  }
  const first = present[0];
  const last = present[present.length - 1];
  const trendPct = +(((last - first) / first) * 100).toFixed(1);
  return {
    dates, values, trendPct, comparable: true,
    note: Math.abs(trendPct) < 5
      ? "Wyniki stabilne — zmiana w granicach niepewności pomiaru."
      : trendPct > 0
        ? `Wzrost impedancji o ${trendPct}% względem pierwszego pomiaru — obserwować w kolejnych badaniach.`
        : `Spadek impedancji o ${Math.abs(trendPct)}% względem pierwszego pomiaru.`,
  };
}
