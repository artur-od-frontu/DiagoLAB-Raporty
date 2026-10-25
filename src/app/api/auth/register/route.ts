import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationCodes, installerProfiles } from "@/db/schema";
import { hashPassword, generateCode, sha256, audit } from "@/lib/auth";
import { parseBody, registerSchema } from "@/lib/validation";
import { sendVerificationCode } from "@/lib/mailer";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s-]{9,15}$/;

/**
 * POST /api/auth/register
 * Tworzy konto (status NIEZWERYFIKOWANE) + kody weryfikacyjne e-mail/SMS.
 * W środowisku bez skonfigurowanych bramek SMTP/SMS kody są zwracane
 * w odpowiedzi z flagą dev — ułatwia to testy i demo (tryb deweloperski).
 */
export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const parsed = parseBody(registerSchema, raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { email, password, phone } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "Konto z tym adresem e-mail już istnieje." }, { status: 409 });
  }

  const userId = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 15 * 60 * 1000);

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash: hashPassword(password),
    phone,
    status: "NIEZWERYFIKOWANE",
  });
  await db.insert(installerProfiles).values({ userId, email, phone });

  const emailCode = generateCode();
  const smsCode = generateCode();
  await db.insert(verificationCodes).values([
    { userId, channel: "email", codeHash: sha256(emailCode), expiresAt: expires },
    { userId, channel: "sms", codeHash: sha256(smsCode), expiresAt: expires },
  ]);

  await audit(userId, "auth.register", { email });

  // Wysyłka kodów przez prawdziwe kanały (SMTP / SMS) lub tryb DEV
  const emailResult = await sendVerificationCode(email, emailCode, "email");
  const smsResult = await sendVerificationCode(phone, smsCode, "sms");

  const bothDev = emailResult.devMode && smsResult.devMode;
  return NextResponse.json({
    ok: true,
    userId,
    verification: {
      emailSent: emailResult.sent,
      smsSent: smsResult.sent,
      ...(bothDev ? { dev: true, devEmailCode: emailCode, devSmsCode: smsCode } : {}),
    },
    message: bothDev
      ? "Tryb deweloperski — brak skonfigurowanych bramek SMTP/SMS; kody zwrócone w odpowiedzi."
      : "Wysłaliśmy kody weryfikacyjne na e-mail i telefon.",
  });
}
