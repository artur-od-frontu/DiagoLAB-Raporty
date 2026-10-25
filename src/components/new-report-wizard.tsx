"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CircleCheck,
  TriangleAlert,
  Info,
  Table2,
  Eye,
  CloudUpload,
  Save,
} from "lucide-react";
import {
  registerDraftProvider,
  beginBackgroundOperation,
  endBackgroundOperation,
  signalActivity,
} from "@/components/session-guard";
import {
  IMPORT_COLUMNS,
  autoMapColumns,
  guessColumnMapping,
  looksHeaderless,
  rowsToPoints,
  analyzePoints,
  type MappingDetail,
  type RawPoint,
} from "@/lib/engine";
import type { InstrumentItem } from "@/components/instruments-manager";

type WizardStep = 1 | 2 | 3;

interface FileState {
  name: string;
  sizeKb: number;
  format: "CSV" | "XLSX";
  rows: Record<string, unknown>[];
  headers: string[];
}

interface ImportDraftPayload {
  objectName: string;
  objectAddress?: string;
  clientName?: string;
  weather?: string;
  instruments?: string[];
  inspectionChecklist?: Record<string, boolean>;
  inspectionNotes?: string;
  globalZone?: string;
  file: FileState;
  mapping: Record<string, string | null>;
  step: WizardStep;
  savedAt: string;
}

