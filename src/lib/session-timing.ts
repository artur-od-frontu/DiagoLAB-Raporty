/**
 * Parametry czasowe sesji czynnej — moduł IZOMORFICZNY.
 * Współdzielony przez serwer (lib/auth.ts, /api/session/ping)
 * i klienta (components/session-guard.tsx). Bez zależności Node.
 */

/** Po tylu ms bezczynności uruchamia się widoczny licznik wylogowania. */
export const IDLE_AFTER_MS = 5 * 60 * 1000;

/** Długość odliczania pokazywana użytkownikowi (sekundy). */
export const SESSION_COUNTDOWN_S = 60;

/** Bufor serwerowy ponad odliczanie (margines na opóźnienia sieci). */
export const SESSION_GRACE_MS = (SESSION_COUNTDOWN_S + 20) * 1000;

export const SESSION_TIMING = {
  idleAfterMs: IDLE_AFTER_MS,
  countdownSeconds: SESSION_COUNTDOWN_S,
  /** Okno ważności od ostatniej aktywności — po stronie serwera. */
  validWindowMs: IDLE_AFTER_MS + SESSION_GRACE_MS,
} as const;
