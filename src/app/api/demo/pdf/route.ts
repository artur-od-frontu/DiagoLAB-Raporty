import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { analyzePoints } from "@/lib/engine";
import { DEMO_META, DEMO_POINTS, DEMO_HISTORY } from "@/lib/demo-data";
import { BRAND } from "@/config/brand";
import { renderReportPdfHtml } from "@/lib/pdf-template";
import { renderPdf } from "@/lib/pdf";
import type { ReportPayload } from "@/components/report-view";

export const runtime = "nodejs";

/**
 * GET /api/demo/pdf — publiczny smak produktu: pełny PDF z danych DEMO.
 * Jednocześnie smoketest generatora (ten sam szablon co raporty użytkowników).
 */
export async function GET() {
  const analysis = analyzePoints(DEMO_POINTS);
  const payload: ReportPayload = {
    meta: DEMO_META,
    points: DEMO_POINTS,
    analysis,
    history: DEMO_HISTORY,
    isDemo: true,
  };

  const snapshot = JSON.stringify({ nr: DEMO_META.reportNumber, data: DEMO_META.date, punkty: DEMO_POINTS, silnik: analysis.algorithmVersion });
  const sha256 = createHash("sha256").update(snapshot).digest("hex");

  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(`${BRAND.appUrl}/demo`, { width: 192, margin: 1, color: { dark: "#0b3550", light: "#ffffff" } });
  } catch { qrDataUrl = null; }

  const html = renderReportPdfHtml({ payload, qrDataUrl, sha256 });
  let pdf: Buffer;
  try {
    pdf = await renderPdf(html, { reportNumber: DEMO_META.reportNumber, demo: true });
  } catch (err) {
    console.error("[pdf] render nie powiódł się:", err);
    return NextResponse.json({ error: "Generator PDF chwilowo niedostępny. Spróbuj ponownie za chwilę.", code: "PDF_RENDERER_UNAVAILABLE" }, { status: 503 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="diagolab-raport-demo.pdf"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
