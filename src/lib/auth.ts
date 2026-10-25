/**
 * Autoryzacja DiagoLAB Raporty+ (serwer-only)
 * ===========================================
 * Model sesji: SESJA CZYNNA (sliding), sterowana aktywnością użytkownika.
 *
 *  - Sesja NIE wygasa, gdy użytkownik korzysta z platformy (czyta raporty,
 *    pracuje z tabelą, wgrywa pliki, wykonuje operacje w tle).
 *  - Licznik bezczynności startuje dopiero po IDLE_AFTER_MS braku aktywności
 *    (po stronie klienta pojawia się odliczanie SESSION_COUNTDOWN_S).
 *  - Po upływie IDLE_AFTER_MS + GRACE_MS bez aktywności sesja jest usuwana
 *    z bazy (automatyczne wylogowanie serwerowe).
 *  - expiresAt to wyłącznie twardy limit absolutny (30 dni).
 *
 * Hasła: scrypt z losową solą. W bazie trzymamy wyłącznie SHA-256 tokenu sesji.
 */

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, auditLogs } from "@/db/schema";
import type { AccountStatus } from "@/config/brand";
import { SESSION_TIMING } from "@/lib/session-timing";

export { SESSION_TIMING };

export const SESSION_COOKIE = "dl_session";

/** Twardy limit absolutny sesji (licznik bezczynności działa niezależnie). */
const SESSION_TTL_DAYS = 30;

/* ---------- Hasła ---------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/* ---------- Kody weryfikacyjne ---------- */

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ---------- Sesje ---------- */

export interface SessionUser {
  id: string;
  email: string;
  status: AccountStatus;
  sessionId: string;
  lastActivityAt: Date;
}

export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    userId,
    userAgent: userAgent ?? null,
    expiresAt,
    lastActivityAt: new Date(),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Odczyt sesji z uwierzytelnieniem + walidacja bezczynności.
 * Sam ODCZYT strony (np. otwarcie raportu) jest aktywnością — odnawia
 * licznik bezczynności (touch). Sesje martwe są usuwane z bazy.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      sessionId: sessions.id,
      lastActivityAt: sessions.lastActivityAt,
      expiresAt: sessions.expiresAt,
      userId: sessions.userId,
      email: users.email,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const idleMs = Date.now() - row.lastActivityAt.getTime();
  if (idleMs > SESSION_TIMING.validWindowMs) {
    // Sesja martwa przez bezczynność — automatyczne wylogowanie serwerowe.
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    await audit(row.userId, "auth.session.idle-expired", { idleMinutes: Math.round(idleMs / 60000) });
    return null;
  }

  return {
    id: row.userId,
    email: row.email,
    status: row.status,
    sessionId: row.sessionId,
    lastActivityAt: row.lastActivityAt,
  };
}

/** Odświeża sygnaturę aktywności sesji (sliding session). */
export async function touchSession(sessionId: string): Promise<Date> {
  const now = new Date();
  await db.update(sessions).set({ lastActivityAt: now }).where(eq(sessions.id, sessionId));
  return now;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  store.delete(SESSION_COOKIE);
}

/* ---------- Log audytowy ---------- */

export async function audit(userId: string | null, action: string, meta?: Record<string, unknown>, ip?: string | null) {
  try {
    await db.insert(auditLogs).values({ userId, action, meta: meta ?? null, ip: ip ?? null });
  } catch {
    // Log audytowy nie może wywrócić żądania użytkownika.
  }
}
