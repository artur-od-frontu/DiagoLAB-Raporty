/**
 * Szablon raportu PDF (A4) — DiagoLAB Raporty+ · v2
 * ==================================================
 * Profesjonalny dokument „protokołowy": świadoma paginacja (5 sekcji-stron),
 * czytelna typografia, wykresy wektorowe SVG z właściwą skalą.
 * Ten sam model danych co raport interaktywny; esc() na wszystkich danych
 * użytkownika (ochrona przed XSS). Zero JS, zero zewnętrznych zasobów.
 */

import type { ReportPayload, ReportPersistence } from "@/components/report-view";
import type { AnalysisResult, HistorySample, MeasureStatus, PointEval } from "@/lib/engine";

const C = {
  ok: "#157840", okBg: "#e9f7ef",
  warn: "#9a6200", warnBg: "#fdf3dd",
  crit: "#a61e22", critBg: "#fdebec",
  miss: "#5b6472", missBg: "#eef1f5",
  ink: "#101828", dim: "#475569", faint: "#8a94a6",
  line: "#d7dde7", soft: "#eef1f6", brand: "#0b3550", accent: "#0e7490",
};

const STATUS_PL: Record<MeasureStatus, string> = { OK: "OK", WARNING: "OSTRZEŻENIE", CRITICAL: "KRYTYCZNE", MISSING: "BRAK DANYCH" };
const SC: Record<MeasureStatus, string> = { OK: C.ok, WARNING: C.warn, CRITICAL: C.crit, MISSING: C.miss };
const SCBG: Record<MeasureStatus, string> = { OK: C.okBg, WARNING: C.warnBg, CRITICAL: C.critBg, MISSING: C.missBg };

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const fnum = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : String(n.toLocaleString("pl-PL", { maximumFractionDigits: 3 })).replace(".", ",");

/* ---------------- Narracja (Moduł B — tryb regułowy) ---------------- */

export function reportNarrative(a: AnalysisResult): string[] {
  const { summary, findings } = a;
  const crit = findings.filter((f) => f.category === "KRYTYCZNE");
  const warn = findings.filter((f) => f.category === "OSTRZEŻENIE");
  const p1 = `W ramach badania oceniono ${summary.total} punktów pomiarowych. Wyniki spełniające kryteria: ${summary.ok}; wyniki w strefie ostrzegawczej: ${summary.warning}; nieprawidłowości krytyczne: ${summary.critical}${summary.missing ? `; punkty z niekompletnymi danymi: ${summary.missing}` : ""}.`;
  const p2 = crit.length
    ? `Kluczowe ustalenie: ${crit.map((f) => `${f.parameter} w punkcie ${f.pointCode} (${f.result})`).join("; ")}. Wyniki te wymagają usunięcia przyczyny i powtórzenia pomiaru przed dalszą eksploatacją obwodu.`
    : "Nie stwierdzono wyników poza kryteriami bezpieczeństwa.";
  const p3 = warn.length
    ? `Strefa ostrzegawcza obejmuje: ${warn.map((f) => `${f.pointCode} (${f.parameter.toLowerCase()})`).join("; ")}. Proponowane działania opisano w sekcji zaleceń. Końcową ocenę, po weryfikacji danych, zatwierdza wykonawca badań.`
    : "Końcową ocenę, po weryfikacji danych, zatwierdza wykonawca badań.";
  return [p1, p2, p3];
}

/* ---------------- Wykresy SVG (wektorowe, deterministyczne) ---------------- */

const CH_FONT = `font-family="DejaVu Sans Mono, Consolas, monospace"`;

