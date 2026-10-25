import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { getSessionUser, audit } from "@/lib/auth";
import { buildReportPayload } from "@/lib/report-payload";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/reports/[id] — pełny model raportu (tylko właściciel). */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  const { id } = await ctx.params;
  const built = await buildReportPayload(user.id, id);
  if (!built) return NextResponse.json({ error: "Raport nie istnieje lub brak uprawnień." }, { status: 404 });

  return NextResponse.json({ ...built.payload, persistence: built.persistence, status: built.status });
}

/** DELETE /api/reports/[id] — usuwanie wyłącznie szkiców (raport niezatwierdzony). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  const { id } = await ctx.params;
  const [rep] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!rep || rep.userId !== user.id) {
    return NextResponse.json({ error: "Raport nie istnieje lub brak uprawnień." }, { status: 404 });
  }
  if (rep.status === "ZATWIERDZONY") {
    return NextResponse.json({ error: "Zatwierdzonego raportu nie można usunąć — stanowi dokumentację pomiarową." }, { status: 409 });
  }

  await db.delete(reports).where(eq(reports.id, id));
  await audit(user.id, "report.delete", { reportId: id, number: rep.number });
  return NextResponse.json({ ok: true });
}
