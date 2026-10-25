import { NextResponse } from "next/server";
import { db } from "@/db";
import { installerProfiles } from "@/db/schema";
import { getSessionUser, audit } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/profile — zapis profilu instalatora.
 * Numer świadectwa i dane osobowe pochodzą WYŁĄCZNIE od użytkownika —
 * nigdy nie są generowane przez AI.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  let body: Record<string, string | undefined>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const v = (k: string) => (typeof body[k] === "string" && body[k]!.trim() ? body[k]!.trim() : null);
  const nip = v("nip");
  if (nip && !/^\d{10}$/.test(nip.replace(/[-\s]/g, ""))) {
    return NextResponse.json({ error: "NIP musi zawierać 10 cyfr." }, { status: 400 });
  }
  const certDate = v("certificateValidUntil");
  if (certDate && !/^\d{4}-\d{2}-\d{2}$/.test(certDate)) {
    return NextResponse.json({ error: "Nieprawidłowy format daty ważności świadectwa." }, { status: 400 });
  }

  await db
    .insert(installerProfiles)
    .values({
      userId: user.id,
      firstName: v("firstName"),
      lastName: v("lastName"),
      companyName: v("companyName"),
      nip: nip?.replace(/[-\s]/g, ""),
      address: v("address"),
      phone: v("phone"),
      email: v("email") ?? user.email,
      certificateNo: v("certificateNo"),
      qualificationScope: v("qualificationScope"),
      certificateValidUntil: certDate,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: installerProfiles.userId,
      set: {
        firstName: v("firstName"),
        lastName: v("lastName"),
        companyName: v("companyName"),
        nip: nip?.replace(/[-\s]/g, ""),
        address: v("address"),
        phone: v("phone"),
        email: v("email") ?? user.email,
        certificateNo: v("certificateNo"),
        qualificationScope: v("qualificationScope"),
        certificateValidUntil: certDate,
        updatedAt: new Date(),
      },
    });

  await audit(user.id, "profile.save");
  return NextResponse.json({ ok: true });
}
