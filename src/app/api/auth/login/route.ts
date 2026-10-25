import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, createSession, audit } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FAILED = 8;

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const genericError = NextResponse.json({ error: "Nieprawidłowy e-mail lub hasło." }, { status: 401 });

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) return genericError;

  if (user.status === "ZABLOKOWANE") {
    return NextResponse.json({ error: "Konto jest zablokowane. Skontaktuj się z pomocą techniczną." }, { status: 403 });
  }
  if ((user.failedLogins ?? 0) >= MAX_FAILED) {
    await db.update(users).set({ status: "ZABLOKOWANE" }).where(eq(users.id, user.id));
    await audit(user.id, "auth.login.lockout", { email });
    return NextResponse.json({ error: "Zbyt wiele nieudanych prób — konto zostało czasowo zablokowane." }, { status: 423 });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    await db.update(users).set({ failedLogins: (user.failedLogins ?? 0) + 1 }).where(eq(users.id, user.id));
    return genericError;
  }

  await db.update(users).set({ failedLogins: 0 }).where(eq(users.id, user.id));
  await createSession(user.id, req.headers.get("user-agent"));
  await audit(user.id, "auth.login", { email });

  return NextResponse.json({ ok: true, status: user.status });
}
