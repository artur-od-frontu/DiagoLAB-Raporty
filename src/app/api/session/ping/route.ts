import { NextResponse } from "next/server";
import { getSessionUser, touchSession, SESSION_TIMING } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/session/ping — heartbeat aktywności.
 * Klient wywołuje go podczas realnego użycia (ruch, scroll, operacje w tle,
 * czytanie raportu). Odświeża licznik bezczynności po stronie serwera
 * i zwraca, ile czasu zostało do automatycznego wylogowania
 * oraz czas ostatniej aktywności (synchronizacja między kartami).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: "SESSION_EXPIRED", message: "Sesja wygasła z powodu bezczynności." },
      { status: 401 }
    );
  }

  // Operacje w tle (np. wgrywanie danych) mogą wysłać flagę — traktujemy jednakowo:
  // każdy ping to aktywność i odsuwa wygaśnięcie.
  const lastActivityAt = await touchSession(user.sessionId);

  return NextResponse.json({
    ok: true,
    now: Date.now(),
    lastActivityAt: lastActivityAt.getTime(),
    idleAfterMs: SESSION_TIMING.idleAfterMs,
    countdownSeconds: SESSION_TIMING.countdownSeconds,
    /** Ile ms zostało do twardego wygaśnięcia sesji po stronie serwera. */
    remainingMs: SESSION_TIMING.validWindowMs,
  });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "SESSION_EXPIRED" }, { status: 401 });
  }
  const elapsed = Date.now() - user.lastActivityAt.getTime();
  return NextResponse.json({
    ok: true,
    lastActivityAt: user.lastActivityAt.getTime(),
    idleAfterMs: SESSION_TIMING.idleAfterMs,
    countdownSeconds: SESSION_TIMING.countdownSeconds,
    remainingMs: Math.max(0, SESSION_TIMING.validWindowMs - elapsed),
  });
}
