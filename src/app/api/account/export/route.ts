import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { users, installerProfiles, reports, transactions, subscriptions, clients, objects } from "@/db/schema";
import { getSessionUser, audit } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/account/export — eksport danych osobowych (RODO, art. 20). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const [profile] = await db.select().from(installerProfiles).where(eq(installerProfiles.userId, user.id)).limit(1);
  const reps = await db
    .select({
      number: reports.number, status: reports.status, createdAt: reports.createdAt,
      approvedAt: reports.approvedAt, sourceFileName: reports.sourceFileName, sourceSha256: reports.sourceSha256,
    })
    .from(reports).where(eq(reports.userId, user.id)).orderBy(desc(reports.createdAt)).limit(500);
  const txs = await db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(200);
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).orderBy(desc(subscriptions.startedAt)).limit(20);
  const clis = await db.select().from(clients).where(eq(clients.userId, user.id)).limit(500);
  const objs = await db.select().from(objects).where(eq(objects.userId, user.id)).limit(500);

  await audit(user.id, "account.export");

  const payload = {
    wygenerowano: new Date().toISOString(),
    system: "DiagoLAB Raporty+ — eksport danych osobowych (RODO)",
    konto: u && { email: u.email, telefon: u.phone, status: u.status, utworzono: u.createdAt, emailZweryfikowany: u.emailVerifiedAt, telefonZweryfikowany: u.phoneVerifiedAt },
    profilInstalatora: profile ?? null,
    klienci: clis,
    obiekty: objs,
    raporty: reps,
    transakcje: txs,
    subskrypcje: subs,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="diagolab-eksport-danych-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
