import { NextResponse } from "next/server";
import { destroySession, getSessionUser, audit } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();
  await destroySession();
  if (user) await audit(user.id, "auth.logout");
  return NextResponse.json({ ok: true });
}
