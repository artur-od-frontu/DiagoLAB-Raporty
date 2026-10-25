import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { installerProfiles } from "@/db/schema";
import { getSessionUser, audit } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 512 * 1024; // 512 KB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/** Sygnatury plików — weryfikacja treści, nie tylko deklarowanego typu MIME. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  const head = buf.toString("utf8", 0, Math.min(512, buf.length)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

/** Usuwa skrypty i zdarzenia z SVG (ochrona przed XSS w osadzonym logo). */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}

/** POST /api/profile/logo — upload logo firmy (multipart/form-data, pole „logo”). */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("logo");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie (oczekiwano multipart/form-data)." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Nie wybrano pliku z logo." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Plik jest za duży (maks. ${Math.round(MAX_BYTES / 1024)} KB).` }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMime(buf);
  if (!sniffed || !ALLOWED.has(sniffed)) {
    return NextResponse.json({ error: "Dozwolone formaty logo: PNG, JPEG, WEBP, SVG." }, { status: 415 });
  }

  const payload = sniffed === "image/svg+xml" ? Buffer.from(sanitizeSvg(buf.toString("utf8")), "utf8") : buf;
  const dataUrl = `data:${sniffed};base64,${payload.toString("base64")}`;

  await db
    .insert(installerProfiles)
    .values({ userId: user.id, email: user.email, logoData: dataUrl, logoMime: sniffed, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: installerProfiles.userId,
      set: { logoData: dataUrl, logoMime: sniffed, updatedAt: new Date() },
    });

  await audit(user.id, "profile.logo.upload", { mime: sniffed, bytes: payload.length });
  return NextResponse.json({ ok: true, logoDataUrl: dataUrl, mime: sniffed, bytes: payload.length });
}

/** DELETE /api/profile/logo — usunięcie logo z profilu. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  await db
    .update(installerProfiles)
    .set({ logoData: null, logoMime: null, updatedAt: new Date() })
    .where(eq(installerProfiles.userId, user.id));

  await audit(user.id, "profile.logo.delete");
  return NextResponse.json({ ok: true });
}
