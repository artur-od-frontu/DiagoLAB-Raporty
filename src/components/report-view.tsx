"use client";

/**
 * RAPORT INTERAKTYWNY — DiagoLAB Raporty+
 * =======================================
 * Główny produkt platformy. Sekcje A–L zgodnie ze specyfikacją.
 * Dane wejściowe: serializowalny ReportPayload (ten sam model dla PDF).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Chart, { type ChartConfiguration } from "chart.js/auto";
import {
  analyzePoints,
  compareHistory,
  sha256Hex,
  type AnalysisResult,
  type Finding,
  type HistorySample,
  type MeasureStatus,
  type PointEval,
  type RawPoint,
} from "@/lib/engine";
import { CountUp, useReducedMotion } from "@/components/motion";
import { SessionGuard, registerDraftProvider } from "@/components/session-guard";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Cpu,
  Database,
  FileDown,
  FileText,
  History as HistoryIcon,
  Info,
  Lock,
  Pencil,
  Printer,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  Signature as SignatureIcon,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

/* ---------------------------------------------------------------- */
/* Model                                                             */
/* ---------------------------------------------------------------- */

export interface ReportMeta {
  reportNumber: string;
  date: string;
  object: string;
  objectAddress: string;
  client: string;
  contractor: string;
  installer: { name: string; company: string; certificateNo: string; scope: string };
  instrument: string;
  instrumentsDetails?: import("@/lib/engine").Instrument[];
  inspectionChecklist?: import("@/lib/engine").InspectionChecklist & { notes?: string };
  source: { fileName: string; importedAt: string };
  weather: string;
  /** Logo firmy wykonawcy (data URL) — nagłówek raportu i strona tytułowa PDF. */
  logoDataUrl?: string | null;
}

export interface ReportPayload {
  meta: ReportMeta;
  points: RawPoint[];
  analysis: AnalysisResult;
  history?: HistorySample[];
  isDemo: boolean;
  importedLocal?: boolean;
}

/** Tryb "raport z bazy" — decyzje i zatwierdzenie zapisywane na serwerze. */
export interface ReportPersistence {
  reportId: string;
  initialDecisions?: Record<string, { decision: "ACCEPTED" | "REJECTED" | "EDITED"; note?: string; edited?: string }>;
  initialApproval?: { assessment: "POZYTYWNA" | "WARUNKOWA" | "NEGATYWNA"; approvedAt: string } | null;
}

const STATUS_LABEL: Record<MeasureStatus, string> = {
  OK: "OK",
  WARNING: "OSTRZEŻENIE",
  CRITICAL: "KRYTYCZNE",
  MISSING: "BRAK DANYCH",
};

const STATUS_CLASS: Record<MeasureStatus, string> = {
  OK: "st-ok",
  WARNING: "st-warn",
  CRITICAL: "st-crit",
  MISSING: "st-miss",
};

const STATUS_COLOR: Record<MeasureStatus, string> = {
  OK: "#49dd8a",
  WARNING: "#ffb224",
  CRITICAL: "#ff6473",
  MISSING: "#5c6d89",
};

const CAT_CLASS: Record<string, string> = {
  KRYTYCZNE: "st-crit",
  OSTRZEŻENIE: "st-warn",
  ZALECENIE: "st-info",
  INFORMACJA: "st-miss",
};

function fmt(n: number | null | undefined, unit = ""): string {
  if (n === null || n === undefined) return "—";
  return `${String(n.toLocaleString("pl-PL", { maximumFractionDigits: 3 })).replace(".", ",")}${unit ? ` ${unit}` : ""}`;
}

/* ---------------------------------------------------------------- */
/* Loader — tryb podglądu importu (sessionStorage) lub dane z serwera */
/* ---------------------------------------------------------------- */

