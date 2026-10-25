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

/**
 * Układ sieciowy instalacji — wpływa na metodę oceny impedancji pętli.
 * PN-HD 60364-1:2010, PN-HD 60364-4-41:2017
 *
 * TN-C / TN-S / TN-C-S — najczęstsze w Polsce (PEN/PE+N)
 * TT — osobne uziemienie odbiornika; ocena przez RCD (Ra × IΔn ≤ 50V)
 * IT — bez bezpośredniego połączenia z ziemią; monitoring izolacji
 */
export type NetworkSystem = "TN" | "TN-S" | "TN-C-S" | "TN-C" | "TT" | "IT";

/**
 * Typ RCD — wpływa na maksymalny czas zadziałania i zakres prądów.
 * PN-EN IEC 61008-1:2019 / PN-EN IEC 61009-1:2019
 *
 * AC  — reaguje wyłącznie na prąd przemienny sinusoidalny
 * A   — prąd przemienny + prąd pulsujący DC (wymagany w łazienkach, instalacjach PV, EV)
 * B   — prąd przemienny + pulsujący DC + stały DC (warsztaty, instalacje przemysłowe)
 * F   — prąd przemienny + DC pulsujący + prądy o częstotliwości 1kHz (AGD z inwerterami)
 * S   — selektywny z opóźnieniem (50ms) — rozdzielnice, koordynacja zabezpieczeń
 */
export type RcdType = "AC" | "A" | "B" | "F" | "S";

/**
 * Napięcie pomiarowe izolacji — wpływa na minimalny próg Riso.
 * PN-HD 60364-6:2016 Tablica 6.1
 */
export type InsulationTestVoltage = 250 | 500 | 1000;

export interface Protection {
  /** Charakterystyka wyłącznika nadmiarowoprądowego */
  curve: BreakerCurve;
  /** Prąd znamionowy [A] */
  inA: number;
  /** Prąd różnicowy RCD [mA] */
  rcdmA?: number | null;
  /** Typ wyłącznika RCD — wpływa na wymagany czas zadziałania */
  rcdType?: RcdType | null;
}

/**
 * Kontekst obwodu — parametry instalacji istotne dla oceny normatywnej.
 * Jeśli nie podano, silnik stosuje ostrożne wartości domyślne (TN, 230V).
 */
export interface CircuitContext {
  /** Układ sieciowy — domyślnie TN (najczęstszy w Polsce) */
  networkSystem?: NetworkSystem;
  /** Napięcie fazowe [V] — 230V dla sieci 230/400V */
  uoV?: number;
  /** Napięcie pomiarowe Riso [V DC] — wpływa na minimalny próg */
  insulationTestVoltageV?: InsulationTestVoltage;
  /** Obwód końcowy (gniazdo/oprawy) vs rozdzielnica — wpływa na wymagany czas wyłączenia */
  isFinalCircuit?: boolean;
  /** Napięcie nominalne obwodu [V] — dla TT/IT do obliczenia Ra */
  un?: number;
}

/**
 * Typ pomieszczenia / strefy — wpływa na zaostrzenie kryteriów.
 * PN-HD 60364 sekcje 700 (arkusze szczegółowe).
 */
export type ZoneType =
  | "STANDARD"           // pomieszczenie standardowe
  | "LAZIENKA"           // łazienka / natrysk — PN-HD 60364-7-701
  | "BASEN"              // baseny, sauny — PN-HD 60364-7-702
  | "MOKRE"              // pomieszczenia o podwyższonej wilgotności
  | "MEDYCZNE"           // pomieszczenia medyczne — PN-IEC 60364-7-710
  | "BUDOWA"             // place budowy — PN-HD 60364-7-704
  | "ROLNICTWO"          // obiekty rolnicze — PN-HD 60364-7-705
  | "EX"                 // strefy zagrożone wybuchem — PN-EN 60079
  | "ZEWNETRZNE";        // instalacje zewnętrzne

/**
 * Dane przyrządu pomiarowego — walidacja wzorcowania.
 * Zgodnie z PN-EN 61557 i wytycznymi SEP.
 */
export interface Instrument {
  name: string;          // np. "Sonel MPI-535"
  serialNo: string;      // numer seryjny
  calibrationNo: string; // nr świadectwa wzorcowania
  calibrationValidUntil: string; // ISO date
}

/**
 * Checklist oględzin — PN-HD 60364-6 pkt 6.4.1
 * Musi być wypełniony przed przystąpieniem do pomiarów.
 */
export interface InspectionChecklist {
  /** Brak widocznych uszkodzeń mechanicznych */
  noVisibleDamage: boolean;
  /** Czytelne oznaczenia obwodów w rozdzielnicach */
  circuitLabelsOk: boolean;
  /** Oznakowanie zacisków PE/N */
  peNmarkingsOk: boolean;
  /** Poprawność doboru aparatury do przekrojów */
  protectionMatchesWiring: boolean;
  /** Ciągłość wizualna połączeń wyrównawczych */
  bondingVisualOk: boolean;
  /** Obecność schematów rozdzielnic */
  schematicsPresent: boolean;
  /** Uwagi do oględzin (tekst swobodny) */
  notes?: string;
}

