import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationCodes } from "@/db/schema";
import { generateCode, sha256, audit } from "@/lib/auth";
import { sendPasswordResetCode } from "@/lib/mailer";

export const runtime = "nodejs";

/** POST /api/auth/reset-request — kod resetu hasła na e-mail (kanał 'email'). */
export async function POST(req: Request) {
  let email: string;
  try {
    email = String((await req.json()).email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  // Bezpieczeństwo: jednakowa odpowiedź niezależnie od istnienia konta.
  const genericOk = NextResponse.json({ ok: true, message: "Jeśli konto istnieje, wysłaliśmy kod resetujący." });

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return genericOk;

  const code = generateCode();
  await db.insert(verificationCodes).values({
    userId: user.id,
    channel: "email",
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  await audit(user.id, "auth.reset.request");

  const result = await sendPasswordResetCode(email, code);
  if (result.devMode) {
    return NextResponse.json({ ok: true, devCode: code, message: "Tryb DEV: kod zwrócony w odpowiedzi (brak konfiguracji SMTP)." });
  }
  return genericOk;
}
