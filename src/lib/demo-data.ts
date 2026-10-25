/**
 * DANE DEMONSTRACYJNE — DiagoLAB Raporty+
 * ========================================
 * UWAGA: Wszystkie wartości poniżej są PRZYKŁADOWE i służą wyłącznie
 * prezentacji produktu. Nie stanowią wyników rzeczywistych badań
 * i nie mogą być traktowane jako dokumentacja pomiarowa.
 * Konsekwentnie oznaczamy je etykietą DEMO w interfejsie.
 */

import type { RawPoint, HistorySample } from "@/lib/engine";

export const DEMO_DISCLAIMER =
  "Dane demonstracyjne — wygenerowane na potrzeby prezentacji produktu. Nie są wynikami rzeczywistych badań.";

export const DEMO_META = {
  reportNumber: "DLR/2026/0114-DEMO",
  date: "2026-01-14",
  object: "Hala produkcyjna z częścią socjalną (OBIEKT DEMONSTRACYJNY)",
  objectAddress: "ul. Przemysłowa 12, 44-100 Gliwice",
  client: "Meblex Sp. z o.o. (KLIENT DEMO)",
  contractor: "EL-MONT Jan Kowalski (WYKONAWCA DEMO)",
  installer: {
    name: "Jan Kowalski",
    company: "EL-MONT Usługi Elektryczne",
    certificateNo: "DEMO-E-123456/2024",
    scope: "E — do 1 kV (pomiary i kontrola)",
  },
  instrument: "Sonel MPI-535 · nr seryjny DEMO-0535 · legalizacja do 2026-09-30",
  source: {
    fileName: "pomiary_demo_hala_gliwice_2026-01-14.csv",
    importedAt: "2026-01-14T10:24:00+01:00",
  },
  weather: "temp. 18 °C · wilgotność 47% · instalacja w suchych pomieszczeniach",
};

/** 12 punktów pomiarowych — celowo zawiera: wyniki OK, 2 ostrzeżenia, 1 krytyczny, 1 z brakiem danych. */
export const DEMO_POINTS: RawPoint[] = [
  { code: "LP-01", location: "Szafa główna RG", circuit: "Zasilanie WLZ — rozdzielnia produkcji", protection: { curve: "C", inA: 32, rcdmA: null }, zsOhm: 0.42, risoMOhm: 240, continuityOhm: 0.12 },
  { code: "LP-02", location: "Strefa A — linia 1", circuit: "Gniazda siłowe 400V — obrabiarka CNC-1", protection: { curve: "C", inA: 32, rcdmA: null }, zsOhm: 0.58, risoMOhm: 180, continuityOhm: 0.21 },
  { code: "LP-03", location: "Strefa A — linia 1", circuit: "Gniazda 230V — stanowiska montażowe", protection: { curve: "B", inA: 16, rcdmA: 30 }, zsOhm: 1.94, risoMOhm: 320, continuityOhm: 0.34, rcdTripMs: 24, rcdTripmA: 19.8 },
  { code: "LP-04", location: "Strefa A — linia 2", circuit: "Gniazda 230V — stanowiska montażowe", protection: { curve: "B", inA: 16, rcdmA: 30 }, zsOhm: 2.12, risoMOhm: 260, continuityOhm: 0.41, rcdTripMs: 27, rcdTripmA: 21.4 },
  { code: "LP-05", location: "Strefa B — lakiernia", circuit: "Gniazda 230V — kompresor", protection: { curve: "B", inA: 16, rcdmA: 30 }, zsOhm: 3.41, risoMOhm: 95, continuityOhm: 0.62, rcdTripMs: 31, rcdTripmA: 22.6 },
  { code: "LP-06", location: "Strefa B — lakiernia", circuit: "Oświetlenie przemysłowe LED", protection: { curve: "B", inA: 10, rcdmA: 30 }, zsOhm: 1.18, risoMOhm: 1.24, continuityOhm: 0.38, rcdTripMs: 254, rcdTripmA: 23.1 },
  { code: "LP-07", location: "Magazyn wysoki", circuit: "Gniazda 230V — regały ładowarki", protection: { curve: "B", inA: 16, rcdmA: 30 }, zsOhm: 2.36, risoMOhm: 210, continuityOhm: 0.78, rcdTripMs: 25, rcdTripmA: 18.9 },
  { code: "LP-08", location: "Magazyn wysoki", circuit: "Oświetlenie awaryjne", protection: { curve: "B", inA: 10, rcdmA: 30 }, zsOhm: 1.42, risoMOhm: 440, continuityOhm: 0.29, rcdTripMs: 22, rcdTripmA: 19.2 },
  { code: "LP-09", location: "Część socjalna", circuit: "Gniazda 230V — kuchnia", protection: { curve: "B", inA: 16, rcdmA: 30 }, zsOhm: 1.76, risoMOhm: 380, continuityOhm: 0.33, rcdTripMs: 23, rcdTripmA: 17.5 },
  { code: "LP-10", location: "Część socjalna", circuit: "Gniazda 230V — szatnie", protection: { curve: "B", inA: 16, rcdmA: 30 }, zsOhm: 2.04, risoMOhm: 295, continuityOhm: 0.4, rcdTripMs: 26, rcdTripmA: 20.2 },
  { code: "LP-11", location: "Serwerownia", circuit: "Gniazda dedykowane UPS", protection: { curve: "C", inA: 16, rcdmA: 30 }, zsOhm: 0.89, risoMOhm: 520, continuityOhm: 0.18, rcdTripMs: 21, rcdTripmA: 18.1 },
  { code: "LP-12", location: "Zasilanie klimatyzacji", circuit: "Jednostka zewn. — dach", protection: { curve: "C", inA: 25, rcdmA: null }, zsOhm: 0.68, risoMOhm: 260, continuityOhm: 0.44 },
];

/** Historia pomiarów obiektu dla Smart Compare+ (serie 2023–2026, dane DEMO). */
export const DEMO_HISTORY: HistorySample[] = [
  { date: "2023-02-10", values: { "LP-01": 0.44, "LP-03": 1.88, "LP-05": 2.98, "LP-06": 1.12, "LP-09": 1.7 } },
  { date: "2024-02-08", values: { "LP-01": 0.43, "LP-03": 1.9, "LP-05": 3.21, "LP-06": 1.14, "LP-09": 1.73 } },
  { date: "2025-01-16", values: { "LP-01": 0.42, "LP-03": 1.93, "LP-05": 3.33, "LP-06": 1.16, "LP-09": 1.74 } },
  { date: "2026-01-14", values: { "LP-01": 0.42, "LP-03": 1.94, "LP-05": 3.41, "LP-06": 1.18, "LP-09": 1.76 } },
];