export function NewReportWizard({ availableInstruments = [] }: { availableInstruments?: InstrumentItem[] }) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [objectName, setObjectName] = useState("");
  const [objectAddress, setObjectAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const [weather, setWeather] = useState("Sucho, temp. 20°C");
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [inspection, setInspection] = useState<Record<string, boolean>>({
    noVisibleDamage: true,
    circuitLabelsOk: true,
    peNmarkingsOk: true,
    protectionMatchesWiring: true,
    bondingVisualOk: true,
    schematicsPresent: true,
  });
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [globalZone, setGlobalZone] = useState("STANDARD");
  const [file, setFile] = useState<FileState | null>(null);
  
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [details, setDetails] = useState<Record<string, MappingDetail>>({});
  const [headerless, setHeaderless] = useState(false);
  
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string; number?: string; id?: string; loginNeeded?: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---------- Wersje robocze (auto-zapis / przywracanie) ---------- */
  const [dirty, setDirty] = useState(false);
  const [restoreOffer, setRestoreOffer] = useState<{
    payload: ImportDraftPayload;
    updatedAt: string;
    sourceFileName: string | null;
  } | null>(null);

  const stateRef = useRef({ objectName, objectAddress, clientName, weather, selectedInstruments, inspection, inspectionNotes, globalZone, file, mapping, step, dirty });
  stateRef.current = { objectName, objectAddress, clientName, weather, selectedInstruments, inspection, inspectionNotes, globalZone, file, mapping, step, dirty };

  const collectDraft = useCallback((): ImportDraftPayload | null => {
    const s = stateRef.current;
    if (!s.dirty || !s.file) return null;
    return {
      objectName: s.objectName,
      objectAddress: s.objectAddress,
      clientName: s.clientName,
      weather: s.weather,
      instruments: s.selectedInstruments,
      inspectionChecklist: s.inspection,
      inspectionNotes: s.inspectionNotes,
      globalZone: s.globalZone,
      file: { ...s.file, rows: s.file.rows.slice(0, 1500) },
      mapping: s.mapping,
      step: s.step === 1 ? 2 : s.step,
      savedAt: new Date().toISOString(),
    };
  }, []);

  const saveDraftNow = useCallback(async () => {
    const s = stateRef.current;
    const payload = collectDraft();
    if (!payload || !s.file) return;
    try {
      await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "IMPORT", sourceFileName: payload.file.name, payload }),
      });
    } catch {
      /* ignore */
    }
  }, [collectDraft]);

  useEffect(() => {
    const unregister = registerDraftProvider(() => {
      const payload = collectDraft();
      if (!payload) return null;
      return { kind: "IMPORT" as const, sourceFileName: payload.file.name, payload: payload as unknown as Record<string, unknown> };
    });
    return unregister;
  }, [collectDraft]);

  useEffect(() => {
    fetch("/api/drafts?kind=IMPORT")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const dr = d?.draft;
        if (dr?.payload?.file?.rows?.length) {
          setRestoreOffer({ payload: dr.payload as ImportDraftPayload, updatedAt: dr.updatedAt, sourceFileName: dr.sourceFileName });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      if (stateRef.current.dirty) void saveDraftNow();
    }, 45_000);
    return () => clearInterval(iv);
  }, [saveDraftNow]);

  const acceptDraft = () => {
    if (!restoreOffer) return;
    const p = restoreOffer.payload;
    setObjectName(p.objectName ?? "");
    setObjectAddress(p.objectAddress ?? "");
    setClientName(p.clientName ?? "");
    if (p.weather) setWeather(p.weather);
    if (p.instruments) setSelectedInstruments(p.instruments);
    if (p.inspectionChecklist) setInspection(p.inspectionChecklist);
    if (p.inspectionNotes) setInspectionNotes(p.inspectionNotes);
    if (p.globalZone) setGlobalZone(p.globalZone);
    setFile(p.file);
    setMapping(p.mapping ?? guessColumnMapping(p.file.headers));
    setStep(p.step === 3 ? 3 : 2);
    setDirty(true);
    setRestoreOffer(null);
    signalActivity();
  };

  const discardDraft = async () => {
    setRestoreOffer(null);
    try {
      await fetch("/api/drafts?kind=IMPORT", { method: "DELETE" });
    } catch { /* ignore */ }
  };

  /* ---------------- Parsowanie ---------------- */

  const handleFile = useCallback(async (f: File) => {
    setParseError(null);
    setSaveResult(null);
    setBusy(true);
    beginBackgroundOperation();
    const MAX_MB = 10;
    if (f.size > MAX_MB * 1024 * 1024) {
      setParseError(`Plik przekracza limit ${MAX_MB} MB.`);
      setBusy(false);
      endBackgroundOperation();
      return;
    }
    const ext = f.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "csv" || ext === "txt") {
        const Papa = (await import("papaparse")).default;
        const text = await f.text();
        const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
        if (!res.data.length || !res.meta.fields?.length) throw new Error("empty");
        if (ext === "txt") {
          setParseError("Format TXT: import roboczy jako CSV. Pełna obsługa TXT — roadmapa.");
        }
        
        let headers = res.meta.fields ?? Object.keys(res.data[0]);
        let rows = res.data;
        let noHeaderRow = false;

        if (looksHeaderless(headers)) {
          const raw = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
          const matrix = raw.data.filter((r) => Array.isArray(r) && r.length > 1);
          if (matrix.length) {
            headers = matrix[0].map((_, i) => `Kolumna ${i + 1}`);
            rows = matrix.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
            noHeaderRow = true;
          }
        }

        const auto = autoMapColumns(headers, rows);
        setFile({ name: f.name, sizeKb: Math.round(f.size / 1024), format: "CSV", rows, headers });
        setMapping(auto.mapping);
        setDetails(auto.details);
        setHeaderless(noHeaderRow);
        setStep(2);
        setDirty(true);
      } else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
        if (!rows.length) throw new Error("empty");
        
        const headers = Object.keys(rows[0]);
        const auto = autoMapColumns(headers, rows);
        setFile({ name: f.name, sizeKb: Math.round(f.size / 1024), format: "XLSX", rows, headers });
        setMapping(auto.mapping);
        setDetails(auto.details);
        setHeaderless(headers.every((h) => /^__EMPTY/.test(h)));
        setStep(2);
        setDirty(true);
      } else {
        setParseError("Format nieobsługiwany w tym etapie. Dostępne: CSV, XLSX.");
      }
    } catch {
      setParseError("Nie udało się odczytać pliku. Sprawdź, czy to poprawny arkusz z nagłówkami kolumn.");
    } finally {
      setBusy(false);
      endBackgroundOperation();
    }
  }, []);

  /* ---------------- Walidacja + analiza ---------------- */

  const prepared = useMemo(() => {
    if (!file) return null;
    const { points, errors } = rowsToPoints(file.rows, mapping);
    const analysis = points.length ? analyzePoints(points) : null;
    const missingCriticalCols = IMPORT_COLUMNS.filter((c) => c.required && !mapping[c.key]).map((c) => c.label);
    return { points, errors, analysis, missingCriticalCols };
  }, [file, mapping]);

  const canProceed = Boolean(
    prepared && prepared.points.length > 0 && prepared.missingCriticalCols.length === 0
  );

  /* ---------------- Zapis / podgląd ---------------- */

  const save = async () => {
    if (!prepared || !file) return;
    setBusy(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Oznaczamy wszystkie punkty domyślną strefą z ustawień
          points: prepared.points.map(p => ({ ...p, zoneType: globalZone })),
          sourceFileName: file.name,
          objectName: objectName || undefined,
          objectAddress: objectAddress || undefined,
          clientName: clientName || undefined,
          weather: weather || undefined,
          instruments: selectedInstruments,
          inspectionChecklist: { ...inspection, notes: inspectionNotes },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveResult({ ok: true, message: `Raport ${data.report.number} zapisany jako szkic.`, number: data.report.number, id: data.report.id });
        setDirty(false);
        void fetch("/api/drafts?kind=IMPORT", { method: "DELETE" }).catch(() => {});
      } else if (res.status === 401) {
        setSaveResult({ ok: false, loginNeeded: true, message: "Zapis raportu wymaga zalogowania. Możesz też otworzyć podgląd bez zapisywania." });
      } else {
        setSaveResult({ ok: false, message: data.error ?? "Nie udało się zapisać raportu." });
      }
    } catch {
      setSaveResult({ ok: false, message: "Błąd połączenia z serwerem." });
    } finally {
      setBusy(false);
    }
  };

  const preview = () => {
    if (!prepared) return;
    sessionStorage.setItem(
      "dl.imported",
      JSON.stringify({
        points: prepared.points,
        meta: {
          object: objectName || undefined,
          source: { fileName: file?.name, importedAt: new Date().toISOString() },
        } as never,
      })
    );
    router.push("/demo?zrodlo=import");
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <p className="kicker">Nowy raport</p>
        <h1 className="display-1 text-[clamp(24px,3vw,32px)] mt-2">Import wyników pomiarów</h1>
        <p className="text-[13.5px] text-dim mt-1">Prześlij plik, zweryfikuj mapowanie i zatwierdź import. Automatyczna ocena uruchomi się dopiero przy kompletnych danych krytycznych.</p>
      </div>

      <ol className="flex flex-wrap gap-2" aria-label="Etapy importu">
        {["Plik", "Mapowanie kolumn", "Walidacja i zatwierdzenie"].map((label, i) => (
          <li key={label} className={`chip ${step === i + 1 ? "!border-brand-mid !text-brand-mid" : step > i + 1 ? "!border-ok/50 !text-ok" : ""}`}>
            <span className="num-mono">{i + 1}</span> {label}
          </li>
        ))}
      </ol>

      {restoreOffer && (
        <div className="hairline !border-info/50 bg-info/8 rounded-2xl p-5 flex flex-wrap items-center gap-4">
          <Save size={18} className="text-info shrink-0" aria-hidden />
          <div className="flex-1 min-w-[200px]">
            <p className="text-[14px] text-mist font-semibold">Znaleziono wersję roboczą tego importu</p>
            <p className="text-[12.5px] text-dim mt-0.5">
              {restoreOffer.sourceFileName ?? restoreOffer.payload.file.name} · {restoreOffer.payload.file.rows.length} rekordów · zapisana {new Date(restoreOffer.updatedAt).toLocaleString("pl-PL")}
            </p>
          </div>
          <div className="flex gap-2.5">
            <button type="button" onClick={acceptDraft} className="btn btn-primary btn-sm">Wczytaj wersję roboczą</button>
            <button type="button" onClick={discardDraft} className="btn btn-ghost btn-sm">Odrzuć</button>
          </div>
        </div>
      )}

      {/* KROK 1 — parametry raportu i plik */}
      {step === 1 && (
        <section className="space-y-6">
          <div className="card p-6 md:p-8 space-y-6">
            <h2 className="font-display font-semibold text-[15px]">Podstawowe dane</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="field">
                <label htmlFor="objectName">Nazwa obiektu</label>
                <input id="objectName" className="input" placeholder="np. Hala produkcyjna, Gliwice" value={objectName} onChange={(e) => { setObjectName(e.target.value); signalActivity(); }} />
              </div>
              <div className="field">
                <label htmlFor="objectAddress">Adres obiektu</label>
                <input id="objectAddress" className="input" placeholder="ulica, miejscowość" value={objectAddress} onChange={(e) => setObjectAddress(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="clientName">Klient / zleceniodawca</label>
                <input id="clientName" className="input" placeholder="np. Meblex Sp. z o.o." value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
            </div>
            <p className="text-[11.5px] text-faint -mt-2">Obiekt i klient utworzą się automatycznie; kolejne raporty tego obiektu zasilą historię i Smart Compare+.</p>
            
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-line">
              <div className="field">
                <label>Domyślna klasyfikacja pomieszczeń</label>
                <select className="input" value={globalZone} onChange={(e) => setGlobalZone(e.target.value)}>
                  <option value="STANDARD">Standardowe (biura, suche hale, domy)</option>
                  <option value="LAZIENKA">Łazienki i natryski (RCD obligatoryjne)</option>
                  <option value="BASEN">Baseny i sauny</option>
                  <option value="MOKRE">Pomieszczenia o podwyższonej wilgotności</option>
                  <option value="MEDYCZNE">Pomieszczenia medyczne</option>
                  <option value="BUDOWA">Place budowy</option>
                  <option value="ROLNICTWO">Obiekty rolnicze i ogrodnicze</option>
                  <option value="EX">Strefy zagrożone wybuchem (EX)</option>
                  <option value="ZEWNETRZNE">Instalacje zewnętrzne</option>
                </select>
              </div>
              <div className="field">
                <label>Warunki środowiskowe</label>
                <input className="input" value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="np. Sucho, temp. 20°C" />
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card p-6 space-y-4">
              <h2 className="font-display font-semibold text-[15px]">Oględziny (PN-HD 60364-6)</h2>
              <p className="text-[12px] text-dim">Przed pomiarami należy potwierdzić pozytywny wynik oględzin wizualnych.</p>
              <div className="space-y-3 mt-4">
                <label className="flex items-start gap-3 text-[13px] text-mist cursor-pointer">
                  <input type="checkbox" checked={inspection.noVisibleDamage} onChange={(e) => setInspection({ ...inspection, noVisibleDamage: e.target.checked })} className="mt-1" />
                  Brak widocznych uszkodzeń mechanicznych
                </label>
                <label className="flex items-start gap-3 text-[13px] text-mist cursor-pointer">
                  <input type="checkbox" checked={inspection.circuitLabelsOk} onChange={(e) => setInspection({ ...inspection, circuitLabelsOk: e.target.checked })} className="mt-1" />
                  Czytelne oznaczenia obwodów
                </label>
                <label className="flex items-start gap-3 text-[13px] text-mist cursor-pointer">
                  <input type="checkbox" checked={inspection.peNmarkingsOk} onChange={(e) => setInspection({ ...inspection, peNmarkingsOk: e.target.checked })} className="mt-1" />
                  Oznakowanie zacisków i przewodów PE / N
                </label>
                <label className="flex items-start gap-3 text-[13px] text-mist cursor-pointer">
                  <input type="checkbox" checked={inspection.protectionMatchesWiring} onChange={(e) => setInspection({ ...inspection, protectionMatchesWiring: e.target.checked })} className="mt-1" />
                  Poprawny dobór aparatury do przekrojów
                </label>
                <label className="flex items-start gap-3 text-[13px] text-mist cursor-pointer">
                  <input type="checkbox" checked={inspection.bondingVisualOk} onChange={(e) => setInspection({ ...inspection, bondingVisualOk: e.target.checked })} className="mt-1" />
                  Ciągłość połączeń wyrównawczych
                </label>
                <label className="flex items-start gap-3 text-[13px] text-mist cursor-pointer">
                  <input type="checkbox" checked={inspection.schematicsPresent} onChange={(e) => setInspection({ ...inspection, schematicsPresent: e.target.checked })} className="mt-1" />
                  Dostępność schematów strukturalnych
                </label>
              </div>
              <div className="field mt-4">
                <label>Uwagi do oględzin</label>
                <input className="input text-[13px]" value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} placeholder="Opcjonalne uwagi..." />
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <h2 className="font-display font-semibold text-[15px]">Użyte przyrządy pomiarowe</h2>
              {availableInstruments.length === 0 ? (
                <p className="text-[12.5px] text-amp p-3 bg-amp/10 rounded-lg">
                  Nie masz zdefiniowanych żadnych mierników. Dodaj je w <Link href="/panel/profil" className="underline font-semibold">Profilu instalatora</Link>.
                </p>
              ) : (
                <div className="space-y-3 mt-4">
                  {availableInstruments.map((inst) => (
                    <label key={inst.id} className="flex items-start gap-3 text-[13px] text-mist cursor-pointer p-3 border border-line rounded-lg hover:border-brand-mid transition-colors">
                      <input type="checkbox" checked={selectedInstruments.includes(inst.id)} onChange={(e) => {
                        if (e.target.checked) setSelectedInstruments([...selectedInstruments, inst.id]);
                        else setSelectedInstruments(selectedInstruments.filter(id => id !== inst.id));
                      }} className="mt-1" />
                      <div>
                        <span className="font-semibold">{inst.name}</span> <span className="text-dim text-[11px]">(SN: {inst.serialNo})</span>
                        <div className="text-[11px] text-faint mt-1">Wzorcowanie: {inst.calibrationValidUntil}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card p-6 md:p-8 space-y-6">
            <h2 className="font-display font-semibold text-[15px]">Wybierz plik z wynikami</h2>
            <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }} className={`rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors cursor-pointer ${ dragOver ? "border-brand-mid bg-brand-light" : "border-line2 bg-abyss/60 hover:border-brand-mid" }`}>
              <span className="mx-auto grid place-items-center w-14 h-14 rounded-2xl border border-brand-mid/40 bg-brand-light text-brand-mid">
                <CloudUpload size={22} aria-hidden />
              </span>
              <p className="font-display font-semibold text-[16px] mt-5">{busy ? "Przetwarzanie pliku…" : "Przeciągnij plik z wynikami"}</p>
              <p className="text-[12.5px] text-faint mt-1.5">lub kliknij, aby <span className="text-brand-mid underline underline-offset-4">wybrać plik</span> z dysku</p>
            </div>
            <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          </div>
        </section>
      )}

      {/* KROK 2 — mapowanie */}
      {step === 2 && file && prepared && (
        <section className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-wrap items-center gap-3">
              <FileSpreadsheet size={18} className="text-brand-mid" aria-hidden />
              <div>
                <p className="text-[14px] text-mist font-semibold">{file.name}</p>
                <p className="text-[12px] text-faint font-mono">{file.format} · {file.sizeKb} KB · {file.rows.length} rekordów · rozpoznano kolumn: {Object.values(mapping).filter(Boolean).length}/{IMPORT_COLUMNS.length}</p>
              </div>
              <button type="button" onClick={() => { setStep(1); setFile(null); }} className="btn btn-ghost btn-sm ml-auto">
                <ArrowLeft size={14} aria-hidden /> Inny plik
              </button>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-display font-semibold text-[15px]">Mapowanie kolumn i jednostek</h2>
            <p className="text-[12.5px] text-faint mt-1">
              System rozpoznaje kolumny najpierw po ich opisie, a gdy opisu brak — po charakterze wartości.
              Każde przypisanie możesz nadpisać. Pola oznaczone * są wymagane do uruchomienia oceny.
            </p>
            {headerless && (
              <p className="mt-3 text-[12.5px] text-info hairline !border-info/40 rounded-lg px-4 py-2.5 bg-info/8 flex items-center gap-2">
                <Info size={14} aria-hidden /> Plik nie zawiera wiersza nagłówkowego — kolumny rozpoznano wyłącznie na podstawie wartości.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-faint font-mono">
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ok" aria-hidden /> wg opisu kolumny</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amp" aria-hidden /> wg wartości — zweryfikuj</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-mid" aria-hidden /> wskaż ręcznie</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              {IMPORT_COLUMNS.map((col) => {
                const d = details[col.key];
                const src = mapping[col.key] ? d?.source ?? "manual" : "none";
                const dot = src === "header" ? "bg-ok" : src === "values" ? "bg-amp" : src === "manual" ? "bg-brand-mid" : "bg-line2";
                const srcLabel = src === "header" ? "wg opisu" : src === "values" ? `wg wartości · ${Math.round((d?.confidence ?? 0) * 100)}%` : src === "manual" ? "ręcznie" : "brak";
                return (
                <div key={col.key} className="field">
                  <label htmlFor={`map-${col.key}`} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} aria-hidden />
                    {col.label} {col.required && <span className="text-crit">*</span>}
                    <span className="ml-auto normal-case tracking-normal text-[10px] text-faint">{srcLabel}</span>
                  </label>
                  <select
                    id={`map-${col.key}`}
                    className="input !py-2.5 text-[13px]"
                    value={mapping[col.key] ?? ""}
                    onChange={(e) => {
                      setMapping((m) => ({ ...m, [col.key]: e.target.value || null }));
                      setDetails((prev) => ({
                        ...prev,
                        [col.key]: { source: "manual", confidence: 1, reason: "Przypisane ręcznie przez użytkownika." },
                      }));
                      signalActivity();
                    }}
                  >
                    <option value="">— nieprzypisana —</option>
                    {file.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {src === "values" && d?.reason && (
                    <p className="text-[10.5px] text-amp leading-snug">{d.reason}</p>
                  )}
                </div>
                );
              })}
            </div>
            <p className="text-[11.5px] text-faint mt-4 font-mono">Jednostki są normalizowane automatycznie: „0,42 Ω” → 0,42; „1,2kΩ” → 1200; „254 ms” → 254.</p>
          </div>

          <div className="card p-6">
            <h2 className="font-display font-semibold text-[15px] flex items-center gap-2"><Table2 size={15} className="text-brand-mid" aria-hidden /> Podgląd danych</h2>
            <div className="overflow-x-auto mt-4 hairline rounded-xl">
              <table className="rpt-table min-w-[720px]">
                <thead>
                  <tr>{file.headers.map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {file.rows.slice(0, 6).map((row, i) => (
                    <tr key={i}>{file.headers.map((h) => <td key={h} className="num-mono text-[12.5px]">{String(row[h] ?? "—")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-faint mt-3">Pokazano 6 z {file.rows.length} rekordów.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep(3)} disabled={!canProceed} className="btn btn-primary disabled:opacity-35 disabled:pointer-events-none">
              Przejdź do walidacji <ArrowRight size={15} aria-hidden />
            </button>
            {!canProceed && prepared.missingCriticalCols.length > 0 && (
              <p className="flex items-center gap-2 text-[12.5px] text-amp">
                <Info size={14} aria-hidden /> Brakuje wymaganych kolumn: {prepared.missingCriticalCols.join(", ")}
              </p>
            )}
          </div>
        </section>
      )}

      {/* KROK 3 — walidacja i zatwierdzenie */}
      {step === 3 && file && prepared?.analysis && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ["Punkty", prepared.analysis.summary.total, "#1a5fb4"],
              ["OK", prepared.analysis.summary.ok, "#1e8e4f"],
              ["Ostrzeżenia", prepared.analysis.summary.warning, "#e67700"],
              ["Krytyczne", prepared.analysis.summary.critical, "#c62828"],
              ["Braki", prepared.analysis.summary.missing, "#8494a7"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rpt-kpi">
                <div className="num" style={{ color: c as string }}>{v as number}</div>
                <div className="lbl font-mono text-[9.5px] tracking-[0.16em] uppercase text-dim mt-2">{l as string}</div>
              </div>
            ))}
          </div>

          {prepared.errors.length > 0 && (
            <div className="hairline rounded-xl p-5 bg-amp/5 border-amp/30">
              <p className="font-display font-semibold text-[14px] text-amp flex items-center gap-2"><TriangleAlert size={15} aria-hidden /> Wykryte problemy w danych</p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-dim">
                {prepared.errors.slice(0, 8).map((e) => <li key={e}>· {e}</li>)}
              </ul>
            </div>
          )}

          <div className="card p-6">
            <h2 className="font-display font-semibold text-[15px]">Rozpoznane rodzaje pomiarów</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {prepared.points.some((p) => p.zsOhm != null) && <span className="chip st-ok !rounded-full">Impedancja pętli zwarcia</span>}
              {prepared.points.some((p) => p.risoMOhm != null) && <span className="chip st-ok !rounded-full">Rezystancja izolacji</span>}
              {prepared.points.some((p) => p.continuityOhm != null) && <span className="chip st-ok !rounded-full">Ciągłość PE</span>}
              {prepared.points.some((p) => p.rcdTripMs != null || p.rcdTripmA != null) && <span className="chip st-ok !rounded-full">Badanie RCD</span>}
              {prepared.points.every((p) => p.zsOhm == null) && <span className="chip st-crit !rounded-full">Brak Zs — ocena zablokowana</span>}
            </div>
          </div>

          {saveResult && (
            <div className={`hairline rounded-xl p-5 ${saveResult.ok ? "border-ok/40 bg-ok/5" : "border-amp/40 bg-amp/5"}`}>
              <p className={`text-[14px] flex items-center gap-2 ${saveResult.ok ? "text-ok" : "text-amp"}`}>
                {saveResult.ok ? <CircleCheck size={16} aria-hidden /> : <TriangleAlert size={16} aria-hidden />}
                {saveResult.message}
              </p>
              {saveResult.ok && saveResult.id && (
                <div className="flex flex-wrap gap-3 mt-4">
                  <Link href={`/panel/raporty/${saveResult.id}`} className="btn btn-primary btn-sm">
                    Otwórz raport — analiza, ostrzeżenia, zatwierdzenie <ArrowRight size={14} aria-hidden />
                  </Link>
                  <Link href="/panel/raporty" className="btn btn-ghost btn-sm">Lista raportów</Link>
                </div>
              )}
              {saveResult.loginNeeded && (
                <div className="flex flex-wrap gap-3 mt-4">
                  <Link href="/logowanie" className="btn btn-ghost btn-sm">Zaloguj się</Link>
                  <Link href="/rejestracja" className="btn btn-ghost btn-sm">Załóż konto (raport gratis)</Link>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep(2)} className="btn btn-ghost">
              <ArrowLeft size={15} aria-hidden /> Wróć do mapowania
            </button>
            <button type="button" onClick={save} disabled={busy || saveResult?.ok === true} className="btn btn-primary disabled:opacity-35 disabled:pointer-events-none">
              <CloudUpload size={15} aria-hidden /> {busy ? "Zapisywanie…" : "Zatwierdź import i zapisz raport"}
            </button>
            <button type="button" onClick={preview} className="btn btn-ghost">
              <Eye size={15} aria-hidden /> Podgląd raportu (bez zapisywania)
            </button>
          </div>
          <p className="text-[12px] text-faint">Zapis tworzy szkic raportu z otagowaniem źródła (SHA-256). Ocenę końcową zatwierdzisz w raporcie. Podgląd działa lokalnie w przeglądarce.</p>
        </section>
      )}
    </div>
  );
}
