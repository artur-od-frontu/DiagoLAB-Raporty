import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, findingDecisions } from "@/db/schema";
import { getSessionUser, audit } from "@/lib/auth";

export const runtime = "nodejs";

const DECISIONS = new Set(["ACCEPTED", "REJECTED", "EDITED"]);

/**
 * POST /api/reports/[id]/decisions
 * Zapis decyzji instalatora dotyczących ostrzeżeń (akceptacja / odrzucenie /
 * edycja + uzasadnienie). Semantyka: pełna podmiana listy decyzji raportu —
 * historia pozostaje w logach audytowych.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  const { id } = await ctx.params;
  let body: { decisions?: Record<string, { decision?: string; note?: string; edited?: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }
  if (!body.decisions || typeof body.decisions !== "object") {
    return NextResponse.json({ error: "Brak decyzji do zapisania." }, { status: 400 });
  }

  const [rep] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!rep || rep.userId !== user.id) {
    return NextResponse.json({ error: "Raport nie istnieje lub brak uprawnień." }, { status: 404 });
  }

  const entries = Object.entries(body.decisions)
    .filter(([, v]) => v?.decision && DECISIONS.has(v.decision))
    .map(([findingKey, v]) => ({
      reportId: id,
      findingKey,
      decision: v.decision as "ACCEPTED" | "REJECTED" | "EDITED",
      note: [v.note, v.edited].filter(Boolean).join(" — ").slice(0, 1000) || null,
      decidedBy: user.email,
    }));

  await db.delete(findingDecisions).where(eq(findingDecisions.reportId, id));
  if (entries.length) await db.insert(findingDecisions).values(entries);

  await audit(user.id, "report.decisions", { reportId: id, count: entries.length });
  return NextResponse.json({ ok: true, saved: entries.length });
}