export interface RawPoint {
  code: string;
  location: string;
  circuit: string;
  protection: Protection;
  /** Kontekst normatywny obwodu — opcjonalny, domyślnie TN 230V */
  context?: CircuitContext;
  /** Typ pomieszczenia/strefy — wpływa na zaostrzenie wymagań */
  zoneType?: ZoneType;

  /** Impedancja pętli zwarcia Zs [Ω] — PN-HD 60364-6:2016 */
  zsOhm?: number | null;
  /** Rezystancja uziemienia Ra [Ω] — tylko dla układu TT */
  raOhm?: number | null;
  /** Rezystancja izolacji [MΩ] — PN-HD 60364-6:2016 Tab. 6.1 */
  risoMOhm?: number | null;
  /** Napięcie pomiarowe Riso rzeczywiście użyte [V DC] */
  risoTestVoltageV?: InsulationTestVoltage | null;
  /** Ciągłość przewodu ochronnego [Ω] — SEP-E-004 */
  continuityOhm?: number | null;
  /** Czas zadziałania RCD przy 1×IΔn [ms] — PN-EN IEC 61008-1 */
  rcdTripMs?: number | null;
  /** Prąd wyzwalania RCD [mA] */
  rcdTripmA?: number | null;
  /** Czas zadziałania przy 2×IΔn [ms] — dla weryfikacji selektywności */
  rcdTrip2xMs?: number | null;
  /** Czas zadziałania przy 5×IΔn [ms] — wymagany dla typu S */
  rcdTrip5xMs?: number | null;
  /** Napięcie dotykowe oczekiwane Uc [V] — obliczane lub mierzone */
  touchVoltageV?: number | null;
  /** Wynik testu mechanicznego RCD (przycisk TEST) */
  rcdTestButtonOk?: boolean | null;
  /** Rezystancja uziomu odgromowego [Ω] — PN-EN 62305 */
  earthResistanceOhm?: number | null;
  /** Ciągłość zwodów/połączeń odgromowych [Ω] */
  lightningContinuityOhm?: number | null;
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

/**
 * Priorytet usterki — matryca decyzyjna zgodna ze specyfikacją.
 * 🔴 PILNE — zagrożenie życia/pożarowe, natychmiastowe wyłączenie
 * 🟡 NAPRAWA — niezgodność z normami, do usunięcia bieżąco
 * 🔵 SUGESTIA — dobre praktyki SEP, rekomendacja modernizacji
 */
export type FaultPriority = "PILNE" | "NAPRAWA" | "SUGESTIA";

export interface Fault {
  pointCode: string;
  parameter: string;
  measuredValue: string;
  allowedValue: string;
  normReference: string;
  priority: FaultPriority;
  description: string;
}

/**
 * Orzeczenie końcowe — binarne SPEŁNIA / NIE SPEŁNIA.
 * Jeśli choć jeden obwód jest CRITICAL → NIE SPEŁNIA.
 */
export interface FinalVerdict {
  /** SPEŁNIA / NIE SPEŁNIA / WARUNKOWO */
  status: "SPEŁNIA" | "NIE_SPEŁNIA" | "WARUNKOWO";
  /** Tekst orzeczenia do raportu */
  statement: string;
  /** Termin następnego badania (ISO date) */
  nextInspectionDate: string;
  /** Tabela usterek (pusta jeśli SPEŁNIA) */
  faults: Fault[];
}

export interface InstrumentValidation {
  valid: boolean;
  instrument: Instrument;
  error?: string;
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
  /** Orzeczenie końcowe wg matrycy decyzyjnej */
  finalVerdict: FinalVerdict;
  /** Walidacja przyrządów pomiarowych */
  instrumentValidation?: InstrumentValidation[];
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

/**
 * Współczynnik korekcyjny temperatury i niepewności pomiaru.
 * Zgodnie z wytycznymi SEP/SEEP: k = 2/3 ≈ 0.667 (konserwatywne)
 * lub k = 0.8 (powszechnie stosowane w praktyce pomiarowej).
 *
 * Wartość zmierzona Zs mnoży się przez k, co daje margines bezpieczeństwa
 * uwzględniający nagrzewanie przewodów do temperatury roboczej
 * (70°C dla PVC) vs temperatura otoczenia (~20°C) w momencie pomiaru.
 */
export const ZS_SAFETY_FACTOR = 0.8;

/**
 * Maksymalna dopuszczalna impedancja pętli zwarcia.
 *
 * TN/TN-S/TN-C-S: Zs_zmierzona ≤ (Uo / Ia) × k
 *   gdzie k = ZS_SAFETY_FACTOR = 0.8 (wytyczne SEP)
 *
 * PN-HD 60364-4-41:2017 pkt 411.4.4
 */
export function zsLimitOhm(protection: Protection, uoV = 230, safetyFactor = ZS_SAFETY_FACTOR): number {
  const ia = curveMultiplier(protection.curve) * protection.inA;
  return +((uoV / ia) * safetyFactor).toFixed(3);
}

/**
 * Limit rezystancji uziemienia Ra dla układu TT.
 * Warunek: Ra × IΔn ≤ 50 V — PN-HD 60364-4-41:2017 pkt 411.5.3
 * IΔn w amperach.
 */
export function raLimitOhm(rcdmA: number): number {
  return +(50 / (rcdmA / 1000)).toFixed(1);
}

/**
 * Minimalny próg rezystancji izolacji.
 * PN-HD 60364-6:2016 Tablica 6.1
 *
 * Napięcie < 50V (SELV/PELV) — 500V DC → ≥ 0,5 MΩ
 * Napięcie ≤ 500V (230/400V) — 500V DC → ≥ 1 MΩ   ← standard w Polsce
 * Napięcie > 500V             — 1000V DC → ≥ 1 MΩ
 */
export function risoMinMOhm(testVoltageV?: InsulationTestVoltage | null, circuitVoltageV = 230): number {
  if (circuitVoltageV < 50) return 0.5;
  if (testVoltageV === 250) return 0.5;  // SELV/PELV mierzone 250V DC
  return 1.0;  // standard dla instalacji 230/400V
}

/**
 * Maksymalny czas zadziałania RCD.
 * PN-EN IEC 61008-1:2019 / PN-HD 60364-4-41:2017 Tablica 41.1
 *
 * Typ AC / A / F — obwód końcowy 230V TN: ≤ 0,4s
 *                  obwód końcowy 230V TT: ≤ 0,3s (przy RCD jako ochrona)
 *                  rozdzielnica TN:       ≤ 5s (dopuszczalne)
 * Typ S (selektywny) — ≤ 0,5s (ale min. 0,06s opóźnienia)
 *
 * W praktyce dla RCD ochronnych przyjmujemy ≤ 300ms jako bezpieczne.
 */
export function rcdMaxTimeMs(rcdType?: RcdType | null, isFinalCircuit = true, networkSystem?: NetworkSystem): number {
  if (rcdType === "S") return 500;    // selektywny — maks. 500ms wg IEC 61008
  if (!isFinalCircuit) return 5000;  // rozdzielnica — dłuższy czas dopuszczalny
  if (networkSystem === "TT") return 300;  // TT — ≤ 0,3s przy RCD jako ochrona
  return 400;  // TN — ≤ 0,4s (norma), przyjmujemy 300ms jako standard praktyczny
}

/**
 * Progi normatywne i praktyczne.
 * Wartości oparte na: PN-HD 60364-6:2016, PN-HD 60364-4-41:2017,
 * PN-EN IEC 61008-1:2019, SEP-E-004, zaleceniach SEP.
 */
export const THRESHOLDS = {
  /** Riso ≥ 1 MΩ przy 500 V DC (instalacje 230/400V) */
  risoMinMOhm: 1.0,
  /** Strefa ostrzegawcza — bliżej progu niż 1,5× */
  risoWarnBand: 1.5,
  /** Ciągłość PE: zalecenie SEP — max 1 Ω dla typowych tras */
  continuityMaxOhm: 1.0,
  /** Strefa ostrzegawcza ciągłości — powyżej 0,7 Ω warto sprawdzić */
  continuityWarnOhm: 0.7,
  /** Czas RCD przy 1×IΔn — ogólny typ AC/A: ≤ 300ms (praktyczny limit) */
  rcdTimeMaxMs: 300,
  /** Ostrzeżenie powyżej 80% limitu czasu */
  rcdTimeWarnRatio: 0.8,
  /** RCD nie może wyzwalać poniżej 0,5×IΔn — PN-EN IEC 61008-1 */
  rcdTripLowRatio: 0.5,
  /** Ostrzeżenie Zs przy 90% limitu — margines dla niepewności pomiaru */
  zsWarnRatio: 0.9,
  /** Maks. napięcie dotykowe bezpieczne: 50V AC — PN-HD 60364-4-41 */
  touchVoltageMaxV: 50,
  /** Napięcie dotykowe w strefach mokrych i medycznych: 25V AC */
  touchVoltageWetMaxV: 25,
  /** Czas zadziałania RCD przy 5×IΔn (typ S) ≤ 40ms — PN-EN 61008 */
  rcdTime5xMaxMs: 40,
  /** Czas zadziałania RCD przy 2×IΔn ≤ 150ms */
  rcdTime2xMaxMs: 150,
} as const;

/* ------------------------------------------------------------------ */
/*  Normalizacja jednostek i formatów                                  */
/* ------------------------------------------------------------------ */

const UNIT_SCALE: Record<string, number> = {
  // milioomy — muszą być PRZED "ω" żeby nie zjadały sufiksu
  "mω": 0.001, "mohm": 0.001, "milliohm": 0.001, "miliohm": 0.001,
  // kilooomy
  "kω": 1000, "kohm": 1000, "kilohm": 1000,
  // czas
  "ms": 1, "s": 1000,
  // prąd
  "ma": 1, "a": 1000,
  // ohm — MUSI być na końcu (krótkiy sufiks)
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
/** Słowa oznaczające brak danych / przepełnienie / nieskończoność w różnych językach. */
const NULL_WORDS = new Set([
  "brak", "b/d", "bd", "nd", "n/d", "nd.", "bd.", "nie mierzono", "nie zmierzono",
  "inf", "infinity", "ol", "overload", "overflow", "break", "broken",
  "open", "otwarty", "przerwa", "zerwany",
  "pass", "fail", "ok", "error", "err",
  "---", "--", "----", "?", "∞", "x", "xx",
]);

export function parseLocalizedNumber(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let raw = String(input).trim();
  if (!raw) return null;

  const lower = raw.toLowerCase().replace(/\s+/g, "");

  // Null-słowa: brak danych, przepełnienie, nieskończoność
  if (NULL_WORDS.has(lower)) return null;
  // Tylko myślniki / gwiazdki / pytajniki
  if (/^[-—*?]+$/.test(raw)) return null;

  // Przekroczenie zakresu miernika: ">999", "≥1999", "<0.01"
  // Traktujemy wartość graniczną jako wynik (konservative)
  raw = raw.replace(/^[>≥<≤]\s*/, "").trim();

  // Normalizacja Unicode omega — różne kodowania z mierników
  raw = raw
    .replace(/\u03a9/g, "Ohm")   // Ω duże (U+03A9)
    .replace(/\u03c9/g, "ohm")   // ω małe (U+03C9)
    .replace(/\u2126/g, "Ohm");  // Ω techniczne (U+2126)

  const lowerRaw = raw.toLowerCase();
  let scale = 1;
  let stripped = raw;

  // Słownik rozszerzony — od NAJDŁUŻSZEGO (megaohm) do najkrótszego (a)
  const UNIT_MAP: [string, number][] = [
    ["megaohm", 1], ["mohm", 0.001], ["milliohm", 0.001], ["miliohm", 0.001],
    ["kilohm", 1000], ["kohm", 1000],
    ["mohm", 0.001],   // mOhm (miliomy) — po lowercase
    ["ohm", 1],
    ["ms", 1], ["s", 1000],
    ["ma", 1], ["a", 1000],
  ];

  // Megaohm (MΩ / MOhm) — MUSI być pierwszy, bo "M" jest duże
  if (lowerRaw.endsWith("megaohm")) {
    stripped = raw.slice(0, -7).trim();
    scale = 1; // Riso jest w MΩ — wartość bez przeskalowania
  } else if (raw.endsWith("MOhm") || raw.endsWith("Mohm") || lowerRaw.endsWith("mohm")) {
    // Rozróżnienie: mOhm (mili) vs MOhm (mega) — przez wielkość "M"
    const mChar = raw[raw.toLowerCase().lastIndexOf("mohm")];
    if (mChar === "M") {
      // MOhm = megaohm = Riso bez skalowania
      stripped = raw.slice(0, -4).trim();
      scale = 1;
    } else {
      // mohm = milliohm = ciągłość PE × 0.001
      stripped = raw.slice(0, -4).trim();
      scale = 0.001;
    }
  } else {
    for (const [suffix, factor] of UNIT_MAP) {
      if (lowerRaw.endsWith(suffix) && suffix !== "mohm") {
        scale = factor;
        stripped = raw.slice(0, -suffix.length).trim();
        break;
      }
    }
  }

  // Usuń pozostałe jednostki tekstowe z odciętego stringa
  raw = stripped.replace(/[^\d,.\-]/g, "");

  // Zamień przecinek dziesiętny na kropkę (format PL)
  // Ostrożnie: "1.234,56" → 1234.56  |  "1,234.56" → 1234.56
  if (raw.includes(",") && raw.includes(".")) {
    // Oba separatory — ustal który jest dziesiętny
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    if (lastComma > lastDot) {
      // "1.234,56" — przecinek jest dziesiętny
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      // "1,234.56" — kropka jest dziesiętna
      raw = raw.replace(/,/g, "");
    }
  } else {
    raw = raw.replace(",", ".");
  }

  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return +(n * scale).toFixed(4);
}

/* ------------------------------------------------------------------ */
/*  Ocena pojedynczego punktu                                          */
/* ------------------------------------------------------------------ */

/**
 * Baza kryterium — czytelne odwołania normowe wyświetlane w raporcie.
 * Każde kryterium zawiera: co badamy, wartość graniczną i podstawę prawną.
 */
function buildCriteria(ctx: CircuitContext, protection: Protection) {
  const net = ctx.networkSystem ?? "TN";
  const uo = ctx.uoV ?? 230;
  const isFinal = ctx.isFinalCircuit ?? true;
  const rcdType = protection.rcdType ?? "AC";
  // Stosujemy THRESHOLDS.rcdTimeMaxMs (300ms) jako konserwatywny standard praktyczny,
  // niezależnie od normatywnego limitu 400ms dla TN 230V.
  // 300ms jest bezpieczniejsze i stosowane przez większość mierników jako alarm.
  const maxRcdTime = rcdType === "S" ? 500 : !isFinal ? 5000 : THRESHOLDS.rcdTimeMaxMs;
  const minRiso = risoMinMOhm(ctx.insulationTestVoltageV, uo);

  const zsLimit = zsLimitOhm(protection, uo);
  const idn = protection.rcdmA ?? 0;
  const raLimit = idn > 0 ? raLimitOhm(idn) : null;

  return {
    ZS: net === "TT"
      ? `Układ TT: Ra × IΔn ≤ 50 V (PN-HD 60364-4-41:2017 pkt 411.5.3)${raLimit ? ` → Ra ≤ ${raLimit} Ω` : ""}`
      : `Zs ≤ Uo/Ia = ${uo}/${curveMultiplier(protection.curve) * protection.inA} = ${zsLimit} Ω (PN-HD 60364-4-41:2017 pkt 411.4.4)`,

    RISO: `Riso ≥ ${minRiso} MΩ przy ${ctx.insulationTestVoltageV ?? 500} V DC dla obwodów ${uo}V (PN-HD 60364-6:2016 Tab. 6.1)`,

    CONT: "Ciągłość przewodu ochronnego (PE/PEN) R ≤ 1 Ω — prąd pomiarowy ≥ 200 mA (SEP-E-004, PN-HD 60364-6:2016 pkt 6.4.3.3)",

    RCD_T: rcdType === "S"
      ? `Typ S (selektywny): czas ≤ 500 ms przy 1×IΔn (PN-EN IEC 61008-1:2019 Tab. 13)`
      : `Czas zadziałania ≤ ${maxRcdTime} ms przy 1×IΔn, typ ${rcdType} (PN-EN IEC 61008-1:2019 Tab. 13)`,

    RCD_I: `Prąd wyzwalania: 0,5×IΔn ≤ Ia ≤ IΔn (${idn * 0.5}–${idn} mA) — PN-EN IEC 61008-1:2019 pkt 5.3`,

    RCD_2X: `Czas zadziałania ≤ 150 ms przy 2×IΔn (PN-EN IEC 61008-1:2019)`,
    RCD_5X: `Czas zadziałania ≤ 40 ms przy 5×IΔn (PN-EN IEC 61008-1:2019)`,

    zsLimit,
    raLimit,
    minRiso,
    maxRcdTime,
  } as const;
}

function worst(a: MeasureStatus, b: MeasureStatus): MeasureStatus {
  const rank: Record<MeasureStatus, number> = { OK: 0, WARNING: 1, MISSING: 2, CRITICAL: 3 };
  return rank[a] >= rank[b] ? a : b;
}

export function evaluatePoint(point: RawPoint): PointEval {
  // Buduj kryteria normatywne z kontekstem obwodu
  const ctx: CircuitContext = point.context ?? {};
  const C = buildCriteria(ctx, point.protection);
  const net = ctx.networkSystem ?? "TN";
  const uo = ctx.uoV ?? 230;

  /* ----- Impedancja pętli zwarcia / rezystancja uziemienia ----- */
  let zs: MeasureVerdict;
  if (net === "TT" && point.protection.rcdmA) {
    // Układ TT: kryterium Ra × IΔn ≤ 50V zamiast Zs ≤ Uo/Ia
    const raLim = C.raLimit ?? 1666;
    const raVal = point.raOhm ?? point.zsOhm; // Ra ≈ Zs w uproszczeniu
    zs = raVal == null
      ? { value: null, unit: "Ω", limit: raLim, limitText: `Ra ≤ ${raLim} Ω`, criterion: C.ZS, status: "MISSING" }
      : {
          value: raVal, unit: "Ω", limit: raLim,
          limitText: `Ra ≤ ${raLim} Ω`, criterion: C.ZS,
          status: raVal > raLim ? "CRITICAL" : raVal > raLim * 0.9 ? "WARNING" : "OK",
        };
  } else {
    // TN/IT: kryterium Zs ≤ Uo/Ia
    const zsLimit = C.zsLimit;
    zs = point.zsOhm == null
      ? { value: null, unit: "Ω", limit: zsLimit, limitText: `≤ ${zsLimit} Ω`, criterion: C.ZS, status: "MISSING" }
      : {
          value: point.zsOhm, unit: "Ω", limit: zsLimit,
          limitText: `≤ ${zsLimit} Ω`, criterion: C.ZS,
          status: point.zsOhm > zsLimit ? "CRITICAL"
            : point.zsOhm > zsLimit * THRESHOLDS.zsWarnRatio ? "WARNING" : "OK",
        };
  }

  /* ----- Rezystancja izolacji ----- */
  const risoMin = C.minRiso;
  const riso: MeasureVerdict = point.risoMOhm == null
    ? { value: null, unit: "MΩ", limit: risoMin, limitText: `≥ ${risoMin} MΩ`, criterion: C.RISO, status: "MISSING" }
    : {
        value: point.risoMOhm, unit: "MΩ", limit: risoMin,
        limitText: `≥ ${risoMin} MΩ`, criterion: C.RISO,
        status: point.risoMOhm < risoMin ? "CRITICAL"
          : point.risoMOhm < THRESHOLDS.risoWarnBand ? "WARNING" : "OK",
      };

  /* ----- Ciągłość PE ----- */
  const continuity: MeasureVerdict = point.continuityOhm == null
    ? { value: null, unit: "Ω", limit: THRESHOLDS.continuityMaxOhm, limitText: `≤ ${THRESHOLDS.continuityMaxOhm} Ω`, criterion: C.CONT, status: "MISSING" }
    : {
        value: point.continuityOhm, unit: "Ω", limit: THRESHOLDS.continuityMaxOhm,
        limitText: `≤ ${THRESHOLDS.continuityMaxOhm} Ω`, criterion: C.CONT,
        // Uwaga: wartości >1999 (overrange) traktujemy jak przerwę → CRITICAL
        status: point.continuityOhm > THRESHOLDS.continuityMaxOhm || point.continuityOhm > 1000 ? "CRITICAL"
          : point.continuityOhm > THRESHOLDS.continuityWarnOhm ? "WARNING" : "OK",
      };

  /* ----- RCD ----- */
  let rcdTime: MeasureVerdict | null = null;
  let rcdCurrent: MeasureVerdict | null = null;

  if (point.protection.rcdmA) {
    const idn = point.protection.rcdmA;
    const maxTime = C.maxRcdTime;

    rcdTime = point.rcdTripMs == null
      ? { value: null, unit: "ms", limit: maxTime, limitText: `≤ ${maxTime} ms`, criterion: C.RCD_T, status: "MISSING" }
      : {
          value: point.rcdTripMs, unit: "ms", limit: maxTime,
          limitText: `≤ ${maxTime} ms`, criterion: C.RCD_T,
          status: point.rcdTripMs > maxTime ? "CRITICAL"
            : point.rcdTripMs > maxTime * THRESHOLDS.rcdTimeWarnRatio ? "WARNING" : "OK",
        };

    const lowLim = +(idn * THRESHOLDS.rcdTripLowRatio).toFixed(1);
    rcdCurrent = point.rcdTripmA == null
      ? { value: null, unit: "mA", limit: idn, limitText: `${lowLim}–${idn} mA`, criterion: C.RCD_I, status: "MISSING" }
      : {
          value: point.rcdTripmA, unit: "mA", limit: idn,
          limitText: `${lowLim}–${idn} mA`, criterion: C.RCD_I,
          status: point.rcdTripmA > idn || point.rcdTripmA < lowLim ? "CRITICAL"
            : point.rcdTripmA > idn * THRESHOLDS.zsWarnRatio ? "WARNING" : "OK",
        };
  }

  /* ----- Walidacja pomieszczeń specjalnych (PN-HD 60364-7-xxx) ----- */
  const zone = point.zoneType ?? "STANDARD";
  const wetZones: ZoneType[] = ["LAZIENKA", "BASEN", "MOKRE", "MEDYCZNE", "BUDOWA", "ROLNICTWO"];
  const isWetZone = wetZones.includes(zone);

  // Łazienki/baseny/mokre: RCD 30mA OBLIGATORYJNE (PN-HD 60364-7-701)
  const rcdMissing = !point.protection.rcdmA;
  const rcdRequired = isWetZone && rcdMissing;

  // RCD typ S: czas musi mieścić się w przedziale 130-500ms
  const isStype = point.protection.rcdType === "S";
  let rcdStypeInvalid = false;
  if (isStype && point.rcdTripMs != null) {
    rcdStypeInvalid = point.rcdTripMs < 130 || point.rcdTripMs > 500;
  }

  // Test mechaniczny RCD (przycisk TEST)
  const rcdTestFailed = point.rcdTestButtonOk === false;

  /* ----- Wynik ogólny ----- */
  let overall: MeasureStatus = "OK";
  for (const v of [zs, riso, continuity, rcdTime, rcdCurrent]) {
    if (!v) continue;
    if (v.status === "CRITICAL") overall = "CRITICAL";
    else overall = worst(overall, v.status);
  }
  if (overall !== "CRITICAL" && overall !== "WARNING") {
    if ([zs, riso, continuity].some((v) => v.status === "MISSING")) overall = "MISSING";
  }

  // Walidacja pomieszczeń specjalnych podnosi status do CRITICAL
  if (rcdRequired) overall = "CRITICAL";
  if (rcdStypeInvalid) overall = "CRITICAL";
  if (rcdTestFailed) overall = "CRITICAL";

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

  /* ----- Orzeczenie końcowe ----- */
  const faults: Fault[] = findings
    .filter((f) => f.category === "KRYTYCZNE" || f.category === "OSTRZEŻENIE")
    .map((f) => ({
      pointCode: f.pointCode,
      parameter: f.parameter,
      measuredValue: f.result.split("·")[0]?.trim() ?? "—",
      allowedValue: f.result.split("·")[1]?.trim() ?? f.criterion,
      normReference: f.criterion,
      priority: f.category === "KRYTYCZNE" ? "PILNE" as FaultPriority : "NAPRAWA" as FaultPriority,
      description: f.cause,
    }));

  const verdictStatus = summary.critical > 0 ? "NIE_SPEŁNIA" as const
    : summary.missing > 0 ? "WARUNKOWO" as const
    : "SPEŁNIA" as const;

  const verdictStatement = verdictStatus === "SPEŁNIA"
    ? "Badana instalacja elektryczna SPEŁNIA wymagania w zakresie ochrony przeciwporażeniowej i przepisów eksploatacji."
    : verdictStatus === "NIE_SPEŁNIA"
    ? "Badana instalacja elektryczna NIE SPEŁNIA wymagań w zakresie ochrony przeciwporażeniowej i przepisów eksploatacji. Wymagane usunięcie stwierdzonych usterek."
    : "Ocena warunkowa — niekompletne dane pomiarowe uniemożliwiają jednoznaczne orzeczenie. Wymagane uzupełnienie zakresu badań.";

  // Termin następnego badania: max 5 lat, krócej dla stref specjalnych
  const hasSpecialZone = points.some((p) => p.zoneType && p.zoneType !== "STANDARD");
  const nextYears = hasSpecialZone ? 1 : 5; // strefy specjalne: co rok
  const nextDate = new Date();
  nextDate.setFullYear(nextDate.getFullYear() + nextYears);

  const finalVerdict: FinalVerdict = {
    status: verdictStatus,
    statement: verdictStatement,
    nextInspectionDate: nextDate.toISOString().slice(0, 10),
    faults,
  };

  return { algorithmVersion: ALGORITHM_VERSION, criteriaSet: CRITERIA_SET, points: evals, summary, findings, verdictCounts, finalVerdict };
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
  {
    key: "code", label: "Punkt / oznaczenie", required: true,
    synonyms: ["lp", "pkt", "punkt", "oznaczenie", "nr", "code", "id", "no", "pos", "position", "num", "numer"],
  },
  {
    key: "location", label: "Lokalizacja / obiekt", required: true,
    synonyms: ["lokalizacja", "pomieszczenie", "strefa", "miejsce", "location", "obiekt", "opis", "uwagi", "room", "area", "zone", "description"],
  },
  {
    key: "circuit", label: "Obwód", required: false,
    synonyms: ["obwod", "obwód", "circuit", "nazwa obwodu", "linia", "type", "rodzaj", "group"],
  },
  {
    key: "breakerCurve", label: "Charakterystyka [B/C/D]", required: true,
    synonyms: ["charakterystyka", "krzywa", "curve", "char", "char.", "charakt", "typ"],
  },
  {
    key: "breakerIn", label: "Prąd znamionowy [A]", required: true,
    synonyms: ["in", "in[a]", "in(a)", "rating", "prad znamionowy", "prąd znamionowy", "nominal", "fuse", "breaker", "zabezpieczenie"],
  },
  {
    key: "rcdmA", label: "IΔn RCD [mA]", required: false,
    synonyms: ["idn", "iδn", "rcd", "rcd[ma]", "rcd(ma)", "prad roznicowy", "prąd różnicowy", "idelta", "i delta", "typ rcd", "rcd typ"],
  },
  {
    key: "zs", label: "Impedancja pętli Zs [Ω]", required: true,
    synonyms: ["zs", "zs[ω]", "zs[ohm]", "zs(ohm)", "impedancja", "petla zwarcia", "pętla zwarcia", "zm. petli", "zm. pętli", "loop impedance", "loop"],
  },
  {
    key: "riso", label: "Rezystancja izolacji [MΩ]", required: true,
    synonyms: ["riso", "r iso", "riso[mω]", "riso(mohm)", "izolacja", "rezystancja izolacji", "rez. izol", "rez. izol.", "insulation", "iso", "r_ins"],
  },
  {
    key: "continuity", label: "Ciągłość PE [Ω]", required: false,
    synonyms: [
      "ciaglosc", "ciągłość", "rpe", "r_pe", "r pe", "pe", "continuity",
      "przewod ochronny", "rkont", "r kont", "r_kont", "rcont", "r_cont",
      "200ma", "ochronny", "cont", "ciagl", "ciagl.", "protective", "earth",
    ],
  },
  {
    key: "rcdTime", label: "Czas zadziałania RCD [ms]", required: false,
    synonyms: [
      "t_rcd", "trcd", "rcd t", "czas rcd", "t ia", "czas wyzwalania", "trip time",
      "rcdtime", "t[ms]", "t(ms)", "czas[ms]", "t_trip", "time",
      "czas", "czas ms", "czas[ms]", "czas (ms)", "czas [ms]",
    ],
  },
  {
    key: "rcdCurrent", label: "Prąd wyzwalania RCD [mA]", required: false,
    synonyms: [
      "rcd i", "i_rcd", "ircd", "prad wyzwalania", "prąd wyzwalania",
      "rcdcurrent", "ia[ma]", "trip current", "i_trip", "wyzwalanie",
    ],
  },
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
      // Krótkie unikalne kody: LP-01, A1, 1, 2, 3
      return p.codeLike > 0.6 && p.uniqueRatio > 0.85 ? 0.92
        : p.uniqueRatio > 0.95 && p.count > 0 && p.textRatio > 0.3 ? 0.6 : 0;

    case "location":
      // Tekst opisowy, dłuższe frazy, powtarzający się (wiele punktów w tym samym miejscu)
      return p.textRatio > 0.8 && p.codeLike < 0.3 && p.uniqueRatio < 0.9 && p.count > 0 ? 0.65 : 0;

    case "circuit":
      // Tekst, może się powtarzać, kodopodobny mniej niż lokalizacja
      return p.textRatio > 0.7 && p.codeLike < 0.5 ? 0.42 : 0;

    case "breakerCurve":
      // Wyłącznie B/C/D (ewentualnie B16, C32 jako compound)
      return p.curveLike > 0.7 ? 0.97 : 0;

    case "breakerIn":
      // Całkowite z typoszeregu wyłączników; nie RCD, nie za duże
      return allFrom(STD_BREAKER_IN) && p.decimalsRatio < 0.15 && !allFrom(STD_RCD) ? 0.9 : 0;

    case "rcdmA":
      // Dokładnie z typoszeregu RCD (6/10/30/100/300/500/1000)
      return allFrom(STD_RCD) && p.decimalsRatio < 0.1 ? 0.93 : 0;

    case "zs":
      // Impedancja pętli zwarcia: ułamkowe, 0.05–20 Ω, mediana 0.3–8
      if (allFrom(STD_RCD) || allFrom(STD_BREAKER_IN)) return 0;
      return p.numericRatio > 0.75 && inRange(0.01, 30)
        && medianIn(0.1, 10) && p.decimalsRatio > 0.45 ? 0.87 : 0;

    case "riso":
      // Rezystancja izolacji: duże wartości (dziesiątki–setki MΩ), rozkład ciągły
      if (allFrom(STD_RCD)) return 0;
      if (p.numericRatio > 0.75 && medianIn(50, 10000)) return 0.9;
      if (p.numericRatio > 0.75 && medianIn(1, 50) && p.max !== null && p.max > 10) return 0.6;
      return 0;

    case "continuity":
      // Ciągłość PE: bardzo małe (< 5 Ω mediana), ułamkowe lub zero.
      // Tolerujemy overrange (>1999) przez wyższe max.
      if (allFrom(STD_RCD) || allFrom(STD_BREAKER_IN)) return 0;
      return p.numericRatio > 0.65 && medianIn(0, 5)
        && (p.decimalsRatio > 0.25 || (p.median !== null && p.median < 2)) ? 0.82 : 0;

    case "rcdTime":
      // Czas zadziałania RCD: typowo 10–400 ms, całkowite
      if (allFrom(STD_RCD)) return 0;
      return p.numericRatio > 0.75 && inRange(1, 1000)
        && medianIn(10, 350) && p.decimalsRatio < 0.3 ? 0.68 : 0;

    case "rcdCurrent":
      // Prąd wyzwalania: 5–500 mA, ułamkowy (np. 19,8), NIE całkowity typoszereg RCD
      if (allFrom(STD_RCD)) return 0;
      return p.numericRatio > 0.75 && inRange(1, 600)
        && medianIn(8, 400) && p.decimalsRatio > 0.3 ? 0.72 : 0;

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

    /* ---- Wykrywanie charakterystyki i prądu ---- */
    let curveRaw = String(get(row, "breakerCurve") ?? "").trim().toUpperCase();
    let inAraw: unknown = get(row, "breakerIn");

    // Obsługa "B16", "C32", "D10" — zabezpieczenie w jednej komórce
    if (curveRaw.match(/^[BCD]\d+$/) && !inAraw) {
      inAraw = curveRaw.slice(1);
      curveRaw = curveRaw.slice(0, 1);
    }
    // Obsługa kolumny "Zabezpieczenie" z wartością "B16" nawet gdy jest osobna kolumna Char.
    const zabRaw = String(get(row, "breakerCurve") ?? "").trim().toUpperCase();
    if (!curveRaw && zabRaw.match(/^[BCD]\d+$/)) {
      curveRaw = zabRaw.slice(0, 1);
      inAraw = zabRaw.slice(1);
    }
    const curve: BreakerCurve = curveRaw.startsWith("C") ? "C" : curveRaw.startsWith("D") ? "D" : "B";
    const inA = parseLocalizedNumber(inAraw) ?? 16;

    /* ---- RCD ---- */
    const rcdRaw = get(row, "rcdmA");
    let rcdmA: number | null = parseLocalizedNumber(rcdRaw);
    // "0" lub "" lub "---" traktujemy jako brak RCD
    if (rcdmA === 0) rcdmA = null;
    // Wyciągamy wartość z "30mA", "100 mA" (unit może być inline w tej kolumnie)
    if (rcdmA === null && rcdRaw != null) {
      const cleaned = String(rcdRaw).toLowerCase().replace("ma", "").replace("mа", "").trim();
      const parsed = parseLocalizedNumber(cleaned);
      if (parsed && parsed > 0) rcdmA = parsed;
    }

    /* ---- Czasy i prądy RCD — "0" oznacza brak pomiaru ---- */
    const rcdTime = parseLocalizedNumber(get(row, "rcdTime"));
    const rcdCurrent = parseLocalizedNumber(get(row, "rcdCurrent"));

    points.push({
      code: String(rawCode).trim(),
      location: rawLoc != null ? String(rawLoc).trim() : "—",
      circuit: String(get(row, "circuit") ?? "—").trim() || "—",
      protection: { curve, inA, rcdmA },
      zsOhm: parseLocalizedNumber(get(row, "zs")),
      risoMOhm: parseLocalizedNumber(get(row, "riso")),
      continuityOhm: parseLocalizedNumber(get(row, "continuity")),
      rcdTripMs: (rcdTime === 0 ? null : rcdTime),
      rcdTripmA: (rcdCurrent === 0 ? null : rcdCurrent),
    });
  });

  return { points, errors };
}

/**
 * Walidacja wzorcowania przyrządów pomiarowych.
 * Zgodnie z PN-EN 61557 i wytycznymi SEP: wzorcowanie co 12-24 mies.
 */
export function validateInstruments(instruments: Instrument[], measurementDate: string): InstrumentValidation[] {
  const mDate = new Date(measurementDate);
  return instruments.map((inst) => {
    const calDate = new Date(inst.calibrationValidUntil);
    if (isNaN(calDate.getTime())) {
      return { valid: false, instrument: inst, error: "Nieprawidłowa data ważności wzorcowania." };
    }
    if (calDate < mDate) {
      return {
        valid: false,
        instrument: inst,
        error: `Świadectwo wzorcowania (${inst.calibrationNo}) wygasło ${inst.calibrationValidUntil} — pomiary wykonano ${measurementDate}. Protokół może zostać odrzucony przez PINB/OSD/ubezpieczyciela.`,
      };
    }
    return { valid: true, instrument: inst };
  });
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