function chartZs(points: PointEval[]): string {
  const W = 686, H = 250, PL = 46, PB = 40, PT = 26;
  const maxV = (Math.max(...points.map((p) => p.zs.value ?? 0), ...points.map((p) => p.zs.limit ?? 0), 1) * 1.15);
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / maxV);
  const step = (W - PL - 14) / points.length;
  const bw = Math.min(34, step * 0.62);

  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const gv = (maxV / 4) * i;
    grid += `<line x1="${PL}" x2="${W - 8}" y1="${y(gv)}" y2="${y(gv)}" stroke="${C.soft}" stroke-width="1"/>
      <text x="${PL - 6}" y="${y(gv) + 3.5}" text-anchor="end" font-size="10" fill="${C.faint}">${gv.toFixed(1)}</text>`;
  }

  const bars = points.map((p, i) => {
    const x = PL + 7 + i * step + (step - bw) / 2;
    const v = p.zs.value ?? 0;
    const col = SC[p.zs.status];
    const lim = p.zs.limit ?? 0;
    return `
      <rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(2, H - PB - y(v))}" rx="2.5" fill="${col}" fill-opacity="0.92"/>
      <line x1="${x - 5}" x2="${x + bw + 5}" y1="${y(lim)}" y2="${y(lim)}" stroke="${C.crit}" stroke-width="2" stroke-dasharray="5 3.5"/>
      <text x="${x + bw / 2}" y="${H - PB + 16}" text-anchor="middle" font-size="9.5" fill="${C.dim}">${esc(p.point.code)}</text>
      <text x="${x + bw / 2}" y="${y(v) - 5}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="${C.ink}">${fnum(p.zs.value)}</text>`;
  }).join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${CH_FONT} role="img" aria-label="Wykres impedancji Zs">
    <text x="${PL}" y="13" font-size="10" fill="${C.faint}">Zs [Ω] · przerywana czerwona kreska = limit dla zabezpieczenia</text>
    ${grid}
    <line x1="${PL}" x2="${W - 8}" y1="${H - PB}" y2="${H - PB}" stroke="${C.line}" stroke-width="1.5"/>
    ${bars}</svg>`;
}

/** RCD jako % limitu 300 ms — czytelne nawet przy bardzo małych czasach. */
function chartRcd(points: PointEval[]): string {
  const rcd = points.filter((p) => p.rcdTime && p.rcdTime.value !== null);
  if (!rcd.length) return "";
  const W = 686, H = 210, PL = 46, PB = 40, PT = 26;
  const yMax = 130; // % limitu
  const y = (pct: number) => PT + (H - PT - PB) * (1 - pct / yMax);
  const step = (W - PL - 14) / rcd.length;
  const bw = Math.min(34, step * 0.62);

  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const gv = (yMax / 3) * i;
    grid += `<line x1="${PL}" x2="${W - 8}" y1="${y(gv)}" y2="${y(gv)}" stroke="${C.soft}" stroke-width="1" ${i === 0 ? `stroke="${C.soft}"` : ""}/>
      <text x="${PL - 6}" y="${y(gv) + 3.5}" text-anchor="end" font-size="10" fill="${C.faint}">${Math.round(gv)}%</text>`;
  }

  const bars = rcd.map((p, i) => {
    const x = PL + 7 + i * step + (step - bw) / 2;
    const v = p.rcdTime!.value ?? 0;
    const pct = (v / 300) * 100;
    const col = SC[p.rcdTime!.status];
    return `
      <rect x="${x}" y="${y(pct)}" width="${bw}" height="${Math.max(3, H - PB - y(pct))}" rx="2.5" fill="${col}" fill-opacity="0.92"/>
      <text x="${x + bw / 2}" y="${H - PB + 16}" text-anchor="middle" font-size="9.5" fill="${C.dim}">${esc(p.point.code)}</text>
      <text x="${x + bw / 2}" y="${y(pct) - 5}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="${C.ink}">${fnum(v)} ms</text>`;
  }).join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${CH_FONT}>
    <text x="${PL}" y="13" font-size="10" fill="${C.faint}">czas zadziałania jako % limitu 300 ms (1×IΔn)</text>
    ${grid}
    <line x1="${PL}" x2="${W - 8}" y1="${y(100)}" y2="${y(100)}" stroke="${C.crit}" stroke-width="2" stroke-dasharray="6 4"/>
    <text x="${W - 10}" y="${y(100) - 6}" text-anchor="end" font-size="10" font-weight="bold" fill="${C.crit}">limit = 100%</text>
    <line x1="${PL}" x2="${W - 8}" y1="${H - PB}" y2="${H - PB}" stroke="${C.line}" stroke-width="1.5"/>
    ${bars}</svg>`;
}

function chartHistory(history: HistorySample[]): string {
  const codes = Object.keys(history[history.length - 1]?.values ?? {});
  if (!codes.length) return "";
  const code = codes[0];
  const vals = history.map((h) => h.values[code] ?? null);
  const present = vals.filter((v): v is number => v !== null);
  if (present.length < 2) return "";

  const W = 686, H = 220, PL = 46, PB = 40, PT = 34;
  const minV = Math.min(...present) * 0.92;
  const maxV = Math.max(...present) * 1.1;
  const xAt = (i: number) => PL + ((W - PL - 24) / Math.max(1, vals.length - 1)) * i;
  const yAt = (v: number) => PT + (H - PT - PB) * (1 - (v - minV) / (maxV - minV || 1));

  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const gv = minV + ((maxV - minV) / 3) * i;
    grid += `<line x1="${PL}" x2="${W - 8}" y1="${yAt(gv)}" y2="${yAt(gv)}" stroke="${C.soft}" stroke-width="1"/>
      <text x="${PL - 6}" y="${yAt(gv) + 3.5}" text-anchor="end" font-size="10" fill="${C.faint}">${gv.toFixed(2)}</text>`;
  }

  const pts = vals.map((v, i) => (v === null ? null : `${xAt(i)},${yAt(v)}`)).filter(Boolean).join(" ");
  const dots = vals.map((v, i) =>
    v === null ? "" : `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="4.5" fill="${C.accent}" stroke="#fff" stroke-width="2"/>
      <text x="${xAt(i)}" y="${yAt(v) - 9}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="${C.ink}">${fnum(v)}</text>`
  ).join("");
  const labels = history.map((h, i) => `<text x="${xAt(i)}" y="${H - PB + 16}" text-anchor="middle" font-size="9.5" fill="${C.dim}">${h.date.slice(2, 10)}</text>`).join("");
  const change = ((present[present.length - 1] - present[0]) / present[0]) * 100;
  const tone = Math.abs(change) < 5 ? C.ok : change > 0 ? C.warn : C.ok;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${CH_FONT}>
    <text x="${PL}" y="14" font-size="10.5" font-weight="bold" fill="${tone}">${esc(code)} · Zs [Ω] · zmiana ${change > 0 ? "+" : ""}${change.toFixed(1)}% względem ${history[0].date.slice(0, 4)}</text>
    ${grid}
    <line x1="${PL}" x2="${W - 8}" y1="${H - PB}" y2="${H - PB}" stroke="${C.line}" stroke-width="1.5"/>
    <polyline points="${pts}" fill="none" stroke="${C.accent}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}${labels}</svg>`;
}

