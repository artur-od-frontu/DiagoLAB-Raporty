"use client";

/**
 * TRYB TERENOWY — NOTATNIK POMIAROWY OFFLINE
 * ==========================================
 * Tryb single-user: dane trzymane są w przeglądarce (localStorage, format JSON)
 * i opcjonalnie jako przenośny plik JSON — to celowy wariant "bazy na plikach",
 * bezpieczny, bo jedno-użytkowy. Chmura odbiera dane dopiero na żądanie
 * ("Wyślij do chmury"), gdzie działają już transakcje i limity Postgres.
 *
 * Analiza działa w 100% lokalnie — Moduł A jest izomorficzny.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus, Trash2, Download, Upload, CloudUpload, CircleCheck, TriangleAlert,
  WifiOff, Pencil, X, Signal, FileJson,
} from "lucide-react";
import {
  analyzePoints, evaluatePoint, parseLocalizedNumber, pointsToCsv,
  type RawPoint, type BreakerCurve, type PointEval,
} from "@/lib/engine";

const LS_KEY = "dl.field.workbook.v1";
const STATUS_STYLE: Record<string, string> = { OK: "st-ok", WARNING: "st-warn", CRITICAL: "st-crit", MISSING: "st-miss" };
const STATUS_LABEL: Record<string, string> = { OK: "OK", WARNING: "OSTRZ.", CRITICAL: "KRYT.", MISSING: "BRAK" };

interface WorkbookMeta { object: string; address: string; client: string; }
interface Workbook { points: RawPoint[]; meta: WorkbookMeta; updatedAt: string; }

const EMPTY_FORM = {
  code: "", location: "", circuit: "",
  curve: "B" as BreakerCurve, inA: "16", rcdmA: "30",
  zs: "", riso: "", continuity: "", rcdTime: "", rcdCurrent: "",
};

function loadWorkbook(): Workbook {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Workbook;
      if (Array.isArray(parsed.points)) {
        const meta = { object: parsed.meta?.object ?? "", address: parsed.meta?.address ?? "", client: parsed.meta?.client ?? "" };
        return { meta, points: parsed.points, updatedAt: parsed.updatedAt ?? "" };
      }
    }
  } catch { /* zły zapis — start pusty */ }
  return { points: [], meta: { object: "", address: "", client: "" }, updatedAt: "" };
}

