import { NextResponse } from "next/server";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationCodes } from "@/db/schema";
import { sha256, audit } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/verify { userId, channel: 'email'|'sms', code }
 * Oznacza kanał jako zweryfikowany; po obu kanałach konto przechodzi
 * w status DEMO (osiągalny jeden pełny raport gratis po uzupełnieniu profilu).
 */
export async function POST(req: Request) {
  let body: { userId?: string; channel?: "email" | "sms"; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const { userId, channel } = body;
  const code = String(body.code ?? "").trim();
  if (!userId || (channel !== "email" && channel !== "sms") || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Nieprawidłowe dane weryfikacyjne." }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.userId, userId),
        eq(verificationCodes.channel, channel),
        isNull(verificationCodes.consumedAt)
      )
    )
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row || row.expiresAt < new Date() || row.codeHash !== sha256(code)) {
    if (row) {
      await db.update(verificationCodes).set({ attempts: row.attempts + 1 }).where(eq(verificationCodes.id, row.id));
    }
    return NextResponse.json({ error: "Kod nieprawidłowy lub wygasł." }, { status: 400 });
  }

  await db.update(verificationCodes).set({ consumedAt: new Date() }).where(eq(verificationCodes.id, row.id));

  const field = channel === "email" ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() };
  await db.update(users).set(field).where(eq(users.id, userId));

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  let status = u?.status ?? "NIEZWERYFIKOWANE";
  if (u?.emailVerifiedAt && (u?.phoneVerifiedAt || channel === "sms")) {
    // oba kanały potwierdzone → status DEMO (darmowy raport dostępny po profilu)
    const bothVerified = Boolean(u.emailVerifiedAt) && Boolean(channel === "sms" || u.phoneVerifiedAt);
    if (bothVerified && u.status === "NIEZWERYFIKOWANE") {
      await db.update(users).set({ status: "DEMO" }).where(eq(users.id, userId));
      status = "DEMO";
    }
  }

  await audit(userId, `auth.verify.${channel}`);
  return NextResponse.json({ ok: true, channel, status });
}
