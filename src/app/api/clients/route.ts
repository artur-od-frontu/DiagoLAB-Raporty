import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { getSessionUser, audit } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });
  const rows = await db.select().from(clients).where(eq(clients.userId, user.id)).orderBy(desc(clients.createdAt)).limit(200);
  return NextResponse.json({ clients: rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  let body: { name?: string; nip?: string; email?: string; phone?: string; address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name || name.length < 2) return NextResponse.json({ error: "Podaj nazwę klienta." }, { status: 400 });
  const nip = body.nip?.replace(/[-\s]/g, "");
  if (nip && !/^\d{10}$/.test(nip)) return NextResponse.json({ error: "NIP musi zawierać 10 cyfr." }, { status: 400 });

  const [created] = await db
    .insert(clients)
    .values({
      userId: user.id,
      name,
      nip: nip || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
    })
    .returning({ id: clients.id });

  await audit(user.id, "client.create", { name });
  return NextResponse.json({ ok: true, id: created.id });
}
