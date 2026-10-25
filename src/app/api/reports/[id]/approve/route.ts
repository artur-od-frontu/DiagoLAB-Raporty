import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, measurementHistory, objects, type StoredReportData } from "@/db/schema";
import { getSessionUser, audit } from "@/lib/auth";
import type { RawPoint } from "@/lib/engine";

export const runtime = "nodejs";

const ASSESSMENTS = new Set(["POZYTYWNA", "WARUNKOWA", "NEGATYWNA"]);

/**
 * POST /api/reports/[id]/approve
 * Zatwierdzenie oceny końcowej przez wykonawcę.
 * - Wymaga jawnego potwierdzenia weryfikacji danych.
 * - Zapisuje historię pomiarów obiektu (Smart Compare+).
 * - Ustawia termin kolejnego badania (+12 miesięcy).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  const { id } = await ctx.params;
  let body: { assessment?: string; confirmDataVerification?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  if (!body.assessment || !ASSESSMENTS.has(body.assessment)) {
    return NextResponse.json({ error: "Wybierz ocenę końcową (POZYTYWNA / WARUNKOWA / NEGATYWNA)." }, { status: 400 });
  }
  if (body.confirmDataVerification !== true) {
    return NextResponse.json({ error: "Zatwierdzenie wymaga potwierdzenia weryfikacji danych pomiarowych." }, { status: 400 });
  }

  const [rep] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!rep || rep.userId !== user.id) {
    return NextResponse.json({ error: "Raport nie istnieje lub brak uprawnień." }, { status: 404 });
  }
  if (rep.status === "ZATWIERDZONY") {
    return NextResponse.json({ error: "Raport został już zatwierdzony.", approvedAt: rep.approvedAt }, { status: 409 });
  }

  const now = new Date();
  await db
    .update(reports)
    .set({
      status: "ZATWIERDZONY",
      assessment: body.assessment as "POZYTYWNA" | "WARUNKOWA" | "NEGATYWNA",
      dataVerifiedConfirmed: now.toISOString(),
      approvedAt: now,
    })
    .where(eq(reports.id, id));

  // Historia pomiarów obiektu (pod Smart Compare+)
  const stored = rep.data as StoredReportData | null;
  if (rep.objectId && stored?.points) {
    const measuredAt = String((stored.meta as { date?: string })?.date ?? rep.createdAt.toISOString().slice(0, 10)).slice(0, 10);
    const rows: (typeof measurementHistory.$inferInsert)[] = [];
    for (const p of stored.points as RawPoint[]) {
      const push = (metric: string, value: number | null | undefined) => {
        if (value !== null && value !== undefined && Number.isFinite(value)) {
          rows.push({ objectId: rep.objectId!, reportId: rep.id, pointKey: p.code, metric, value, measuredAt });
        }
      };
      push("ZS", p.zsOhm);
      push("RISO", p.risoMOhm);
      push("CONTINUITY", p.continuityOhm);
      push("RCD_TIME", p.rcdTripMs);
      push("RCD_CURRENT", p.rcdTripmA);
    }
    if (rows.length) await db.insert(measurementHistory).values(rows);

    // Termin kolejnego badania okresowego: +12 miesięcy
    const next = new Date(new Date(measuredAt).getTime() + 365 * 24 * 3600 * 1000);
    await db
      .update(objects)
      .set({ nextInspectionAt: next.toISOString().slice(0, 10) })
      .where(eq(objects.id, rep.objectId));
  }

  await audit(user.id, "report.approve", { reportId: id, number: rep.number, assessment: body.assessment });
  return NextResponse.json({ ok: true, approvedAt: now.toISOString(), assessment: body.assessment });
}
