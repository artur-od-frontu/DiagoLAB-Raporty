/**
 * DiagoLAB Raporty+ — konfiguracja marki, produktu i cennika.
 * ------------------------------------------------------------
 * △ DESIGN SYSTEM: TYMCZASOWY — elementy oznaczone komentarzem "△"
 *   wymagają dopasowania do identyfikacji wizualnej DiagoLAB Pomiary.
 *
 * Zasada: ceny i limity pakietów są KONFIGURACJĄ — nie zapisujemy ich
 * na stałe w komponentach ani w wielu miejscach kodu.
 */

export const BRAND = {
  product: "DiagoLAB Raporty+",
  family: "DiagoLAB",
  ecosystem: ["DiagoLAB Pomiary", "DiagoLAB Raporty+"],
  promise: "Od wyników pomiarów do profesjonalnego raportu.",
  tagline: "Twoje pomiary. Nasza technologia. Profesjonalny raport.",
  /** △ Tymczasowy design system — patrz globals.css */
  designSystemStatus: "temporary" as const,
  supportEmail: "wsparcie@diagolab.pl",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export const ALGORITHM_VERSION = "1.3.2";
export const CRITERIA_SET =
  "PN-HD 60364-6:2016 · Zestaw kryteriów DiagoLAB v1.3";

export type PlanId = "START" | "PAKIET_5" | "PAKIET_15" | "PAKIET_30";

/** Ważność każdego zakupionego pakietu — po tym okresie niewykorzystane raporty przepadają. */
export const PACKAGE_VALIDITY_MONTHS = 12;

export interface Plan {
  id: PlanId;
  name: string;
  pricePLN: number;
  /** Liczba raportów w pakiecie (model wyłącznie ilościowy — bez abonamentów). */
  reportsIncluded: number;
  /** Ważność pakietu w miesiącach od zakupu. */
  validityMonths: number;
  /** Etykieta wyróżnienia prezentowana na karcie pakietu. */
  badge?: string;
  /** START: jeden raport gratis, możliwy do wykorzystania tylko raz na konto. */
  oncePerAccount?: boolean;
  tagline: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

export const PLANS: Plan[] = [
  {
    id: "START",
    name: "START",
    pricePLN: 0,
    reportsIncluded: 1,
    validityMonths: PACKAGE_VALIDITY_MONTHS,
    oncePerAccount: true,
    tagline: "Pierwszy raport gratis",
    features: [
      "1 pełny raport (HTML + PDF)",
      "Import CSV / XLSX",
      "Silnik analityczny i kryteria",
      "Bez karty płatniczej",
      "Tylko raz na konto",
    ],
    cta: "WYGENERUJ RAPORT GRATIS",
  },
  {
    id: "PAKIET_5",
    name: "PAKIET 5",
    pricePLN: 149,
    reportsIncluded: 5,
    validityMonths: PACKAGE_VALIDITY_MONTHS,
    tagline: "Dla pojedynczych zleceń",
    features: [
      "5 raportów do wykorzystania",
      "Import CSV / XLSX",
      "Ostrzeżenia i zalecenia",
      "PDF z logo Twojej firmy",
      "Ważność 12 miesięcy",
    ],
    cta: "KUP 5 RAPORTÓW",
  },
  {
    id: "PAKIET_15",
    name: "PAKIET 15",
    pricePLN: 249,
    reportsIncluded: 15,
    validityMonths: PACKAGE_VALIDITY_MONTHS,
    tagline: "Optymalny wybór dla instalatora",
    features: [
      "15 raportów do wykorzystania",
      "DiagoLAB Smart Compare+",
      "Historia pomiarów obiektów",
      "AI: podsumowania i zalecenia",
      "Ważność 12 miesięcy",
    ],
    highlighted: true,
    badge: "REKOMENDOWANY",
    cta: "KUP 15 RAPORTÓW",
  },
  {
    id: "PAKIET_30",
    name: "PAKIET 30",
    pricePLN: 399,
    reportsIncluded: 30,
    validityMonths: PACKAGE_VALIDITY_MONTHS,
    tagline: "Najniższy koszt raportu",
    features: [
      "30 raportów do wykorzystania",
      "Wszystko z pakietu 15",
      "Prognozy trendów",
      "Raporty zbiorcze obiektów",
      "Ważność 12 miesięcy",
    ],
    cta: "KUP 30 RAPORTÓW",
  },
];

export function formatPlanPrice(plan: Plan): string {
  return plan.pricePLN === 0 ? "0 zł" : `${plan.pricePLN} zł`;
}

/** Cena jednostkowa raportu w pakiecie — argument sprzedażowy. */
export function pricePerReport(plan: Plan): string | null {
  if (plan.pricePLN === 0 || plan.reportsIncluded === 0) return null;
  const per = plan.pricePLN / plan.reportsIncluded;
  return `${per.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł / raport`;
}

/** Statusy konta zgodne ze specyfikacją produktu. */
export const ACCOUNT_STATUSES = [
  "NIEZWERYFIKOWANE",
  "DEMO",
  "AKTYWNE",
  "WYGASLE",
  "ZABLOKOWANE",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  NIEZWERYFIKOWANE: "Niezweryfikowane",
  DEMO: "Demo (1 raport gratis)",
  AKTYWNE: "Aktywne",
  WYGASLE: "Wygasłe",
  ZABLOKOWANE: "Zablokowane",
};