/* ---------------- Tabela wyników ---------------- */

function resultsTable(points: PointEval[]): string {
  const rows = points.map((ev, i) => {
    const p = ev.point;
    const rcd = ev.rcdTime
      ? `${fnum(ev.rcdTime.value)} ms${ev.rcdCurrent?.value != null ? ` · ${fnum(ev.rcdCurrent.value)} mA` : ""}`
      : "—";
    const prot = `${p.protection.curve}${p.protection.inA}${p.protection.rcdmA ? ` + RCD ${p.protection.rcdmA}mA` : ""}`;
    const zebra = i % 2 ? ` style="background:#f8fafc"` : "";
    const cell = (v: number | null | undefined, unit: string, st: MeasureStatus, limitTxt?: string) =>
      `<td class="num"><span style="color:${SC[st]};font-weight:600">${fnum(v)}</span>${limitTxt ? `<span class="dim"> ${limitTxt}</span>` : ""}${v == null ? "" : `<span class="dim"> ${unit}</span>`}</td>`;
    return `<tr${zebra}>
      <td class="num b">${esc(p.code)}</td>
      <td class="loc">${esc(p.location)}<div class="circ">${esc(p.circuit)}</div></td>
      <td class="num sm">${esc(prot)}</td>
      ${cell(ev.zs.value, "Ω", ev.zs.status, `/ ≤ ${fnum(ev.zs.limit)}`)}
      ${cell(ev.riso.value, "MΩ", ev.riso.status, "/ ≥ 1")}
      ${cell(ev.continuity.value, "Ω", ev.continuity.status, "/ ≤ 1")}
      <td class="num" style="color:${ev.rcdTime ? SC[ev.rcdTime.status] : C.faint}">${rcd}</td>
      <td><span class="badge" style="background:${SCBG[ev.overall]};color:${SC[ev.overall]}">${STATUS_PL[ev.overall]}</span></td>
    </tr>`;
  }).join("");
  return `<table class="t">
    <thead><tr>
      <th style="width:9%">Punkt</th><th style="width:26%">Lokalizacja / obwód</th><th style="width:15%">Zabezpieczenie</th>
      <th style="width:14%">Zs [Ω]</th><th style="width:11%">Riso [MΩ]</th><th style="width:12%">Ciągłość [Ω]</th>
      <th style="width:13%">RCD (1×IΔn)</th><th>Ocena</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

/* ---------------- Dokument ---------------- */

export function renderReportPdfHtml(opts: {
  payload: ReportPayload;
  persistence?: ReportPersistence;
  qrDataUrl: string | null;
  shareUrl?: string | null;
  sha256: string;
}): string {
  const { payload, persistence, qrDataUrl } = opts;
  const { meta, analysis } = payload;
  const s = analysis.summary;
  const approved = persistence?.initialApproval ?? null;
  const decisions = persistence?.initialDecisions ?? {};
  const narrative = reportNarrative(analysis);
  const datePl = new Date(meta.source.importedAt).toLocaleString("pl-PL");
  // Do dokumentu wpuszczamy wyłącznie obrazy w formie data URL o znanych typach
  const safeLogo =
    meta.logoDataUrl && /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(meta.logoDataUrl)
      ? meta.logoDataUrl
      : null;
  const approvedPl = approved ? new Date(approved.approvedAt).toLocaleString("pl-PL") : null;

  const findings = analysis.findings.map((f) => {
    const d = decisions[f.id];
    const cat = f.category;
    const col = cat === "KRYTYCZNE" ? C.crit : cat === "OSTRZEŻENIE" ? C.warn : cat === "ZALECENIE" ? C.accent : C.miss;
    const bg = cat === "KRYTYCZNE" ? C.critBg : cat === "OSTRZEŻENIE" ? C.warnBg : "#eaf6f9";
    return `<div class="finding" style="border-left-color:${col}">
      <div class="f-head">
        <span class="badge" style="background:${bg};color:${col}">${cat}</span>
        <b class="mono">${esc(f.pointCode)}</b> · <b>${esc(f.parameter)}</b>
        ${d ? `<span class="dec">decyzja wykonawcy: ${esc(d.decision)}${d.note ? ` — ${esc(d.note)}` : ""}</span>` : ""}
      </div>
      <div class="f-row"><span class="f-lbl">Wynik / kryterium</span><span class="mono">${esc(f.result)}</span></div>
      <div class="f-row"><span class="f-lbl">Podstawa</span><span class="dim">${esc(f.criterion)}</span></div>
      <div class="f-row"><span class="f-lbl">Możliwa przyczyna</span><span>${esc(f.cause)}</span></div>
      <div class="f-row"><span class="f-lbl">Proponowane działanie</span><span><b>${esc(f.action)}</b></span></div>
    </div>`;
  }).join("");

  const demoBanner = payload.isDemo
    ? `<div class="demo-banner">WERSJA DEMONSTRACYJNA — dane przykładowe, nie stanowią wyników rzeczywistych badań.</div>`
    : "";

  const assessBadge = approved
    ? `<span class="badge big" style="background:${approved.assessment === "POZYTYWNA" ? C.okBg : approved.assessment === "WARUNKOWA" ? C.warnBg : C.critBg};color:${approved.assessment === "POZYTYWNA" ? C.ok : approved.assessment === "WARUNKOWA" ? C.warn : C.crit}">${approved.assessment}</span>`
    : `<span class="badge big" style="background:${C.missBg};color:${C.miss}">OCZEKUJE NA ZATWIERDZENIE</span>`;

  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"><title>${esc(meta.reportNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Liberation Sans", "Helvetica Neue", Arial, sans-serif; color: ${C.ink}; font-size: 11px; line-height: 1.55; }
  .mono, .num { font-family: "DejaVu Sans Mono", Consolas, monospace; }
  .b { font-weight: 700; } .dim { color: ${C.dim}; }
  .kicker { font: 700 9px "DejaVu Sans Mono", monospace; letter-spacing: 2.4px; text-transform: uppercase; color: ${C.accent}; }
  h1 { font-size: 26px; letter-spacing: -0.3px; color: ${C.brand}; line-height: 1.15; }
  h2 { font-size: 14px; color: ${C.brand}; letter-spacing: 1.4px; text-transform: uppercase;
       border-bottom: 2px solid ${C.brand}; padding-bottom: 6px; margin: 0 0 14px; }
  h2 .no { color: ${C.accent}; }
  section.page { page-break-before: always; }
  .avoid { page-break-inside: avoid; }
  div, figure, table, p { orphans: 3; widows: 3; }
  thead { display: table-header-group; }

  .badge { display: inline-block; border-radius: 4px; padding: 2px 8px; font: 700 8.5px "DejaVu Sans Mono", monospace; letter-spacing: 0.9px; }
  .badge.big { font-size: 11px; padding: 5px 14px; border-radius: 6px; }

  .kpis { display: table; width: 100%; border-spacing: 8px 0; margin: 4px -8px 0; }
  .kpi { display: table-cell; border: 1px solid ${C.line}; border-top: 3px solid ${C.accent}; border-radius: 6px; padding: 10px 12px; background: #fbfcfe; }
  .kpi .n { font: 800 24px/1 "Liberation Sans", sans-serif; }
  .kpi .l { font: 700 7.5px "DejaVu Sans Mono", monospace; letter-spacing: 1px; text-transform: uppercase; color: ${C.faint}; margin-top: 5px; }

  .meta { width: 100%; border-collapse: collapse; }
  .meta td { padding: 7px 4px; border-bottom: 1px solid ${C.soft}; vertical-align: top; }
  .meta td:first-child { color: ${C.dim}; width: 34%; font-size: 10px; }
  .meta td:last-child { font-weight: 600; }

  table.t { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
  table.t th { text-align: left; font: 700 8px "DejaVu Sans Mono", monospace; text-transform: uppercase; letter-spacing: 0.7px;
    color: #fff; background: ${C.brand}; padding: 7px 7px; }
  table.t td { padding: 7px; border-bottom: 1px solid ${C.line}; vertical-align: middle; }
  td.num { white-space: nowrap; }
  td.num.sm { font-size: 9px; color: ${C.dim}; }
  td.loc { line-height: 1.35; }
  .circ { font-size: 9px; color: ${C.faint}; margin-top: 2px; }

  figcaption { font: 700 9px "DejaVu Sans Mono", monospace; letter-spacing: 1.2px; text-transform: uppercase; color: ${C.dim};
    border-left: 3px solid ${C.accent}; padding-left: 8px; margin: 0 0 8px; }
  figure { margin: 0 0 18px; }

  .finding { border: 1px solid ${C.line}; border-left: 4px solid; border-radius: 0 7px 7px 0; padding: 11px 14px; margin-bottom: 10px; background: #fcfcfd; }
  .f-head { font-size: 11px; margin-bottom: 7px; }
  .f-row { display: block; font-size: 10px; padding: 2.5px 0; }
  .f-lbl { display: inline-block; width: 30%; color: ${C.faint}; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; vertical-align: top; }
  .dec { font-size: 9.5px; color: ${C.dim}; font-style: italic; }

  .demo-banner { background: ${C.critBg}; color: ${C.crit}; border: 1.5px solid #f0b7b9; border-radius: 6px;
    padding: 9px 14px; font: 700 9.5px "DejaVu Sans Mono", monospace; letter-spacing: 0.6px; margin-top: 14px; }
  .disc { color: ${C.dim}; font-size: 9px; line-height: 1.6; }

  .cols { display: table; width: 100%; border-spacing: 0; }
  .cols > div { display: table-cell; vertical-align: top; }
  .cols .left { width: 58%; padding-right: 20px; }
  .box { border: 1px solid ${C.line}; border-radius: 8px; padding: 14px 16px; }
  .sig { border: 1.5px dashed ${C.line}; border-radius: 8px; height: 84px; display: table-cell; vertical-align: middle; text-align: center; }
  .qr-box { border: 1px solid ${C.line}; border-radius: 8px; padding: 10px; display: inline-block; text-align: center; background: #fff; }
  .hash { font: 10px "DejaVu Sans Mono", monospace; color: ${C.accent}; word-break: break-all; background: #f4f9fb;
    border: 1px solid #d9e9ee; border-radius: 6px; padding: 8px 10px; line-height: 1.7; }
</style></head><body>

<!-- ══════════════ STRONA 1 · TYTUŁOWA ══════════════ -->
<section class="cover">
  ${safeLogo ? `<div style="display:table;width:100%;margin-bottom:14px;">
    <div style="display:table-cell;vertical-align:middle;">
      <img src="${safeLogo}" alt="Logo wykonawcy" style="max-height:54px;max-width:210px;object-fit:contain;">
    </div>
    <div style="display:table-cell;vertical-align:middle;text-align:right;">
      <div style="font:700 9px 'DejaVu Sans Mono',monospace;letter-spacing:1.4px;color:${C.faint};text-transform:uppercase;">Wykonawca badań</div>
      <div style="font-weight:700;font-size:12px;color:${C.brand};">${esc(meta.installer.company !== "—" ? meta.installer.company : meta.contractor)}</div>
    </div>
  </div>` : ""}
  <div style="background:${C.brand};color:#fff;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font:800 20px 'DejaVu Sans Mono',monospace;letter-spacing:-0.5px;color:#ffffff;">Diago<span style="color:#ff6a1f">LAB</span> <span style="color:#5fd6ec;font-size:14px;">Raporty+</span></div>
      <div style="font-size:9px;opacity:0.85;margin-top:3px;">Inteligentna platforma raportowania pomiarów elektrycznych</div>
    </div>
    <div style="text-align:right;font-family:'DejaVu Sans Mono',monospace;">
      <div style="font-size:9px;opacity:0.85;">DATA WYDANIA</div>
      <div style="font-size:13px;font-weight:700;">${esc(meta.date)}</div>
    </div>
  </div>
  ${demoBanner}

  <div style="margin-top:44px;">
    <div class="kicker">Protokół · raport z pomiarów</div>
    <h1 style="margin-top:10px;">Pomiary ochronne instalacji elektrycznej</h1>
    <div class="mono" style="color:${C.accent};margin-top:10px;font-size:15px;font-weight:700;">${esc(meta.reportNumber)}</div>
  </div>

  <div class="cols" style="margin-top:34px;">
    <div class="left">
      <table class="meta">
        <tr><td>Obiekt</td><td>${esc(meta.object)}</td></tr>
        <tr><td>Adres</td><td>${esc(meta.objectAddress)}</td></tr>
        <tr><td>Zleceniodawca</td><td>${esc(meta.client)}</td></tr>
        <tr><td>Wykonawca</td><td>${esc(meta.contractor)}</td></tr>
        <tr><td>Przyrząd pomiarowy</td><td class="mono" style="font-size:10px;">${esc(meta.instrument)}</td></tr>
        <tr><td>Warunki badania</td><td style="font-size:10px;">${esc(meta.weather)}</td></tr>
      </table>
    </div>
    <div>
      <div class="box" style="padding:16px;">
        <div class="kicker" style="margin-bottom:8px;">Ocena końcowa</div>
        ${assessBadge}
        <div class="disc" style="margin-top:10px;">${approved ? `Zatwierdził: ${esc(meta.installer.name)} · ${approvedPl}` : "Zatwierdzenie wymaga weryfikacji danych przez wykonawcę."}</div>
      </div>
    </div>
  </div>

  <div class="kpis" style="margin-top:30px;">
    <div class="kpi"><div class="n" style="color:${C.brand}">${s.total}</div><div class="l">Punktów</div></div>
    <div class="kpi" style="border-top-color:${C.ok}"><div class="n" style="color:${C.ok}">${s.ok}</div><div class="l">OK</div></div>
    <div class="kpi" style="border-top-color:${C.warn}"><div class="n" style="color:${C.warn}">${s.warning}</div><div class="l">Ostrzeżenia</div></div>
    <div class="kpi" style="border-top-color:${C.crit}"><div class="n" style="color:${C.crit}">${s.critical}</div><div class="l">Krytyczne</div></div>
    <div class="kpi" style="border-top-color:${C.miss}"><div class="n" style="color:${C.miss}">${s.missing}</div><div class="l">Braki</div></div>
  </div>

  <p class="disc" style="margin-top:40px;">
    Dokument wygenerowany przez system DiagoLAB Raporty+ · silnik analityczny v${esc(analysis.algorithmVersion)} ·
    kryteria: ${esc(analysis.criteriaSet)}. Raport zawiera: wyniki, wykresy, analizę, ostrzeżenia i zalecenia, ocenę końcową,
    podpis wykonawcy oraz źródła danych z kontrolą integralności SHA-256.
  </p>
</section>

<!-- ══════════════ STRONA 2 · OGLĘDZINY ══════════════ -->
<section class="page">
  <h2><span class="no">1·</span> Protokół Oględzin</h2>
  ${meta.inspectionChecklist ? `
  <div class="box avoid" style="margin-bottom:14px;">
    <table class="t" style="width:100%; border:none;">
      <tbody>
        <tr><td style="${meta.inspectionChecklist.noVisibleDamage ? 'color:'+C.ok : 'color:'+C.crit}">${meta.inspectionChecklist.noVisibleDamage ? '✓' : '✗'}</td><td>Brak widocznych uszkodzeń mechanicznych</td></tr>
        <tr><td style="${meta.inspectionChecklist.circuitLabelsOk ? 'color:'+C.ok : 'color:'+C.crit}">${meta.inspectionChecklist.circuitLabelsOk ? '✓' : '✗'}</td><td>Obecność czytelnych oznaczeń obwodów w rozdzielnicach</td></tr>
        <tr><td style="${meta.inspectionChecklist.peNmarkingsOk ? 'color:'+C.ok : 'color:'+C.crit}">${meta.inspectionChecklist.peNmarkingsOk ? '✓' : '✗'}</td><td>Prawidłowe oznakowanie zacisków i przewodów PE / N</td></tr>
        <tr><td style="${meta.inspectionChecklist.protectionMatchesWiring ? 'color:'+C.ok : 'color:'+C.crit}">${meta.inspectionChecklist.protectionMatchesWiring ? '✓' : '✗'}</td><td>Prawidłowy dobór aparatury zabezpieczającej do przekrojów przewodów</td></tr>
        <tr><td style="${meta.inspectionChecklist.bondingVisualOk ? 'color:'+C.ok : 'color:'+C.crit}">${meta.inspectionChecklist.bondingVisualOk ? '✓' : '✗'}</td><td>Wizualne potwierdzenie obecności i ciągłości połączeń wyrównawczych</td></tr>
        <tr><td style="${meta.inspectionChecklist.schematicsPresent ? 'color:'+C.ok : 'color:'+C.crit}">${meta.inspectionChecklist.schematicsPresent ? '✓' : '✗'}</td><td>Dostępność schematów strukturalnych (jednokreskowych)</td></tr>
      </tbody>
    </table>
  </div>
  ${meta.inspectionChecklist.notes ? `<p class="disc"><b>Uwagi wykonawcy:</b> ${esc(meta.inspectionChecklist.notes)}</p>` : ''}
  ` : '<p class="disc">Oględziny nie zostały udokumentowane w systemie.</p>'}
</section>

<!-- ══════════════ STRONA 3 · WYNIKI ══════════════ -->
<section class="page">
  <h2><span class="no">2·</span> Wyniki pomiarów</h2>
  ${resultsTable(analysis.points)}
  <p class="disc" style="margin-top:10px;">Kryteria: impedancja pętli zwarcia Zs ≤ U0/Ia (samoczynne wyłączenie zasilania); rezystancja izolacji ≥ 1 MΩ przy 500 V DC; ciągłość przewodu ochronnego ≤ 1 Ω; czas zadziałania RCD ≤ 300 ms przy 1×IΔn; prąd wyzwalania RCD w zakresie 0,5–1×IΔn.</p>
</section>

<!-- ══════════════ STRONA 4 · WYKRESY + ANALIZA ══════════════ -->
<section class="page">
  <h2><span class="no">3·</span> Wykresy</h2>
  <figure class="avoid">
    <figcaption>Impedancja pętli zwarcia względem limitu zabezpieczenia</figcaption>
    ${chartZs(analysis.points)}
  </figure>
  <figure class="avoid">
    <figcaption>Czasy zadziałania zabezpieczeń RCD</figcaption>
    ${chartRcd(analysis.points) || '<p class="disc">Brak obwodów objętych ochroną różnicowoprądową.</p>'}
  </figure>

  <h2 style="margin-top:6px;"><span class="no">3·</span> Analiza i interpretacja</h2>
  ${narrative.map((p) => `<p style="margin-bottom:11px;font-size:11.5px;">${esc(p)}</p>`).join("")}
</section>

<!-- ══════════════ STRONA 5 · HISTORIA + USTALENIA ══════════════ -->
<section class="page">
  ${payload.history
    ? `<h2><span class="no">5·</span> Historia pomiarów — Smart Compare+</h2>
    <figure class="avoid">${chartHistory(payload.history)}</figure>
    <p class="disc" style="margin-top:-8px;margin-bottom:6px;">Porównanie kolejnych serii tego samego punktu pomiarowego. Wiarygodne tylko przy tych samych metodach i warunkach pomiaru; trend nie stanowi gwarancji przyszłego stanu instalacji.</p>`
    : `<h2><span class="no">4·</span> Historia pomiarów — Smart Compare+</h2>
    <p class="disc" style="margin-bottom:6px;">Historia powstaje automatycznie po zatwierdzeniu kolejnych raportów tego obiektu (Smart Compare+).</p>`}

  <h2 style="margin-top:22px;"><span class="no">5·</span> Ostrzeżenia i zalecenia</h2>
  ${findings || '<p class="dim">Brak ustaleń nieprawidłowych.</p>'}
</section>

<!-- ══════════════ STRONA 6 · OCENA + PODPIS + ŹRÓDŁA ══════════════ -->
<section class="page">
  <h2><span class="no">7·</span> Ocena końcowa</h2>
  <div class="box avoid" style="display:table;width:100%;">
    <div style="display:table-cell;vertical-align:middle;">
      ${assessBadge}
      ${approved ? `<div class="disc" style="margin-top:8px;">Zatwierdzono elektronicznie: ${approvedPl} · wykonawca potwierdził weryfikację danych pomiarowych.</div>` : `<div class="disc" style="margin-top:8px;">Ocenę wystawia i zatwierdza wyłącznie wykonawca badań po weryfikacji wszystkich danych.</div>`}
    </div>
  </div>
  <p class="disc" style="margin-top:10px;">Raport przygotowano z wykorzystaniem systemu DiagoLAB Raporty+. Wyniki pochodzą z danych przekazanych przez użytkownika. System może wspomagać analizę, ale nie zastępuje kwalifikacji i oceny osoby wykonującej badania. Końcową ocenę zatwierdza wykonawca.</p>

  <h2 style="margin-top:22px;"><span class="no">7·</span> Wykonawca i podpis</h2>
  <div class="cols avoid">
    <div class="left">
      <table class="meta">
        <tr><td>Wykonawca</td><td>${esc(meta.installer.name)}</td></tr>
        <tr><td>Firma</td><td>${esc(meta.installer.company)}</td></tr>
        <tr><td>Nr świadectwa kwalifikacyjnego</td><td class="mono" style="font-size:10px;">${esc(meta.installer.certificateNo)}</td></tr>
        <tr><td>Zakres kwalifikacji</td><td style="font-size:10px;">${esc(meta.installer.scope)}</td></tr>
      </table>
    </div>
    <div class="sig">
      <span style="font:italic 600 16px Georgia,'Times New Roman',serif;color:${C.brand};">${esc(meta.installer.name)}</span><br>
      <span class="disc" style="font-size:8px;">podpis odręczny · nie jest kwalifikowanym podpisem elektronicznym</span>
    </div>
  </div>

  <h2 style="margin-top:22px;"><span class="no">8·</span> Źródła danych i integralność</h2>
  <div class="cols avoid">
    <div class="left">
      <table class="meta">
        ${meta.instrumentsDetails?.length ? `<tr><td colspan="2" style="padding-top:14px;padding-bottom:2px;"><b>Przyrządy pomiarowe:</b></td></tr>` + meta.instrumentsDetails.map(i => `<tr><td>${esc(i.name)} <span class="dim sm">SN: ${esc(i.serialNo)}</span></td><td class="sm">Wzorcowanie: ${esc(i.calibrationNo)} do ${esc(i.calibrationValidUntil)}</td></tr>`).join("") : ""}
        <tr><td colspan="2" style="padding-top:14px;padding-bottom:2px;"><b>Integralność danych:</b></td></tr>
        <tr><td>Plik źródłowy</td><td class="mono" style="font-size:10px;">${esc(meta.source.fileName)}</td></tr>
        <tr><td>Data importu</td><td>${datePl}</td></tr>
        <tr><td>Liczba rekordów</td><td>${s.total}</td></tr>
        <tr><td>Wersja algorytmów</td><td>v${esc(analysis.algorithmVersion)}</td></tr>
        <tr><td>Zestaw kryteriów</td><td style="font-size:10px;">${esc(analysis.criteriaSet)}</td></tr>
      </table>
      <div style="margin-top:10px;"><span class="disc"><b>SHA-256 zbioru danych:</b></span>
        <div class="hash">${esc(opts.sha256)}</div>
      </div>
    </div>
    ${qrDataUrl ? `<div style="text-align:center;padding-top:6px;">
      <span class="qr-box"><img src="${qrDataUrl}" width="104" height="104" alt="QR do raportu interaktywnego"></span>
      <div class="disc" style="margin-top:6px;">raport interaktywny online</div>
    </div>` : ""}
  </div>

  <p class="disc" style="margin-top:20px;border-top:1.5px solid ${C.line};padding-top:9px;">
    Dokument zawiera numer raportu, datę i numerację stron. Tego dokumentu nie wolno modyfikować — integralność zbioru wejściowego
    weryfikowalna jest skrótem SHA-256.${opts.shareUrl ? ` Podgląd online: <span class="mono" style="font-size:8.5px;color:${C.accent}">${esc(opts.shareUrl)}</span>` : ""}
  </p>
</section>
</body></html>`;
}
