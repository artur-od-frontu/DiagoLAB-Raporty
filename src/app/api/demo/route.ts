import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { analyzePoints } from "@/lib/engine";
import { DEMO_META, DEMO_POINTS, DEMO_HISTORY } from "@/lib/demo-data";

export const runtime = "nodejs";

/**
 * GET /api/demo — pełny model danych raportu demonstracyjnego.
 * Ten sam model zasila widok HTML oraz generator PDF.
 */
export async function GET() {
  const analysis = analyzePoints(DEMO_POINTS);
  const snapshot = JSON.stringify({
    nr: DEMO_META.reportNumber,
    data: DEMO_META.date,
    punkty: DEMO_POINTS,
    silnik: analysis.algorithmVersion,
    wersjaKryteriow: analysis.criteriaSet,
  });
  const sha256 = createHash("sha256").update(snapshot).digest("hex");

  return NextResponse.json({
    meta: { ...DEMO_META, demo: true },
    points: DEMO_POINTS,
    history: DEMO_HISTORY,
    analysis,
    integrity: { sha256, algorithm: "SHA-256" },
  });
}
