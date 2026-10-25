import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { drafts } from "@/db/schema";
import { getSessionUser, audit } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_PAYLOAD_CHARS = 400_000; // twardy limit wersji roboczej (~400 KB JSON)
const VALID_KINDS = new Set(["IMPORT", "RAPORT"]);

/**
 * Wersje robocze niezapisanych dokumentów.
 * Zapisywane automatycznie m.in. przy automatycznym wylogowaniu
 * (bezczynność) oraz cyklicznie podczas pracy.
 *
 * GET    /api/drafts?kind=IMPORT|RAPORT  → najnowsza wersja
 * POST   /api/drafts { kind, payload, sourceFileName? }  → upsert (1/kind)
 * DELETE /api/drafts?kind=...            → odrzucenie wersji roboczej
 */

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  if (!VALID_KINDS.has(kind)) return NextResponse.json({ error: "Nieznany typ wersji roboczej." }, { status: 400 });

  const [row] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.userId, user.id), eq(drafts.kind, kind as "IMPORT" | "RAPORT")))
    .orderBy(desc(drafts.updatedAt))
    .limit(1);

  return NextResponse.json({ draft: row ?? null });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  let body: { kind?: string; payload?: Record<string, unknown>; sourceFileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  if (!body.kind || !VALID_KINDS.has(body.kind) || typeof body.payload !== "object" || body.payload === null) {
    return NextResponse.json({ error: "Nieprawidłowa wersja robocza." }, { status: 400 });
  }
  if (JSON.stringify(body.payload).length > MAX_PAYLOAD_CHARS) {
    return NextResponse.json({ error: "Wersja robocza przekracza limit rozmiaru (400 KB)." }, { status: 413 });
  }

  const kind = body.kind as "IMPORT" | "RAPORT";
  // Jeden świeży szkic danego typu na użytkownika — starsze usuwamy.
  await db.delete(drafts).where(and(eq(drafts.userId, user.id), eq(drafts.kind, kind)));
  const [created] = await db
    .insert(drafts)
    .values({ userId: user.id, kind, payload: body.payload, sourceFileName: body.sourceFileName?.slice(0, 200) ?? null })
    .returning({ id: drafts.id, updatedAt: drafts.updatedAt });

  await audit(user.id, `draft.save.${kind.toLowerCase()}`, { sourceFileName: body.sourceFileName ?? null });
  return NextResponse.json({ ok: true, draft: created });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  if (!VALID_KINDS.has(kind)) return NextResponse.json({ error: "Nieznany typ wersji roboczej." }, { status: 400 });

  await db.delete(drafts).where(and(eq(drafts.userId, user.id), eq(drafts.kind, kind as "IMPORT" | "RAPORT")));
  return NextResponse.json({ ok: true });
}
