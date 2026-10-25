/**
 * Testy warstwy PDF i linków udostępniania.
 */

import { describe, it, expect } from "vitest";
import { computeShareToken, verifyShareToken, shareUrl } from "@/lib/share";
import { renderReportPdfHtml, reportNarrative, esc } from "@/lib/pdf-template";
import { analyzePoints } from "@/lib/engine";
import { DEMO_META, DEMO_POINTS, DEMO_HISTORY } from "@/lib/demo-data";
import type { ReportPayload } from "@/components/report-view";

const analysis = analyzePoints(DEMO_POINTS);
const payload: ReportPayload = {
  meta: { ...DEMO_META, contractor: 'Firma <script>alert("x")</script>' }, // celowa próba XSS
  points: DEMO_POINTS,
  analysis,
  history: DEMO_HISTORY,
  isDemo: true,
};

describe("share tokens", () => {
  it("token deterministyczny i pewny pod właściwym raportem", () => {
    const t = computeShareToken("rep-123");
    expect(t).toMatch(/^[0-9a-f]{32}$/);
    expect(computeShareToken("rep-123")).toBe(t);
    expect(verifyShareToken("rep-123", t)).toBe(true);
  });

  it("odmowa dla innego raportu / uszkodzonego tokenu / braku tokenu", () => {
    const t = computeShareToken("rep-123");
    expect(verifyShareToken("rep-456", t)).toBe(false);
    expect(verifyShareToken("rep-123", t.slice(0, -1) + "0")).toBe(false);
    expect(verifyShareToken("rep-123", null)).toBe(false);
    expect(verifyShareToken("rep-123", "krótki")).toBe(false);
  });

  it("shareUrl zawiera token i ścieżkę /r/", () => {
    const url = shareUrl("https://app.diagolab.pl/", "rep-9");
    expect(url.startsWith("https://app.diagolab.pl/r/rep-9?t=")).toBe(true);
  });
});

describe("renderReportPdfHtml", () => {
  const html = renderReportPdfHtml({
    payload,
    qrDataUrl: null,
    sha256: "ab".repeat(32),
    persistence: {
      reportId: "x",
      initialDecisions: { "F-LP-05-ZS": { decision: "ACCEPTED", note: "potwierdzone w terenie" } },
      initialApproval: { assessment: "WARUNKOWA", approvedAt: "2026-01-20T10:00:00Z" },
    },
  });

  it("zawiera komplet sekcji specyfikacji (strona tytułowa → źródła)", () => {
    for (const marker of [
      "Pomiary ochronne instalacji elektrycznej",
      "Wyniki pomiarów",
      "Wykresy",
      "Analiza i interpretacja",
      "Historia pomiarów",
      "Ostrzeżenia i zalecenia",
      "Ocena końcowa",
      "podpis wykonawcy",
      "Źródła danych i integralność",
      "WERSJA DEMONSTRACYJNA",
      DEMO_META.reportNumber,
    ]) {
      expect(html).toContain(marker);
    }
  });

  it("escapuje HTML danych użytkownika (XSS-safe)", () => {
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("pokazuje decyzję wykonawcy i ocenę końcową", () => {
    expect(html).toContain("potwierdzone w terenie");
    expect(html).toContain("WARUNKOWA");
  });

  it("osadza wektorowe wykresy SVG z etykietami punktów", () => {
    expect(html).toContain("<svg");
    expect(html).toContain("LP-05");
    expect(html).toContain("polyline"); // historia Smart Compare+
  });

  it("osadza hash SHA-256 zbioru danych", () => {
    expect(html).toContain("ab".repeat(32));
  });
});

describe("logo firmy w PDF", () => {
  const withLogo = (logoDataUrl: string | null) =>
    renderReportPdfHtml({
      payload: { ...payload, meta: { ...payload.meta, logoDataUrl } },
      qrDataUrl: null,
      sha256: "cd".repeat(32),
    });

  it("osadza prawidłowe logo (data URL PNG) na stronie tytułowej", () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const html = withLogo(png);
    expect(html).toContain(png);
    expect(html).toContain("Logo wykonawcy");
    expect(html).toContain("WYKONAWCA BADAŃ".toLowerCase() === "" ? "" : "Wykonawca badań");
  });

  it("akceptuje SVG i WEBP", () => {
    expect(withLogo("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toContain("Logo wykonawcy");
    expect(withLogo("data:image/webp;base64,UklGRg==")).toContain("Logo wykonawcy");
  });

  it("odrzuca niebezpieczne / nieprawidłowe źródła logo", () => {
    for (const bad of [
      "javascript:alert(1)",
      "https://obcy-serwer.example/logo.png",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "data:image/png,<svg onload=alert(1)>",
    ]) {
      const html = withLogo(bad);
      expect(html).not.toContain(bad);
      expect(html).not.toContain("Logo wykonawcy");
    }
  });

  it("bez logo dokument renderuje się poprawnie", () => {
    const html = withLogo(null);
    expect(html).not.toContain("Logo wykonawcy");
    expect(html).toContain("Pomiary ochronne instalacji elektrycznej");
  });
});

describe("reportNarrative (Moduł B — regułowy)", () => {
  it("podsumowuje liczby i ostrzeżenia bez zmyślania", () => {
    const parts = reportNarrative(analysis);
    expect(parts[0]).toContain("12 punktów");
    expect(parts.join(" ")).toContain("LP-05");
    expect(parts[parts.length - 1]).toContain("wykonawca");
  });
});

describe("esc", () => {
  it("neutralizuje znaczniki i apostrofy", () => {
    expect(esc(`<img onerror='x'>`)).toBe("&lt;img onerror=&#39;x&#39;&gt;");
  });
});