export function ReportLoader({
  demoPayload,
  qrDataUrl,
  sessionActive = false,
}: {
  demoPayload: ReportPayload;
  qrDataUrl: string | null;
  sessionActive?: boolean;
}) {
  const [payload, setPayload] = useState<ReportPayload>(demoPayload);
  const [fromImport, setFromImport] = useState(false);
  const [draftReady, setDraftReady] = useState(!sessionActive);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("zrodlo") !== "import") return;
    try {
      const raw = sessionStorage.getItem("dl.imported");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { points: RawPoint[]; meta?: Partial<ReportMeta> };
      if (!parsed.points?.length) return;
      const meta: ReportMeta = {
        ...demoPayload.meta,
        reportNumber: "DLR/ROBOCZY-PODGLAD",
        date: new Date().toISOString().slice(0, 10),
        object: parsed.meta?.object ?? "Obiekt (podgląd roboczy z importu)",
        objectAddress: parsed.meta?.objectAddress ?? "—",
        client: parsed.meta?.client ?? "—",
        contractor: parsed.meta?.contractor ?? "—",
        source: {
          fileName: parsed.meta?.source?.fileName ?? "import.csv",
          importedAt: new Date().toISOString(),
        },
      };
      setPayload({
        meta,
        points: parsed.points as RawPoint[],
        analysis: analyzePoints(parsed.points as RawPoint[]),
        isDemo: false,
        importedLocal: true,
      });
      setFromImport(true);
    } catch {
      /* nieprawidłowe dane w sessionStorage — pozostajemy przy DEMO */
    }
  }, [demoPayload]);

  /* Przywrócenie wersji roboczej decyzji raportu (zapisanej np. przy
     automatycznym wylogowaniu) — przed pierwszym renderem paneli. */
  useEffect(() => {
    if (!sessionActive || draftReady) return;
    let cancelled = false;
    fetch("/api/drafts?kind=RAPORT")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const p = d?.draft?.payload as
          | { reportNumber?: string; decisions?: Record<string, unknown>; approval?: Record<string, unknown> }
          | undefined;
        const nr = payload.meta.reportNumber;
        if (p && p.reportNumber === nr) {
          try {
            if (p.decisions && !localStorage.getItem(`dl.decisions.${nr}`)) {
              localStorage.setItem(`dl.decisions.${nr}`, JSON.stringify(p.decisions));
            }
            if (p.approval && !localStorage.getItem(`dl.approval.${nr}`)) {
              localStorage.setItem(`dl.approval.${nr}`, JSON.stringify(p.approval));
            }
          } catch {
            /* localStorage niedostępny — pomijamy przywracanie */
          }
        }
        if (!cancelled) setDraftReady(true);
      })
      .catch(() => !cancelled && setDraftReady(true));
    return () => {
      cancelled = true;
    };
  }, [sessionActive, draftReady, payload.meta.reportNumber]);

  return (
    <>
      {sessionActive && <SessionGuard />}
      {!draftReady ? (
        <div className="card p-12 text-center text-dim text-[14px]">Sprawdzanie wersji roboczych raportu…</div>
      ) : (
        <ReportView payload={payload} qrDataUrl={fromImport ? null : qrDataUrl} />
      )}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Raport                                                            */
/* ---------------------------------------------------------------- */

interface AuditEntry {
  at: string;
  who: string;
  action: string;
}

export function ReportView({
  payload,
  qrDataUrl,
  persistence,
  readOnly = false,
  shareUrl,
}: {
  payload: ReportPayload;
  qrDataUrl: string | null;
  persistence?: ReportPersistence;
  /** Publiczny podgląd tokenizowany: bez decyzji i zatwierdzania. */
  readOnly?: boolean;
  /** Publiczny link (token) — przycisk kopiowania dla właściciela. */
  shareUrl?: string;
}) {
  const { meta, analysis, history } = payload;
  const [hash, setHash] = useState<string>("obliczanie…");
  const [animationsOn, setAnimationsOn] = useState(true);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    const snapshot = JSON.stringify({
      nr: meta.reportNumber,
      data: meta.date,
      punkty: payload.points,
      silnik: analysis.algorithmVersion,
      wersjaKryteriow: analysis.criteriaSet,
    });
    sha256Hex(snapshot).then(setHash).catch(() => setHash("niedostępny"));
  }, [meta, payload.points, analysis]);

  const pushAudit = useCallback((action: string) => {
    setAudit((a) => [
      { at: new Date().toLocaleString("pl-PL"), who: `${meta.installer.name} (${meta.installer.company})`, action },
      ...a,
    ]);
  }, [meta]);

  /* Dostawca wersji roboczej raportu: jeśli istnieją niezapisane decyzje
     lub rozpoczęta ocena — trafią do /api/drafts przy auto-wylogowaniu. */
  useEffect(() => {
    const nr = payload.meta.reportNumber;
    const unregister = registerDraftProvider(() => {
      try {
        const decisions = localStorage.getItem(`dl.decisions.${nr}`);
        const approval = localStorage.getItem(`dl.approval.${nr}`);
        if (!decisions && !approval) return null;
        return {
          kind: "RAPORT" as const,
          sourceFileName: payload.meta.source.fileName,
          payload: {
            reportNumber: nr,
            object: payload.meta.object,
            decisions: decisions ? (JSON.parse(decisions) as Record<string, unknown>) : null,
            approval: approval ? (JSON.parse(approval) as Record<string, unknown>) : null,
            savedAt: new Date().toISOString(),
          },
        };
      } catch {
        return null;
      }
    });
    return unregister;
  }, [payload]);

  const s = analysis.summary;

  return (
    <article className="rpt" aria-label={`Raport ${meta.reportNumber}`}>
      {/* A. NAGŁÓWEK */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-blueprint pointer-events-none" aria-hidden />
        <div className="absolute -top-32 right-0 w-[420px] h-[420px] glow-volt pointer-events-none" aria-hidden />
        <div className="relative px-6 md:px-12 pt-10 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              {meta.logoDataUrl && (
                <figure className="mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={meta.logoDataUrl} alt={`Logo — ${meta.installer.company}`} className="h-12 w-auto max-w-[200px] object-contain bg-white/90 rounded-lg p-1.5" />
                </figure>
              )}
              <div className="flex items-center gap-3">
                <p className="kicker">Raport z pomiarów · {meta.date}</p>
                {payload.isDemo ? (
                  <span className="badge st-warn no-print">DEMO — dane przykładowe</span>
                ) : payload.importedLocal ? (
                  <span className="badge st-info no-print">Podgląd roboczy z importu</span>
                ) : null}
              </div>
              <h1 className="rpt-h text-3xl md:text-[40px] mt-3 leading-[1.05]">
                Protokół z pomiarów <span className="text-grad-volt">ochronnych</span>
              </h1>
              <p className="font-mono text-[13px] text-volt mt-2">{meta.reportNumber}</p>
            </div>
            <div className="flex flex-wrap gap-3 no-print">
              <button onClick={() => window.print()} className="btn btn-ghost btn-sm" type="button">
                <Printer size={15} aria-hidden /> Drukuj
              </button>
              {(persistence?.reportId || payload.isDemo) && (
                <a
                  href={persistence?.reportId ? `/api/reports/${persistence.reportId}/pdf` : "/api/demo/pdf"}
                  className="btn btn-primary btn-sm"
                  download
                >
                  <FileDown size={15} aria-hidden /> Pobierz PDF (A4)
                </a>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => navigator.clipboard?.writeText(shareUrl ?? window.location.href).catch(() => {})}
              >
                Kopiuj {shareUrl ? "link publiczny" : "link"}
              </button>
            </div>
          </div>

          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line/40 rounded-xl overflow-hidden mt-8 hairline">
            {[
              ["Obiekt", meta.object],
              ["Adres", meta.objectAddress],
              ["Zleceniodawca", meta.client],
              ["Wykonawca", meta.contractor],
            ].map(([k, v]) => (
              <div key={k} className="bg-abyss px-5 py-4">
                <dt className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase">{k}</dt>
                <dd className="text-[13.5px] text-mist mt-1.5 leading-snug">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] text-faint font-mono">
            {meta.instrumentsDetails?.length ? meta.instrumentsDetails.map(i => i.name).join(" · ") : meta.instrument} · {meta.weather}
          </p>
        </div>

        {/* Szybka nawigacja po raporcie */}
        <nav aria-label="Sekcje raportu" className="relative hairline-t no-print">
          <div className="flex gap-1 overflow-x-auto px-6 md:px-12 py-3">
            {[
              ["#r-podsumowanie", "Podsumowanie"],
              ["#r-wyniki", "Wyniki"],
              ["#r-wykresy", "Wykresy"],
              ["#r-analiza", "Analiza"],
              ["#r-ostrzezenia", "Ostrzeżenia"],
              ["#r-historia", "Historia"],
              ["#r-ocena", "Ocena końcowa"],
              ["#r-podpis", "Podpis"],
              ["#r-zrodla", "Źródła danych"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="chip hover:border-volt hover:text-mist transition-colors whitespace-nowrap">
                {label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      {/* B. OGLĘDZINY */}
      {meta.inspectionChecklist && (
        <section id="r-ogledziny" className="rpt-sec">
          <p className="rpt-sec-label">B · Protokół oględzin (PN-HD 60364-6)</p>
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {[
              [meta.inspectionChecklist.noVisibleDamage, "Brak widocznych uszkodzeń mechanicznych wpływających na bezpieczeństwo"],
              [meta.inspectionChecklist.circuitLabelsOk, "Obecność czytelnych oznaczeń obwodów w rozdzielnicach"],
              [meta.inspectionChecklist.peNmarkingsOk, "Prawidłowe oznakowanie zacisków i przewodów PE / N"],
              [meta.inspectionChecklist.protectionMatchesWiring, "Prawidłowy dobór aparatury zabezpieczającej do przekrojów przewodów"],
              [meta.inspectionChecklist.bondingVisualOk, "Wizualne potwierdzenie obecności i ciągłości połączeń wyrównawczych"],
              [meta.inspectionChecklist.schematicsPresent, "Dostępność schematów strukturalnych (jednokreskowych)"],
            ].map(([val, label], i) => (
              <div key={i} className="flex items-start gap-3 p-3 hairline bg-panel/30 rounded-xl">
                {val ? <CircleCheck size={18} className="text-ok shrink-0 mt-0.5" /> : <CircleX size={18} className="text-crit shrink-0 mt-0.5" />}
                <span className="text-[13px] text-mist">{label as string}</span>
              </div>
            ))}
          </div>
          {meta.inspectionChecklist.notes && (
            <p className="mt-4 text-[13px] text-dim p-4 hairline bg-abyss rounded-xl">
              <strong>Uwagi wykonawcy:</strong> {meta.inspectionChecklist.notes}
            </p>
          )}
        </section>
      )}

      {/* C. PODSUMOWANIE */}
      <section id="r-podsumowanie" className="rpt-sec">
        <p className="rpt-sec-label">C · Podsumowanie wyników</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
          <Kpi label="Punkty pomiarowe" value={s.total} tone="#45e0ff" />
          <Kpi label="Spełniają kryteria" value={s.ok} tone="#49dd8a" />
          <Kpi label="Ostrzeżenia" value={s.warning} tone="#ffb224" />
          <Kpi label="Nieprawidłowości" value={s.critical} tone="#ff6473" />
          <Kpi label="Braki danych" value={s.missing} tone="#5c6d89" />
        </div>
        <p className="mt-6 text-[14px] text-dim leading-relaxed max-w-3xl print-dim">
          Oceniono <strong className="text-mist">{s.total} punktów pomiarowych</strong>, z czego {s.rcdProtected}{" "}
          objętych jest dodatkową ochroną różnicowoprądową.{" "}
          {s.critical > 0 ? (
            <>
              Wykryto <strong className="text-crit">{s.critical} nieprawidłowość krytyczną</strong> wymagającą usunięcia
              przed zatwierdzeniem oceny pozytywnej.
            </>
          ) : (
            <>Nie stwierdzono nieprawidłowości krytycznych.</>
          )}{" "}
          Szczegóły w sekcjach E–G. Ocenę końcową zatwierdza wykonawca.
        </p>
      </section>

      {/* D. WYNIKI — tabela interaktywna */}
      <section id="r-wyniki" className="rpt-sec">
        <p className="rpt-sec-label">D · Wyniki pomiarów</p>
        <ResultsTable points={analysis.points} history={history} />
      </section>

      {/* E. WYKRESY */}
      <section id="r-wykresy" className="rpt-sec">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="rpt-sec-label flex-1">E · Wizualizacja wyników</p>
          <label className="no-print inline-flex items-center gap-2 text-[12px] text-dim cursor-pointer select-none">
            <input
              type="checkbox"
              checked={animationsOn}
              onChange={(e) => setAnimationsOn(e.target.checked)}
              className="accent-[#45e0ff] w-4 h-4"
            />
            Animacje wykresów
          </label>
        </div>
        <ReportCharts analysis={analysis} animations={animationsOn && !reduced} />
      </section>

      {/* F. ANALIZA (Moduł B — AI / regułowy) */}
      <section id="r-analiza" className="rpt-sec">
        <p className="rpt-sec-label">F · Analiza i interpretacja</p>
        <AiAnalysis analysis={analysis} />
      </section>

      {/* G–H. OSTRZEŻENIA I ZALECENIA */}
      <section id="r-ostrzezenia" className="rpt-sec">
        <p className="rpt-sec-label">G–H · Ostrzeżenia i zalecenia</p>
        <FindingsPanel
          findings={analysis.findings}
          pushAudit={pushAudit}
          storageKey={`dl.decisions.${meta.reportNumber}`}
          reportId={persistence?.reportId}
          initialDecisions={persistence?.initialDecisions}
          readOnly={readOnly}
        />
      </section>

      {/* I–J. HISTORIA + PROGNOZA (Smart Compare+) */}
      {history && history.length > 0 && (
        <section id="r-historia" className="rpt-sec">
          <div className="flex items-center gap-3">
            <p className="rpt-sec-label flex-1">I–J · Historia pomiarów · Smart Compare+</p>
            <span className="badge st-info">Porównanie serii</span>
          </div>
          <SmartCompare analysis={analysis} history={history} animations={animationsOn && !reduced} />
        </section>
      )}

      {/* K. OCENA KOŃCOWA + PODPIS */}
      <section id="r-ocena" className="rpt-sec">
        <p className="rpt-sec-label">K · Ocena końcowa — zatwierdzenie wykonawcy</p>
        <ApprovalPanel
          meta={meta}
          analysis={analysis}
          pushAudit={pushAudit}
          storageKey={`dl.approval.${meta.reportNumber}`}
          reportId={persistence?.reportId}
          initialApproval={persistence?.initialApproval}
          readOnly={readOnly}
        />
      </section>

      <section id="r-podpis" className="rpt-sec">
        <p className="rpt-sec-label">L · Podpis</p>
        <SignatureBlock meta={meta} />
      </section>

      {/* M. ŹRÓDŁA DANYCH */}
      <section id="r-zrodla" className="rpt-sec">
        <p className="rpt-sec-label">M · Źródła danych i przyrządy</p>
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 mt-6 items-start">
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {[
              ["Plik źródłowy", meta.source.fileName],
              ["Data importu", new Date(meta.source.importedAt).toLocaleString("pl-PL")],
              ["Liczba rekordów", String(analysis.summary.total)],
              ["Wersja algorytmów", analysis.algorithmVersion],
              ["Zestaw kryteriów", analysis.criteriaSet],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase">{k}</dt>
                <dd className="text-[13.5px] text-mist mt-1 break-words">{v}</dd>
              </div>
            ))}
            {meta.instrumentsDetails?.length ? (
              <div className="sm:col-span-2 mt-4">
                <dt className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase mb-3">Przyrządy pomiarowe</dt>
                <div className="grid gap-2">
                  {meta.instrumentsDetails.map((inst, i) => (
                    <div key={i} className="flex justify-between items-center bg-panel2 p-3 rounded-lg hairline">
                      <div>
                        <span className="font-bold text-mist text-[13px]">{inst.name}</span>
                        <span className="text-dim text-[12px] ml-2">SN: {inst.serialNo}</span>
                      </div>
                      <div className="text-right text-[11px] text-faint">
                        Wzorcowanie: {inst.calibrationNo} (ważne do {inst.calibrationValidUntil})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="sm:col-span-2 mt-4">
              <dt className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase flex items-center gap-2">
                <Database size={12} aria-hidden /> Hash SHA-256 zbioru danych
              </dt>
              <dd className="num-mono text-[12px] text-volt mt-1 break-all">{hash}</dd>
            </div>
          </dl>
          {qrDataUrl && (
            <figure className="no-print text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Kod QR do raportu interaktywnego" width={132} height={132} className="rounded-lg border border-line2" />
              <figcaption className="mt-2 font-mono text-[10px] text-faint uppercase tracking-[0.16em] flex items-center gap-1.5 justify-center">
                <QrCode size={12} aria-hidden /> raport interaktywny
              </figcaption>
            </figure>
          )}
        </div>

        {/* Historia zatwierdzeń / zmian */}
        <div className="mt-10">
          <p className="font-mono text-[10.5px] tracking-[0.24em] text-faint uppercase flex items-center gap-2 mb-4">
            <HistoryIcon size={13} aria-hidden /> Historia zatwierdzeń i zmian w raporcie
          </p>
          {audit.length === 0 ? (
            <p className="text-[13px] text-faint">Brak wpisów — decyzje instalatora będą rejestrowane tutaj automatycznie.</p>
          ) : (
            <ol className="space-y-2.5">
              {audit.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] hairline rounded-lg px-4 py-3 bg-panel/60">
                  <span className="num-mono text-dim">{e.at}</span>
                  <span className="text-mist">{e.who}</span>
                  <span className="text-volt">{e.action}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </article>
  );
}

/* ---------------------------------------------------------------- */
/* KPI                                                               */
/* ---------------------------------------------------------------- */

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rpt-kpi">
      <div className="num" style={{ color: tone }}>
        <CountUp value={value} />
      </div>
      <div className="lbl font-mono text-[10px] tracking-[0.18em] uppercase text-dim mt-2.5">{label}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* C. Tabela wyników — sortowanie / filtr / szukajka / szczegóły     */
/* ---------------------------------------------------------------- */

type SortKey = "code" | "location" | "zs" | "riso" | "continuity" | "rcdTime" | "overall";

function ResultsTable({ points, history }: { points: PointEval[]; history?: HistorySample[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [dir, setDir] = useState<1 | -1>(1);
  const [filter, setFilter] = useState<MeasureStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: points.length, OK: 0, WARNING: 0, CRITICAL: 0, MISSING: 0 };
    for (const p of points) c[p.overall] += 1;
    return c;
  }, [points]);

  const rows = useMemo(() => {
    let out = [...points];
    if (filter !== "ALL") out = out.filter((p) => p.overall === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter((p) =>
        [p.point.code, p.point.location, p.point.circuit].some((f) => f.toLowerCase().includes(q))
      );
    }
    const val = (p: PointEval): string | number => {
      switch (sortKey) {
        case "zs": return p.zs.value ?? Infinity;
        case "riso": return p.riso.value ?? -Infinity;
        case "continuity": return p.continuity.value ?? Infinity;
        case "rcdTime": return p.rcdTime?.value ?? Infinity;
        case "location": return p.point.location;
        case "overall": return p.overall;
        default: return p.point.code;
      }
    };
    out.sort((a, b) => {
      const va = val(a); const vb = val(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pl");
      return cmp * dir;
    });
    return out;
  }, [points, sortKey, dir, filter, query]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setDir(1); }
  };

  const H = ({ k, label }: { k: SortKey; label: string }) => (
    <th aria-sort={sortKey === k ? (dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1.5 hover:text-volt transition-colors uppercase tracking-[0.14em] font-inherit text-inherit">
        {label}
        <ArrowUpDown size={11} className={sortKey === k ? "text-volt" : "text-faint"} aria-hidden />
      </button>
    </th>
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3 no-print">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj punktu, lokalizacji, obwodu…"
            aria-label="Szukaj w wynikach"
            className="input !pl-10 !py-2.5 text-[13.5px]"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr statusu">
          {(["ALL", "OK", "WARNING", "CRITICAL", "MISSING"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`chip transition-colors ${filter === f ? "!border-volt !text-mist bg-volt/10" : "hover:text-mist"}`}
              aria-pressed={filter === f}
            >
              {f === "ALL" ? "Wszystkie" : STATUS_LABEL[f]}
              <span className="num-mono text-[10px] opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto mt-5 hairline rounded-xl">
        <table className="rpt-table min-w-[880px]">
          <thead>
            <tr>
              <H k="code" label="Punkt" />
              <H k="location" label="Lokalizacja / obwód" />
              <th>Zabezpieczenie</th>
              <H k="zs" label="Zs [Ω] · limit" />
              <H k="riso" label="Riso [MΩ]" />
              <H k="continuity" label="Ciągłość [Ω]" />
              <H k="rcdTime" label="RCD t [ms]" />
              <H k="overall" label="Status" />
              <th className="no-print" aria-label="Szczegóły" />
            </tr>
          </thead>
          <tbody>
            {rows.map((ev) => {
              const p = ev.point;
              const open = expanded === p.code;
              return (
                <FragmentRow
                  key={p.code}
                  ev={ev}
                  open={open}
                  history={history}
                  onToggle={() => setExpanded(open ? null : p.code)}
                />
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center !py-10 text-dim">
                  Brak wyników dla wybranych filtrów.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-faint">Wyświetlono {rows.length} z {points.length} punktów. Kliknij wiersz, aby zobaczyć szczegóły punktu pomiarowego.</p>
    </div>
  );
}

function FragmentRow({
  ev, open, onToggle, history,
}: {
  ev: PointEval;
  open: boolean;
  onToggle: () => void;
  history?: HistorySample[];
}) {
  const p = ev.point;
  const prot = `${p.protection.curve}${p.protection.inA}${p.protection.rcdmA ? ` · RCD ${p.protection.rcdmA} mA` : ""}`;
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer" aria-expanded={open}>
        <td className="num-mono font-semibold text-volt">{p.code}</td>
        <td>
          <div className="text-mist">{p.location}</div>
          <div className="text-[12px] text-faint">{p.circuit}</div>
        </td>
        <td className="num-mono text-[12.5px] text-dim">{prot}</td>
        <td className="num-mono">
          <span style={{ color: STATUS_COLOR[ev.zs.status] }}>{fmt(ev.zs.value)}</span>
          <span className="text-faint text-[11.5px]"> / {ev.zs.limitText}</span>
        </td>
        <td className="num-mono" style={{ color: STATUS_COLOR[ev.riso.status] }}>{fmt(ev.riso.value)}</td>
        <td className="num-mono" style={{ color: STATUS_COLOR[ev.continuity.status] }}>{fmt(ev.continuity.value)}</td>
        <td className="num-mono">{ev.rcdTime ? <span style={{ color: STATUS_COLOR[ev.rcdTime.status] }}>{fmt(ev.rcdTime.value)}</span> : "—"}</td>
        <td>
          <span className={`badge ${STATUS_CLASS[ev.overall]}`}>{STATUS_LABEL[ev.overall]}</span>
        </td>
        <td className="no-print">
          <ChevronDown size={15} className={`text-faint transition-transform ${open ? "rotate-180 text-volt" : ""}`} aria-hidden />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} className="!p-0">
            <div className="bg-panel/70 border-l-2 border-volt px-5 py-5 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <DetailCell title="Impedancja pętli zwarcia" v={ev.zs} />
              <DetailCell title="Rezystancja izolacji (500 V DC)" v={ev.riso} />
              <DetailCell title="Ciągłość przewodu ochronnego" v={ev.continuity} />
              {ev.rcdTime && <DetailCell title="RCD — czas zadziałania" v={ev.rcdTime} />}
              {ev.rcdCurrent && <DetailCell title="RCD — prąd wyzwalania" v={ev.rcdCurrent} />}
              {history && <HistorySpark pointCode={p.code} history={history} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailCell({ title, v }: { title: string; v: { value: number | null; unit: string; limitText: string; criterion: string; status: MeasureStatus } }) {
  return (
    <div className="hairline rounded-lg p-3.5 bg-abyss/70">
      <p className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-faint">{title}</p>
      <p className="mt-2 text-[15px] font-mono" style={{ color: STATUS_COLOR[v.status] }}>
        {fmt(v.value, v.unit)} <span className="text-faint text-[11px]">· {v.limitText}</span>
      </p>
      <p className="mt-1.5 text-[11px] text-faint leading-snug">{v.criterion}</p>
    </div>
  );
}

function HistorySpark({ pointCode, history }: { pointCode: string; history: HistorySample[] }) {
  const cmp = compareHistory(history, pointCode);
  const vals = cmp.values.filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals); const max = Math.max(...vals); const range = max - min || 1;
  const W = 150; const H = 44;
  const pts = cmp.values
    .map((v, i) => (v === null ? null : `${(i / (cmp.values.length - 1)) * W},${H - 4 - ((v - min) / range) * (H - 10)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <div className="hairline rounded-lg p-3.5 bg-abyss/70">
      <p className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-faint">Trend Zs · Smart Compare+</p>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="mt-1.5" aria-hidden>
        <polyline points={pts} fill="none" stroke="#45e0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {cmp.values.map((v, i) =>
          v === null ? null : (
            <circle key={i} cx={(i / (cmp.values.length - 1)) * W} cy={H - 4 - ((v - min) / range) * (H - 10)} r="2.6" fill="#45e0ff" />
          )
        )}
      </svg>
      <p className="text-[11px] text-dim mt-1">{cmp.dates[0].slice(0, 4)} → {cmp.dates[cmp.dates.length - 1].slice(0, 4)}: {cmp.trendPct !== null ? `${cmp.trendPct > 0 ? "+" : ""}${String(cmp.trendPct).replace(".", ",")}%` : "—"}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* D. Wykresy (Chart.js)                                             */
/* ---------------------------------------------------------------- */

function baseChartDefaults() {
  Chart.defaults.color = "#93a5c2";
  Chart.defaults.font.family = "'JetBrains Mono', ui-monospace, monospace";
  Chart.defaults.font.size = 10.5;
  Chart.defaults.borderColor = "rgba(28, 42, 69, 0.8)";
}

function ReportCharts({ analysis, animations }: { analysis: AnalysisResult; animations: boolean }) {
  const zsRef = useRef<HTMLCanvasElement>(null);
  const rcdRef = useRef<HTMLCanvasElement>(null);
  const distRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    baseChartDefaults();
    const anim = animations ? { duration: 900, easing: "easeOutQuart" as const } : false;
    const charts: Chart[] = [];
    const pts = analysis.points;

    // 1. Zs + limit
    if (zsRef.current) {
      const cfg = {
        data: {
          labels: pts.map((p) => p.point.code),
          datasets: [
            {
              type: "bar", label: "Zs [Ω]",
              data: pts.map((p) => p.zs.value),
              backgroundColor: pts.map((p) => `${STATUS_COLOR[p.zs.status]}cc`),
              borderColor: pts.map((p) => STATUS_COLOR[p.zs.status]),
              borderWidth: 1.5, borderRadius: 5, maxBarThickness: 34,
            },
            {
              type: "line", label: "Limit Zs",
              data: pts.map((p) => p.zs.limit),
              borderColor: "#45e0ff", borderDash: [6, 5], borderWidth: 1.6,
              pointRadius: 0, stepped: true,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: anim,
          scales: { y: { beginAtZero: true, title: { display: true, text: "Ω" } } },
          plugins: {
            legend: { labels: { boxWidth: 12, boxHeight: 2 } },
            tooltip: {
              callbacks: {
                afterBody: (items: { dataIndex: number }[]) => {
                  const p = pts[items[0]?.dataIndex ?? 0];
                  return `${p.point.location} · ${p.point.protection.curve}${p.point.protection.inA}`;
                },
              },
            },
          },
        },
      } as unknown as ChartConfiguration;
      charts.push(new Chart(zsRef.current, cfg));
    }

    // 2. RCD — czasy zadziałania
    if (rcdRef.current) {
      const rcdPts = pts.filter((p) => p.rcdTime && p.rcdTime.value !== null);
      if (rcdPts.length > 0) {
        const cfg = {
          data: {
            labels: rcdPts.map((p) => p.point.code),
            datasets: [
              {
                type: "bar", label: "Czas zadziałania [ms]",
                data: rcdPts.map((p) => p.rcdTime!.value),
                backgroundColor: rcdPts.map((p) => `${STATUS_COLOR[p.rcdTime!.status]}cc`),
                borderColor: rcdPts.map((p) => STATUS_COLOR[p.rcdTime!.status]),
                borderWidth: 1.5, borderRadius: 5, maxBarThickness: 30,
              },
              {
                type: "line", label: "Limit 300 ms",
                data: rcdPts.map(() => 300),
                borderColor: "#ffb224", borderDash: [6, 5], borderWidth: 1.6, pointRadius: 0,
              },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false, animation: anim,
            scales: { y: { beginAtZero: true, suggestedMax: 320, title: { display: true, text: "ms" } } },
            plugins: { legend: { labels: { boxWidth: 12, boxHeight: 2 } } },
          },
        } as unknown as ChartConfiguration;
        charts.push(new Chart(rcdRef.current, cfg));
      }
    }

    // 3. Rozkład ocen
    if (distRef.current) {
      const s = analysis.summary;
      const cfg = {
        type: "doughnut",
        data: {
          labels: ["OK", "Ostrzeżenia", "Krytyczne", "Braki"],
          datasets: [{
            data: [s.ok, s.warning, s.critical, s.missing],
            backgroundColor: ["#49dd8a", "#ffb224", "#ff6473", "#5c6d89"],
            borderColor: "#070c16", borderWidth: 3, hoverOffset: 8,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "66%",
          animation: anim,
          plugins: { legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, padding: 14 } } },
        },
      } as unknown as ChartConfiguration;
      charts.push(new Chart(distRef.current, cfg));
    }

    return () => charts.forEach((c) => c.destroy());
  }, [analysis, animations]);

  const hasRcd = analysis.points.some((p) => p.rcdTime?.value != null);

  return (
    <div className="grid lg:grid-cols-5 gap-5 mt-6">
      <figure className="rpt-kpi lg:col-span-3 !p-5">
        <ChartTitle icon={<ScanLine size={14} aria-hidden />} title="Impedancja pętli zwarcia względem limitu" />
        <div className="h-[280px] mt-3"><canvas ref={zsRef} aria-label="Wykres impedancji pętli zwarcia z linią limitu" role="img" /></div>
      </figure>
      <figure className="rpt-kpi lg:col-span-2 !p-5">
        <ChartTitle icon={<CircleCheck size={14} aria-hidden />} title="Rozkład ocen punktów" />
        <div className="h-[280px] mt-3"><canvas ref={distRef} aria-label="Wykres rozkładu ocen" role="img" /></div>
      </figure>
      {hasRcd && (
        <figure className="rpt-kpi lg:col-span-5 !p-5">
          <ChartTitle icon={<ShieldCheck size={14} aria-hidden />} title="Czasy zadziałania zabezpieczeń RCD (przy 1×IΔn)" />
          <div className="h-[220px] mt-3"><canvas ref={rcdRef} aria-label="Wykres czasów zadziałania RCD" role="img" /></div>
        </figure>
      )}
    </div>
  );
}

function ChartTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <figcaption className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] uppercase text-dim">
      <span className="text-volt">{icon}</span> {title}
    </figcaption>
  );
}

/* ---------------------------------------------------------------- */
/* E. Analiza — Moduł B                                             */
/* ---------------------------------------------------------------- */

function AiAnalysis({ analysis }: { analysis: AnalysisResult }) {
  const [text, setText] = useState<string | null>(null);
  const [mode, setMode] = useState<"ai" | "rules" | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/ai-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { text: string; mode: "ai" | "rules" }) => { setText(d.text); setMode(d.mode); })
      .catch(() => { if (!ctrl.signal.aborted) setError(true); });
    return () => ctrl.abort();
  }, [analysis]);

  return (
    <div className="mt-6 card !rounded-2xl p-6 md:p-8 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-72 h-72 glow-volt pointer-events-none" aria-hidden />
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid place-items-center w-9 h-9 rounded-lg border border-line2 bg-abyss text-volt">
          <Sparkles size={16} aria-hidden />
        </span>
        <div>
          <p className="font-display font-semibold text-[15px]">Interpretacja wyników — Moduł B</p>
          <p className="text-[12px] text-faint">Tekst pomocniczy; wymaga weryfikacji i zatwierdzenia przez wykonawcę.</p>
        </div>
        {mode && (
          <span className={`badge ml-auto ${mode === "ai" ? "st-info" : "st-miss"}`}>
            {mode === "ai" ? "Wygenerowane przez AI" : "Tryb regułowy (brak klucza AI)"}
          </span>
        )}
      </div>

      <div className="mt-5 text-[14.5px] leading-[1.85] text-mist/90 space-y-4 max-w-4xl">
        {error && (
          <p className="flex items-center gap-2 text-amp"><TriangleAlert size={15} aria-hidden /> Nie udało się pobrać analizy — spróbuj ponownie lub kontynuuj z oceną własną.</p>
        )}
        {!text && !error && (
          <div className="space-y-3 animate-pulse" aria-label="Trwa generowanie analizy">
            <div className="h-3.5 rounded bg-line/60 w-full" />
            <div className="h-3.5 rounded bg-line/60 w-11/12" />
            <div className="h-3.5 rounded bg-line/60 w-4/5" />
          </div>
        )}
        {text?.split("\n\n").map((para, i) => <p key={i}>{para}</p>)}
      </div>

      <p className="mt-6 flex items-start gap-2 text-[12px] text-faint leading-relaxed border-t border-line pt-4">
        <ShieldCheck size={14} className="text-volt shrink-0 mt-0.5" aria-hidden />
        Moduł AI nie wymyśla wyników i nie potwierdza bezpieczeństwa instalacji. Każda decyzja wymaga zatwierdzenia przez kwalifikowanego instalatora.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* F–G. Ostrzeżenia i zalecenia — zarządzanie decyzjami              */
/* ---------------------------------------------------------------- */

type Decision = "PENDING" | "ACCEPTED" | "REJECTED" | "EDITED";

function FindingsPanel({
  findings,
  pushAudit,
  storageKey,
  reportId,
  initialDecisions,
  readOnly = false,
}: {
  findings: Finding[];
  pushAudit: (a: string) => void;
  storageKey: string;
  reportId?: string;
  initialDecisions?: Record<string, { decision: Decision; note?: string; edited?: string }>;
  readOnly?: boolean;
}) {
  /* Decyzje: raport z bazy → stan serwerowy; inaczej localStorage
     (z tego powstaje wersja robocza przy automatycznym wylogowaniu). */
  const [decisions, setDecisions] = useState<Record<string, { decision: Decision; note?: string; edited?: string }>>(() => {
    if (reportId) return initialDecisions ?? {};
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, { decision: Decision; note?: string; edited?: string }>;
    } catch {
      return {};
    }
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const restoredRef = useRef(Object.keys(decisions).length);
  const [showRestored, setShowRestored] = useState(restoredRef.current > 0);

  useEffect(() => {
    try {
      if (Object.keys(decisions).length > 0) localStorage.setItem(storageKey, JSON.stringify(decisions));
    } catch { /* ignoruj */ }
  }, [decisions, storageKey]);

  /* Zapis decyzji na serwerze (raport z bazy) — debounce 600 ms */
  const skipFirst = useRef(true);
  useEffect(() => {
    if (!reportId) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/reports/${reportId}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [decisions, reportId]);

  const decide = (f: Finding, decision: Decision, note?: string, edited?: string) => {
    setDecisions((d) => ({ ...d, [f.id]: { decision, note, edited } }));
    const label =
      decision === "ACCEPTED" ? "zaakceptowano" :
      decision === "REJECTED" ? "odrzucono" : "zedytowano";
    pushAudit(`${label} wpis „${f.parameter}" (${f.pointCode})${note ? ` — uzasadnienie: ${note}` : ""}`);
    setEditing(null);
  };

  if (findings.length === 0) {
    return (
      <p className="mt-6 flex items-center gap-2 text-[14px] text-ok">
        <CircleCheck size={16} aria-hidden /> Brak ostrzeżeń — wszystkie wyniki spełniają kryteria.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {showRestored && (
        <p className="no-print flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-info hairline !border-info/40 rounded-lg px-4 py-3 bg-info/8">
          <span>Przywrócono {restoredRef.current} decyzji z wersji roboczej tego raportu (zapisanej przy poprzedniej sesji).</span>
          <button type="button" onClick={() => setShowRestored(false)} className="underline underline-offset-4 hover:text-mist">Rozumiem</button>
        </p>
      )}
      {findings.map((f) => {
        const st = decisions[f.id];
        const Icon = f.category === "KRYTYCZNE" ? CircleX : f.category === "OSTRZEŻENIE" ? TriangleAlert : f.category === "ZALECENIE" ? Check : Info;
        return (
          <article key={f.id} className={`hairline rounded-2xl p-5 md:p-6 bg-panel/60 transition-opacity ${st && st.decision !== "EDITED" ? "opacity-80" : ""}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Icon size={17} className={f.category === "KRYTYCZNE" ? "text-crit" : f.category === "OSTRZEŻENIE" ? "text-amp" : "text-info"} aria-hidden />
              <span className={`badge ${CAT_CLASS[f.category] ?? "st-miss"}`}>{f.category}</span>
              <span className="num-mono text-[12px] text-volt">{f.pointCode}</span>
              <h3 className="font-display font-semibold text-[15px]">{f.parameter}</h3>
              {st && (
                <span className="badge st-ok ml-auto">
                  {st.decision === "ACCEPTED" ? "Zaakceptowano" : st.decision === "REJECTED" ? "Odrzucono" : "Zedytowano"}
                </span>
              )}
            </div>
            <dl className="grid md:grid-cols-2 gap-x-10 gap-y-3 mt-4 text-[13.5px]">
              <div>
                <dt className="font-mono text-[10px] tracking-[0.16em] uppercase text-faint">Wynik / kryterium</dt>
                <dd className="mt-1 text-mist">{f.result}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-[0.16em] uppercase text-faint">Podstawa</dt>
                <dd className="mt-1 text-dim">{f.criterion}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-[0.16em] uppercase text-faint">Możliwa przyczyna</dt>
                <dd className="mt-1 text-dim">{f.cause}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-[0.16em] uppercase text-faint">Proponowane działanie</dt>
                <dd className="mt-1 text-mist">{st?.edited ?? f.action}</dd>
              </div>
            </dl>
            {st?.note && <p className="mt-3 text-[12.5px] text-amp">Uzasadnienie zmiany: {st.note}</p>}

            <div className="no-print flex flex-wrap gap-2.5 mt-5">
              {readOnly && !st && (
                <span className="text-[12px] text-faint font-mono">podgląd współdzielony — decyzje zastrzeżone dla wykonawcy</span>
              )}
              {!readOnly && !st && editing !== f.id && (
                <>
                  <button type="button" onClick={() => decide(f, "ACCEPTED")} className="btn btn-ghost btn-sm !border-ok/40 hover:!border-ok text-ok">
                    <Check size={14} aria-hidden /> Akceptuj
                  </button>
                  <button type="button" onClick={() => { setEditing(f.id); setDraft(f.action); }} className="btn btn-ghost btn-sm">
                    <Pencil size={14} aria-hidden /> Edytuj
                  </button>
                  <button type="button" onClick={() => { setEditing(f.id); setDraft(""); }} className="btn btn-ghost btn-sm !border-crit/40 hover:!border-crit text-crit">
                    Odrzuć / uzasadnij
                  </button>
                </>
              )}
              {editing === f.id && (
                <div className="w-full space-y-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    className="input text-[13.5px]"
                    placeholder="Treść zalecenia lub uzasadnienie odrzucenia…"
                    aria-label="Edycja lub uzasadnienie"
                  />
                  <div className="flex gap-2.5">
                    <button type="button" disabled={!draft.trim()} onClick={() => decide(f, draft === f.action ? "ACCEPTED" : "EDITED", undefined, draft)} className="btn btn-primary btn-sm disabled:opacity-40">
                      Zapisz zmianę
                    </button>
                    <button type="button" onClick={() => decide(f, "REJECTED", draft || "bez uzasadnienia")} className="btn btn-ghost btn-sm !border-crit/40 text-crit">
                      Odrzuć z uzasadnieniem
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Anuluj</button>
                  </div>
                </div>
              )}
            </div>
          </article>
        );
      })}
      <p className="no-print text-[12px] text-faint">Decyzje rejestrowane w historii zmian raportu (sekcja L). W wersji DEMO zmiany dotyczą tylko bieżącego widoku.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* H–I. Smart Compare+                                               */
/* ---------------------------------------------------------------- */

function SmartCompare({ analysis, history, animations }: { analysis: AnalysisResult; history: HistorySample[]; animations: boolean }) {
  const candidates = useMemo(
    () => analysis.points.filter((p) => history.some((h) => h.values[p.point.code] !== undefined)).map((p) => p.point.code),
    [analysis, history]
  );
  const [selected, setSelected] = useState<string>(candidates[0] ?? "");
  const ref = useRef<HTMLCanvasElement>(null);
  const cmp = useMemo(() => (selected ? compareHistory(history, selected) : null), [history, selected]);
  const ev = analysis.points.find((p) => p.point.code === selected);

  useEffect(() => {
    if (!ref.current || !cmp || !ev) return;
    baseChartDefaults();
    const labels = [...cmp.dates];
    const values = [...cmp.values];
    let prog: (number | null)[] | null = null;
    if (cmp.comparable && values.length >= 3) {
      // Prosta prognoza liniowa (ostatnia regresja) — pokazana z zastrzeżeniem
      const xs = values.map((_, i) => i);
      const ys = values.map((v) => v ?? null);
      const valid = xs.filter((i) => ys[i] !== null);
      const n = valid.length;
      const mx = valid.reduce((a, b) => a + b, 0) / n;
      const my = valid.reduce((a, i) => a + (ys[i] as number), 0) / n;
      const num = valid.reduce((a, i) => a + (i - mx) * ((ys[i] as number) - my), 0);
      const den = valid.reduce((a, i) => a + (i - mx) ** 2, 0) || 1;
      const slope = num / den;
      const next = +(my + slope * (values.length - mx)).toFixed(2);
      labels.push("prognoza (+12 mies.)");
      values.push(null);
      prog = values.map(() => null);
      prog[values.length - 2] = values[values.length - 2];
      prog.push(next);
    }
    const limit = ev.zs.limit;
    const cfg = {
      data: {
        labels,
        datasets: [
          {
            type: "line", label: `Zs [Ω] — ${selected}`,
            data: values,
            borderColor: "#45e0ff", backgroundColor: "#45e0ff",
            tension: 0.35, borderWidth: 2.4, pointRadius: 4, pointHoverRadius: 6,
            fill: { target: "origin", above: "rgba(69,224,255,0.07)" },
          },
          ...(prog
            ? [{
                type: "line", label: "Prognoza trendu",
                data: prog, borderColor: "#ffb224", borderDash: [7, 6], borderWidth: 2,
                pointRadius: 5, pointStyle: "rectRot" as const, pointBackgroundColor: "#ffb224",
              }]
            : []),
          {
            type: "line", label: "Limit Zs",
            data: labels.map(() => limit),
            borderColor: "#ff6473", borderDash: [4, 5], borderWidth: 1.5, pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: animations ? { duration: 800 } : false,
        scales: { y: { title: { display: true, text: "Ω" } } },
        plugins: { legend: { labels: { boxWidth: 12, boxHeight: 2 } } },
      },
    } as unknown as ChartConfiguration;
    const chart = new Chart(ref.current, cfg);
    return () => chart.destroy();
  }, [cmp, selected, animations, ev]);

  if (candidates.length === 0) return null;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-6">
      <div className="rpt-kpi !p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 no-print">
          <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-dim">Impedancja Zs w czasie — ten sam punkt pomiarowy</p>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input !w-auto !py-2 !px-3 text-[12.5px]" aria-label="Wybierz punkt pomiarowy">
            {candidates.map((c) => <option key={c} value={c}>{c} — {analysis.points.find((p) => p.point.code === c)?.point.location}</option>)}
          </select>
        </div>
        <div className="h-[260px] mt-4"><canvas ref={ref} aria-label="Wykres trendu Zs z prognozą" role="img" /></div>
      </div>
      <aside className="space-y-4">
        <div className="rpt-kpi">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-faint">Wniosek z porównania</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-mist">{cmp?.note}</p>
          {cmp?.trendPct !== null && cmp?.trendPct !== undefined && (
            <p className="mt-2 num-mono text-[22px]" style={{ color: Math.abs(cmp.trendPct) < 5 ? "#49dd8a" : "#ffb224" }}>
              {cmp.trendPct > 0 ? "+" : ""}{String(cmp.trendPct).replace(".", ",")}%
              <span className="text-[11px] text-faint ml-2">vs {cmp.dates[0].slice(0, 4)}</span>
            </p>
          )}
        </div>
        <div className="rpt-kpi">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-faint flex items-center gap-1.5">
            <Info size={12} aria-hidden /> Ograniczenia modelu
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
            Prognoza powstaje wyłącznie przy ≥ 3 porównywalnych seriach pomiarowych i stanowi ekstrapolację trendu —
            nie gwarantuje przyszłego stanu instalacji. Porównanie wymaga tych samych metod i warunków pomiaru.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* J. Ocena końcowa                                                  */
/* ---------------------------------------------------------------- */

function ApprovalPanel({
  meta, analysis, pushAudit, storageKey, reportId, initialApproval, readOnly = false,
}: {
  meta: ReportMeta;
  analysis: AnalysisResult;
  pushAudit: (a: string) => void;
  storageKey: string;
  reportId?: string;
  initialApproval?: { assessment: "POZYTYWNA" | "WARUNKOWA" | "NEGATYWNA"; approvedAt: string } | null;
  readOnly?: boolean;
}) {
  /* Ocena: raport z bazy → zatwierdzenie serwerowe (audit + historia pomiarów);
     inaczej persystencja lokalna wersji roboczej. Checkboxy celowo NIE są
     przywracane — potwierdzenia wymagają każdorazowo świadomej decyzji. */
  const [verdict, setVerdict] = useState<"POZYTYWNA" | "WARUNKOWA" | "NEGATYWNA" | null>(() => {
    if (initialApproval) return initialApproval.assessment;
    if (typeof window === "undefined") return null;
    try {
      const s = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { verdict?: "POZYTYWNA" | "WARUNKOWA" | "NEGATYWNA"; locked?: string } | null;
      return s?.verdict ?? null;
    } catch { return null; }
  });
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [locked, setLocked] = useState<string | null>(() => {
    if (initialApproval) return new Date(initialApproval.approvedAt).toLocaleString("pl-PL");
    if (typeof window === "undefined") return null;
    try {
      const s = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { locked?: string } | null;
      return s?.locked ?? null;
    } catch { return null; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withCritical = analysis.summary.critical > 0;

  useEffect(() => {
    try {
      if (verdict || locked) localStorage.setItem(storageKey, JSON.stringify({ verdict, locked }));
    } catch { /* ignoruj */ }
  }, [verdict, locked, storageKey]);

  const approve = async () => {
    if (!verdict) return;
    if (reportId) {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/reports/${reportId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessment: verdict, confirmDataVerification: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Nie udało się zatwierdzić raportu.");
          setBusy(false);
          return;
        }
        const at = new Date(data.approvedAt).toLocaleString("pl-PL");
        setLocked(at);
        pushAudit(`Zatwierdzono raport — ocena końcowa: ${verdict}`);
      } catch {
        setError("Błąd połączenia z serwerem.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const at = new Date().toLocaleString("pl-PL");
    setLocked(at);
    pushAudit(`Zatwierdzono raport — ocena końcowa: ${verdict}`);
  };

  return (
    <div className="mt-6 grid lg:grid-cols-[1.2fr_1fr] gap-6">
      <div className="hairline rounded-2xl p-6 bg-panel/60">
        {readOnly ? (
          <div className="flex items-start gap-4">
            <span className="grid place-items-center w-11 h-11 rounded-xl border border-info/40 bg-info/10 text-info shrink-0">
              <FileText size={18} aria-hidden />
            </span>
            <div>
              <p className="font-display font-semibold text-mist">
                {initialApproval ? <>Ocena końcowa: <strong className="text-volt">{initialApproval.assessment}</strong></> : "Ocena końcowa oczekuje na zatwierdzenie wykonawcy"}
              </p>
              <p className="text-[13px] text-dim mt-1">
                {initialApproval
                  ? `Zatwierdzone przez ${meta.installer.name} — ${new Date(initialApproval.approvedAt).toLocaleString("pl-PL")}. Podgląd tylko do odczytu.`
                  : "Podgląd współdzielony — zatwierdzanie i decyzje są zastrzeżone dla wykonawcy badań."}
              </p>
            </div>
          </div>
        ) : locked ? (
          <div className="flex items-start gap-4">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-ok/15 border border-ok/40 text-ok shrink-0">
              <Lock size={18} aria-hidden />
            </span>
            <div>
              <p className="font-display font-semibold text-mist">Raport zatwierdzony</p>
              <p className="text-[13px] text-dim mt-1">
                Ocena <strong className="text-volt">{verdict}</strong> · {locked} · {meta.installer.name}.
                Wpis zapisano w historii zatwierdzeń.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-faint">Wybierz ocenę końcową</p>
            <div className="grid sm:grid-cols-3 gap-3 mt-4" role="radiogroup" aria-label="Ocena końcowa">
              {(["POZYTYWNA", "WARUNKOWA", "NEGATYWNA"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={verdict === v}
                  onClick={() => setVerdict(v)}
                  className={`hairline rounded-xl px-4 py-3.5 text-[13px] font-display font-semibold transition-all ${
                    verdict === v
                      ? v === "POZYTYWNA" ? "border-ok bg-ok/10 text-ok"
                      : v === "WARUNKOWA" ? "border-amp bg-amp/10 text-amp"
                      : "!border-crit bg-crit/10 text-crit"
                      : "text-dim hover:text-mist hover:border-line2"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            {withCritical && verdict === "POZYTYWNA" && (
              <p className="mt-3 flex items-start gap-2 text-[12.5px] text-amp">
                <TriangleAlert size={14} className="shrink-0 mt-0.5" aria-hidden />
                W raporcie występują nieprawidłowości krytyczne — system zaleca ocenę warunkową lub negatywną. Decyzja należy do wykonawcy.
              </p>
            )}
            <label className="flex items-start gap-3 mt-5 text-[13px] text-dim cursor-pointer">
              <input type="checkbox" checked={c1} onChange={(e) => setC1(e.target.checked)} className="accent-[#45e0ff] w-4 h-4 mt-0.5" />
              Potwierdzam, że zweryfikowałem/am wszystkie dane pomiarowe oraz wyniki analizy systemu.
            </label>
            <label className="flex items-start gap-3 mt-3 text-[13px] text-dim cursor-pointer">
              <input type="checkbox" checked={c2} onChange={(e) => setC2(e.target.checked)} className="accent-[#45e0ff] w-4 h-4 mt-0.5" />
              Rozumiem, że system wspomaga analizę, lecz nie zastępuje moich kwalifikacji — ocenę końcową zatwierdzam jako wykonawca badań.
            </label>
            {error && <p className="mt-3 text-[12.5px] text-crit" role="alert">{error}</p>}
            <button
              type="button"
              disabled={!verdict || !c1 || !c2 || busy}
              onClick={() => void approve()}
              className="btn btn-primary mt-6 disabled:opacity-35 disabled:pointer-events-none"
            >
              <ClipboardCheck size={16} aria-hidden /> {busy ? "Zatwierdzanie…" : reportId ? "Zatwierdź raport (zapis w bazie)" : "Zatwierdź raport"}
            </button>
          </>
        )}
      </div>

      <div className="hairline rounded-2xl p-6 bg-panel/40">
        <p className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-faint flex items-center gap-2">
          <ShieldCheck size={13} aria-hidden /> Odpowiedzialność
        </p>
        <p className="mt-3 text-[12.5px] leading-[1.8] text-dim">
          Raport przygotowano z wykorzystaniem systemu DiagoLAB Raporty+. Wyniki pochodzą z danych przekazanych przez
          użytkownika. System może wspomagać analizę, ale nie zastępuje kwalifikacji i oceny osoby wykonującej badania.
          Końcową ocenę zatwierdza wykonawca.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* K. Podpis                                                          */
/* ---------------------------------------------------------------- */

function SignatureBlock({ meta }: { meta: ReportMeta }) {
  return (
    <div className="grid md:grid-cols-2 gap-8 mt-6">
      <dl className="space-y-4">
        {[
          ["Wykonawca", meta.installer.name],
          ["Firma", meta.installer.company],
          ["Nr świadectwa kwalifikacyjnego", meta.installer.certificateNo],
          ["Zakres kwalifikacji", meta.installer.scope],
          ["Data zatwierdzenia", `${meta.date} (zatwierdzenie w sekcji J)`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase">{k}</dt>
            <dd className="text-[14px] text-mist mt-1">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <div className="hairline rounded-2xl h-36 grid place-items-center bg-panel/40 relative overflow-hidden">
          <svg width="220" height="74" viewBox="0 0 220 74" aria-label="Podgląd podpisu odręcznego">
            <path
              d="M18 52 C 40 18, 55 16, 58 30 C 61 44, 48 58, 62 52 C 78 45, 84 20, 96 28 C 108 36, 92 56, 108 50 C 124 44, 130 26, 142 34 C 154 42, 140 58, 158 50 C 176 42, 188 30, 205 40"
              fill="none" stroke="#45e0ff" strokeWidth="2.2" strokeLinecap="round" opacity="0.85"
            />
          </svg>
          <span className="absolute bottom-3 font-mono text-[9.5px] tracking-[0.2em] uppercase text-faint flex items-center gap-1.5">
            <SignatureIcon size={11} aria-hidden /> podgląd podpisu odręcznego — to nie jest kwalifikowany podpis elektroniczny
          </span>
        </div>
      </div>
    </div>
  );
}