export function FieldWorkbook() {
  const [points, setPoints] = useState<RawPoint[]>([]);
  const [meta, setMeta] = useState<WorkbookMeta>({ object: "", address: "", client: "" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const [cloudMsg, setCloudMsg] = useState<{ ok: boolean; text: string; id?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  /* Start: odczyt notatnika + rejestracja Service Workera (offline shell) */
  useEffect(() => {
    const wb = loadWorkbook();
    setPoints(wb.points);
    setMeta(wb.meta);
    setLoaded(true);
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /* Zapis SYNCHRONICZNY przy mutacjach listy — ochrona przed utratą
     ostatniego punktu przy natychmiastowym zamknięciu/reload karty. */
  const persistNow = useCallback((pts: RawPoint[], m: WorkbookMeta) => {
    try {
      const wb: Workbook = { points: pts, meta: m, updatedAt: new Date().toISOString() };
      localStorage.setItem(LS_KEY, JSON.stringify(wb));
    } catch { /* pamięć pełna — użytkownik dostanie eksport JSON */ }
  }, []);

  /* Auto-zapis debounce — tylko dla płynnego edytowania pól meta */
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => persistNow(points, meta), 400);
    return () => clearTimeout(t);
  }, [points, meta, loaded, persistNow]);

  /* Formularz → punkt (ta sama normalizacja co import plików) */
  const draftToPoint = useCallback((): RawPoint | null => {
    if (!form.code.trim() || !form.location.trim()) return null;
    return {
      code: form.code.trim(),
      location: form.location.trim(),
      circuit: form.circuit.trim() || "—",
      protection: {
        curve: form.curve,
        inA: parseLocalizedNumber(form.inA) ?? 16,
        rcdmA: parseLocalizedNumber(form.rcdmA),
      },
      zsOhm: parseLocalizedNumber(form.zs),
      risoMOhm: parseLocalizedNumber(form.riso),
      continuityOhm: parseLocalizedNumber(form.continuity),
      rcdTripMs: parseLocalizedNumber(form.rcdTime),
      rcdTripmA: parseLocalizedNumber(form.rcdCurrent),
    };
  }, [form]);

  const draftEval: PointEval | null = useMemo(() => {
    const p = draftToPoint();
    return p ? evaluatePoint(p) : null;
  }, [draftToPoint]);

  const commitPoint = () => {
    const p = draftToPoint();
    if (!p) return;
    setPoints((pts) => {
      const next = editing !== null ? pts.map((old, j) => (j === editing ? p : old)) : [...pts, p];
      persistNow(next, meta);
      return next;
    });
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const analysis = useMemo(() => analyzePoints(points), [points]);

  /* Eksporty */
  const download = (name: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const exportJson = () => download(`teren-offline-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ meta, points, exportedAt: new Date().toISOString(), app: "DiagoLAB Raporty+ / tryb terenowy" }, null, 2), "application/json");
  const exportCsv = () => download(`pomiary-teren-${new Date().toISOString().slice(0, 10)}.csv`, pointsToCsv(points), "text/csv;charset=utf-8");

  const importJson = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text()) as Partial<Workbook> | RawPoint[];
      const incoming = Array.isArray(parsed) ? parsed : parsed.points;
      if (!Array.isArray(incoming)) throw new Error();
      const clean = incoming.filter((p): p is RawPoint => Boolean(p && typeof p.code === "string" && p.protection));
      if (!clean.length) throw new Error();
      const nextMeta = !Array.isArray(parsed) && parsed.meta ? { ...meta, ...parsed.meta } : meta;
      persistNow(clean, nextMeta);
      setPoints(clean);
      setMeta(nextMeta);
      setCloudMsg({ ok: true, text: `Wczytano ${clean.length} punktów z pliku JSON.` });
    } catch {
      setCloudMsg({ ok: false, text: "Nieprawidłowy plik JSON notatnika — oczekiwany format eksportu trybu terenowego." });
    }
  };

  /* Wysyłka do chmury */
  const sendToCloud = async () => {
    if (!points.length) return;
    setBusy(true);
    setCloudMsg(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points,
          sourceFileName: "teren-offline.json",
          objectName: meta.object || undefined,
          objectAddress: meta.address || undefined,
          clientName: meta.client || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCloudMsg({ ok: true, text: `Wysłano! Raport ${data.report.number} utworzony w chmurze.`, id: data.report.id });
      } else if (res.status === 401) {
        setCloudMsg({ ok: false, text: "Wysyłka wymaga zalogowania — dane są bezpieczne w przeglądarce, zaloguj się i ponów." });
      } else {
        setCloudMsg({ ok: false, text: data.error ?? "Chmura odrzuciła dane." });
      }
    } catch {
      setCloudMsg({ ok: false, text: "Brak połączenia. Pracujesz offline — dane czekają w notatniku." });
    } finally {
      setBusy(false);
    }
  };

  const numInput = (key: keyof typeof EMPTY_FORM, label: string, placeholder: string) => (
    <div className="field">
      <label>{label}</label>
      <input
        className="input num-mono !py-2.5 text-[13.5px]"
        inputMode="decimal"
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-6" data-ready={loaded ? "true" : undefined}>
      {/* Status łączności */}
      <div className={`hairline rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 ${online ? "border-ok/40 bg-ok/5" : "border-amp/40 bg-amp/5"}`}>
        {online ? <Signal size={15} className="text-ok" aria-hidden /> : <WifiOff size={15} className="text-amp" aria-hidden />}
        <p className="text-[12.5px] text-dim flex-1">
          {online
            ? "Jesteś online. Dane i tak zapisują się lokalnie (JSON) — chmura tylko na żądanie."
            : "Pracujesz OFFLINE. Notatnik nadal działa — analiza liczona lokalnie tym samym silnikiem co chmura."}
        </p>
        <span className="chip font-mono">{points.length} pkt. · autosave</span>
      </div>

      {/* Meta obiektu */}
      <section className="card p-5">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="field"><label htmlFor="f-obj">Obiekt</label><input id="f-obj" className="input" placeholder="np. Hala B4" value={meta.object} onChange={(e) => setMeta({ ...meta, object: e.target.value })} /></div>
          <div className="field"><label htmlFor="f-addr">Adres</label><input id="f-addr" className="input" value={meta.address} onChange={(e) => setMeta({ ...meta, address: e.target.value })} /></div>
          <div className="field"><label htmlFor="f-cli">Klient</label><input id="f-cli" className="input" value={meta.client} onChange={(e) => setMeta({ ...meta, client: e.target.value })} /></div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
        {/* Lista punktów */}
        <section className="card overflow-hidden">
          <div className="px-5 py-4 hairline-b flex items-center justify-between">
            <h2 className="font-display font-semibold text-[15px]">Punkty pomiarowe ({points.length})</h2>
            {points.length > 0 && (
              <button
                type="button"
                className="text-[12px] text-faint hover:text-crit transition-colors"
                onClick={() => { if (confirm("Wyczyścić cały notatnik? Zrób najpierw eksport JSON.")) { persistNow([], meta); setPoints([]); } }}
              >
                Wyczyść notatnik
              </button>
            )}
          </div>
          {points.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-faint">Brak punktów. Dodaj pierwszy pomiar obok — działa bez internetu.</p>
          ) : (
            <ul className="divide-y divide-line max-h-[520px] overflow-y-auto">
              {points.map((p, i) => {
                const ev = evaluatePoint(p);
                return (
                  <li key={`${p.code}-${i}`} className="px-5 py-3.5 flex items-center gap-3 hover:bg-panel2/50 transition-colors">
                    <span className="num-mono text-[12.5px] text-volt font-semibold w-16 shrink-0">{p.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-mist truncate">{p.location}</span>
                      <span className="block text-[11px] text-faint truncate">
                        {p.protection.curve}{p.protection.inA}{p.protection.rcdmA ? ` · RCD ${p.protection.rcdmA}mA` : ""} · Zs {p.zsOhm ?? "—"} Ω · Riso {p.risoMOhm ?? "—"} MΩ
                      </span>
                    </span>
                    <span className={`badge ${STATUS_STYLE[ev.overall]} !text-[9px]`}>{STATUS_LABEL[ev.overall]}</span>
                    <button type="button" className="p-1.5 text-faint hover:text-volt" aria-label={`Edytuj ${p.code}`} onClick={() => {
                      setEditing(i);
                      setForm({
                        code: p.code, location: p.location, circuit: p.circuit === "—" ? "" : p.circuit,
                        curve: p.protection.curve, inA: String(p.protection.inA),
                        rcdmA: p.protection.rcdmA != null ? String(p.protection.rcdmA) : "",
                        zs: p.zsOhm != null ? String(p.zsOhm).replace(".", ",") : "",
                        riso: p.risoMOhm != null ? String(p.risoMOhm).replace(".", ",") : "",
                        continuity: p.continuityOhm != null ? String(p.continuityOhm).replace(".", ",") : "",
                        rcdTime: p.rcdTripMs != null ? String(p.rcdTripMs) : "",
                        rcdCurrent: p.rcdTripmA != null ? String(p.rcdTripmA).replace(".", ",") : "",
                      });
                    }}><Pencil size={14} aria-hidden /></button>
                    <button type="button" className="p-1.5 text-faint hover:text-crit" aria-label={`Usuń ${p.code}`} onClick={() => setPoints((pts) => { const next = pts.filter((_, j) => j !== i); persistNow(next, meta); return next; })}><Trash2 size={14} aria-hidden /></button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Podsumowanie offline (Moduł A lokalnie) */}
          {points.length > 0 && (
            <div className="hairline-t px-5 py-4 grid grid-cols-5 gap-2 text-center">
              {[
                ["OK", analysis.summary.ok, "#49dd8a"],
                ["OSTRZ.", analysis.summary.warning, "#ffb224"],
                ["KRYT.", analysis.summary.critical, "#ff6473"],
                ["BRAKI", analysis.summary.missing, "#5c6d89"],
                ["RCD", analysis.summary.rcdProtected, "#45e0ff"],
              ].map(([l, v, c]) => (
                <div key={l as string}>
                  <p className="num-mono text-[18px] font-bold" style={{ color: c as string }}>{v as number}</p>
                  <p className="font-mono text-[8.5px] tracking-[0.14em] text-faint uppercase">{l as string}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Formularz punktu */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-[15px]">{editing !== null ? `Edycja punktu ${form.code}` : "Nowy punkt pomiarowy"}</h2>
            {editing !== null && (
              <button type="button" className="text-faint hover:text-mist" aria-label="Anuluj edycję" onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div className="field"><label>Punkt *</label><input className="input num-mono !py-2.5 text-[13.5px]" placeholder="LP-01" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div className="field"><label>Lokalizacja *</label><input className="input !py-2.5 text-[13.5px]" placeholder="np. Strefa A" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="field col-span-2"><label>Obwód</label><input className="input !py-2.5 text-[13.5px]" placeholder="np. Gniazda 230V" value={form.circuit} onChange={(e) => setForm({ ...form, circuit: e.target.value })} /></div>
            <div className="field"><label>Charakterystyka</label>
              <select className="input !py-2.5 text-[13.5px]" value={form.curve} onChange={(e) => setForm({ ...form, curve: e.target.value as BreakerCurve })}>
                <option value="B">B</option><option value="C">C</option><option value="D">D</option>
              </select>
            </div>
            <div className="field"><label>In [A]</label><input className="input num-mono !py-2.5 text-[13.5px]" value={form.inA} onChange={(e) => setForm({ ...form, inA: e.target.value })} /></div>
            <div className="field col-span-2"><label>RCD IΔn [mA] (puste = brak)</label>
              <select className="input !py-2.5 text-[13.5px]" value={form.rcdmA} onChange={(e) => setForm({ ...form, rcdmA: e.target.value })}>
                <option value="">— brak RCD —</option><option value="30">30</option><option value="100">100</option><option value="300">300</option>
              </select>
            </div>
            {numInput("zs", "Zs [Ω]", "np. 1,94")}
            {numInput("riso", "Riso [MΩ]", "np. 220")}
            {numInput("continuity", "Ciągłość PE [Ω]", "np. 0,34")}
            {numInput("rcdTime", "Czas RCD [ms]", "np. 24")}
            {numInput("rcdCurrent", "Prąd wyzw. RCD [mA]", "np. 19,8")}
          </div>

          {/* Podgląd na żywo oceny punktu (silnik lokalny) */}
          {draftEval && (
            <div className="hairline rounded-xl p-3.5 bg-abyss/60" data-testid="draft-verdict">
              <div className="flex items-center gap-2.5">
                <span className={`badge ${STATUS_STYLE[draftEval.overall]}`} data-testid="draft-status">{STATUS_LABEL[draftEval.overall]}</span>
                <span className="font-mono text-[11px] text-dim">limit Zs: ≤ {draftEval.zs.limit} Ω</span>
              </div>
              {draftEval.overall !== "OK" && (
                <p className="text-[11.5px] text-dim mt-2">
                  {draftEval.zs.status !== "OK" && draftEval.zs.status !== "MISSING" && "Zs poza strefą · "}
                  {draftEval.riso.status !== "OK" && draftEval.riso.status !== "MISSING" && "Riso poza strefą · "}
                  {draftEval.overall === "MISSING" && "uzupełnij wymagane pomiary (Zs, Riso)"}
                </p>
              )}
            </div>
          )}

          <button type="button" onClick={commitPoint} disabled={!draftToPoint()} className="btn btn-primary w-full disabled:opacity-35 disabled:pointer-events-none">
            <Plus size={16} aria-hidden /> {editing !== null ? "Zapisz zmiany" : "Dodaj punkt do notatnika"}
          </button>
        </section>
      </div>

      {/* Pasek akcji */}
      <section className="card p-5">
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={exportJson} disabled={!points.length} className="btn btn-ghost btn-sm disabled:opacity-35">
            <FileJson size={14} aria-hidden /> Eksport JSON (przenośna baza)
          </button>
          <button type="button" onClick={exportCsv} disabled={!points.length} className="btn btn-ghost btn-sm disabled:opacity-35">
            <Download size={14} aria-hidden /> Eksport CSV
          </button>
          <button type="button" onClick={() => importRef.current?.click()} className="btn btn-ghost btn-sm">
            <Upload size={14} aria-hidden /> Import JSON
          </button>
          <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ""; }} />
          <button type="button" onClick={sendToCloud} disabled={!points.length || busy || !online} className="btn btn-primary btn-sm ml-auto disabled:opacity-35">
            <CloudUpload size={14} aria-hidden /> {busy ? "Wysyłanie…" : online ? "Wyślij do chmury → raport" : "Offline — wyślij później"}
          </button>
        </div>
        {cloudMsg && (
          <p className={`mt-4 text-[13px] flex flex-wrap items-center gap-2 ${cloudMsg.ok ? "text-ok" : "text-amp"}`} role="status">
            {cloudMsg.ok ? <CircleCheck size={15} aria-hidden /> : <TriangleAlert size={15} aria-hidden />}
            {cloudMsg.text}
            {cloudMsg.id && <Link href={`/panel/raporty/${cloudMsg.id}`} className="underline underline-offset-4 text-volt">Otwórz raport w chmurze</Link>}
          </p>
        )}
        <p className="mt-4 text-[11.5px] text-faint font-mono">
          Model danych: JSON w localStorage + eksport plikowy (single-user). Po wysłaniu do chmury obowiązują limity konta i transakcyjny zapis w PostgreSQL.
        </p>
      </section>
    </div>
  );
}
