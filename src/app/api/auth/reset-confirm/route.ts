import { NextResponse } from "next/server";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationCodes } from "@/db/schema";
import { sha256, hashPassword, audit } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/auth/reset-confirm { email, code, newPassword } */
export async function POST(req: Request) {
  let body: { email?: string; code?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();
  const newPassword = String(body.newPassword ?? "");

  if (!/^\d{6}$/.test(code) || newPassword.length < 8) {
    return NextResponse.json({ error: "Nieprawidłowy kod lub zbyt krótkie hasło." }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return NextResponse.json({ error: "Kod nieprawidłowy lub wygasł." }, { status: 400 });

  const [vc] = await db
    .select()
    .from(verificationCodes)
    .where(and(eq(verificationCodes.userId, user.id), eq(verificationCodes.channel, "email"), isNull(verificationCodes.consumedAt)))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);

  if (!vc || vc.expiresAt < new Date() || vc.codeHash !== sha256(code)) {
    return NextResponse.json({ error: "Kod nieprawidłowy lub wygasł." }, { status: 400 });
  }

  await db.update(verificationCodes).set({ consumedAt: new Date() }).where(eq(verificationCodes.id, vc.id));
  await db.update(users).set({ passwordHash: hashPassword(newPassword), failedLogins: 0 }).where(eq(users.id, user.id));
  await audit(user.id, "auth.reset.confirm");

  return NextResponse.json({ ok: true });
}
