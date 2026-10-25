import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSessionUser, audit } from "@/lib/auth";
import { buildReportPayload } from "@/lib/report-payload";
import { shareUrl, computeShareToken } from "@/lib/share";
import { BRAND } from "@/config/brand";
import { renderReportPdfHtml } from "@/lib/pdf-template";
import { renderPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/reports/[id]/pdf — profesjonalny raport PDF A4.
 * Dostęp: wyłącznie właściciel raportu (sesja). QR prowadzi do
 * współdzielonego, tokenizowanego podglądu tylko-do-odczytu.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  const { id } = await ctx.params;
  const built = await buildReportPayload(user.id, id);
  if (!built) return NextResponse.json({ error: "Raport nie istnieje lub brak uprawnień." }, { status: 404 });

  void computeShareToken; // token obliczany deterministycznie w shareUrl
  const share = shareUrl(BRAND.appUrl, id);

  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(share, { width: 192, margin: 1, color: { dark: "#0b3550", light: "#ffffff" } });
  } catch { qrDataUrl = null; }

  // Skrót integralności: identyczny algorytm jak w raporcie HTML
  const snapshot = JSON.stringify({
    nr: built.payload.meta.reportNumber,
    data: built.payload.meta.date,
    punkty: built.payload.points,
    silnik: built.payload.analysis.algorithmVersion,
    wersjaKryteriow: built.payload.analysis.criteriaSet,
  });
  const { createHash } = await import("node:crypto");
  const sha256 = createHash("sha256").update(snapshot).digest("hex");

  const html = renderReportPdfHtml({ payload: built.payload, persistence: built.persistence, qrDataUrl, shareUrl: share, sha256 });
  let pdf: Buffer;
  try {
    pdf = await renderPdf(html, { reportNumber: built.payload.meta.reportNumber });
  } catch (err) {
    console.error("[pdf] render nie powiódł się:", err);
    return NextResponse.json(
      { error: "Generator PDF chwilowo niedostępny. Użyj „Drukuj” w raporcie lub spróbuj ponownie.", code: "PDF_RENDERER_UNAVAILABLE" },
      { status: 503 }
    );
  }

  await audit(user.id, "report.pdf", { reportId: id, number: built.payload.meta.reportNumber });

  const safeName = built.payload.meta.reportNumber.replace(/[^A-Za-z0-9-]+/g, "-");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
