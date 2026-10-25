import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, destroySession, audit } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/account/delete { confirmEmail } — usunięcie konta (RODO, art. 17). */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  let body: { confirmEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }
  if (String(body.confirmEmail ?? "").trim().toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Podaj swój adres e-mail, aby potwierdzić usunięcie konta." }, { status: 400 });
  }

  await audit(user.id, "account.delete");
  // Kaskadowe usunięcie profilu, sesji, raportów, wersji roboczych itd. (FK onDelete: cascade)
  await db.delete(users).where(eq(users.id, user.id));
  await destroySession();

  return NextResponse.json({ ok: true });
}
