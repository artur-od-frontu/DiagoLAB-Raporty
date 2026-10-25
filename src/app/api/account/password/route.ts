import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, verifyPassword, hashPassword, audit } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/account/password — zmiana hasła po weryfikacji obecnego. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");
  if (next.length < 8) return NextResponse.json({ error: "Nowe hasło musi mieć min. 8 znaków." }, { status: 400 });

  const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u || !verifyPassword(current, u.passwordHash)) {
    return NextResponse.json({ error: "Obecne hasło jest nieprawidłowe." }, { status: 403 });
  }

  await db.update(users).set({ passwordHash: hashPassword(next), failedLogins: 0 }).where(eq(users.id, user.id));
  await audit(user.id, "account.password-change");
  return NextResponse.json({ ok: true });
}
