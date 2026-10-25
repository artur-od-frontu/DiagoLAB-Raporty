"use client";

/**
 * SESSION GUARD — logika sesji czynnej DiagoLAB Raporty+
 * =====================================================
 * Zasady (zgodnie ze specyfikacją produktu):
 *
 *  1. Sesja NIE wygasa podczas korzystania z platformy — czynności takie jak
 *     czytanie raportu, sprawdzanie wyników, praca z tabelą, a także OPERACJE
 *     W TLE (wgrywanie plików, parsowanie, zapis) odsuwają wygaśnięcie.
 *  2. Licznik uruchamia się dopiero po 5 minutach pełnej bezczynności
 *     (brak ruchu myszy, klawiatury, scrolla oraz operacji w tle).
 *  3. Po starcie licznika pojawia się modal z czasem pozostałym do
 *     automatycznego wylogowania. WZNOWIENIE AKTYWNOŚCI ZATRZYMUJE proces.
 *  4. Przy automatycznym wylogowaniu otwarte, niezapisane dokumenty są
 *     najpierw zapisywane na serwerze jako WERSJE ROBOCZE (/api/drafts).
 *
 *  Strona serwera: /api/session/ping pilnuje równolegle twardego limitu
 *  bezczynności — klient nie może „utrzymać" sesji wbrew serwerowi.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { TimerReset, LogOut, Save, MousePointerClick } from "lucide-react";
import { SESSION_TIMING } from "@/lib/session-timing";

/* ---------------- Rejestr wersji roboczych ---------------- */

type DraftProvider = () => { kind: "IMPORT" | "RAPORT"; payload: Record<string, unknown>; sourceFileName?: string } | null;

const draftProviders = new Set<DraftProvider>();

/** Strony rejestrują tu "dostawców" wersji roboczych otwartych dokumentów. */
export function registerDraftProvider(provider: DraftProvider): () => void {
  draftProviders.add(provider);
  return () => draftProviders.delete(provider);
}

async function flushDrafts(timeoutMs = 4000): Promise<number> {
  const jobs: Promise<Response>[] = [];
  for (const provider of draftProviders) {
    try {
      const draft = provider();
      if (!draft) continue;
      jobs.push(
        // keepalive: żądanie dokańcza się nawet gdy strona zaczyna się wyładowywać
        fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
          keepalive: true,
        }).catch(() => new Response(null, { status: 599 }))
      );
    } catch {
      /* uszkodzony provider nie blokuje innych */
    }
  }
  if (!jobs.length) return 0;
  await Promise.race([
    Promise.allSettled(jobs),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  return jobs.length;
}

/* ---------------- Operacje w tle ---------------- */

let operationsInFlight = 0;

/** Oznacz początek operacji w tle (upload, parsowanie, zapis) — wstrzymuje licznik. */
export function beginBackgroundOperation(): void {
  operationsInFlight += 1;
  window.dispatchEvent(new CustomEvent("dl:activity", { detail: { type: "operation" } }));
}

/** Oznacz koniec operacji w tle. */
export function endBackgroundOperation(): void {
  operationsInFlight = Math.max(0, operationsInFlight - 1);
}

/** Pojedynczy sygnał aktywności (np. zmiana mapowania kolumn). */
export function signalActivity(): void {
  window.dispatchEvent(new CustomEvent("dl:activity", { detail: { type: "interaction" } }));
}

/* ---------------- SessionGuard ---------------- */

type Phase = "ACTIVE" | "COUNTDOWN" | "SAVING";

export function SessionGuard() {
  const [phase, setPhase] = useState<Phase>("ACTIVE");
  const [secondsLeft, setSecondsLeft] = useState<number>(SESSION_TIMING.countdownSeconds);
  const [savedDrafts, setSavedDrafts] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());
  const resumeBtnRef = useRef<HTMLButtonElement>(null);

  const ping = useCallback(async () => {
    try {
      const res = await fetch("/api/session/ping", { method: "POST" });
      if (res.status === 401) {
        // Serwer już uznał sesję za wygasłą (np. bezczynność w innej karcie).
        await hardLogoutRef.current();
        return;
      }
      const data = (await res.json()) as { lastActivityAt?: number };
      // Synchronizacja między kartami: aktywność w innej karcie też przedłuża sesję tu.
      if (data.lastActivityAt && data.lastActivityAt > lastActivityRef.current) {
        lastActivityRef.current = data.lastActivityAt;
      }
    } catch {
      /* brak sieci — licznik lokalny nadal działa */
    }
  }, []);

  const hardLogout = useCallback(async () => {
    setPhase("SAVING");
    const saved = await flushDrafts();
    setSavedDrafts(saved);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* nawet bez odpowiedzi przechodzimy do logowania */
    }
    const reason = saved > 0 ? "idle&saved=1" : "idle";
    window.location.href = `/logowanie?reason=${reason}`;
  }, []);
  const hardLogoutRef = useRef(hardLogout);
  hardLogoutRef.current = hardLogout;

  const onActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setPhase((p) => {
      if (p === "COUNTDOWN") {
        // Wznowienie aktywności zatrzymuje odliczanie i odnawia sesję na serwerze.
        setSecondsLeft(SESSION_TIMING.countdownSeconds);
        void ping();
      }
      return p === "SAVING" ? p : "ACTIVE";
    });
  }, [ping]);

  /* Nasłuch aktywności użytkownika */
  useEffect(() => {
    const passiveEvents: [keyof WindowEventMap, number?][] = [
      ["pointerdown", 0],
      ["keydown", 0],
      ["touchstart", 0],
      ["wheel", 1500],
      ["mousemove", 1500],
      ["scroll", 1500],
    ];
    const lastFired: Partial<Record<string, number>> = {};
    const handler = (name: string, throttleMs = 0) => () => {
      const now = Date.now();
      if (throttleMs && now - (lastFired[name] ?? 0) < throttleMs) return;
      lastFired[name] = now;
      onActivity();
    };
    const registered = passiveEvents.map(([name, throttle]) => {
      const fn = handler(name, throttle ?? 0);
      window.addEventListener(name, fn, { passive: true });
      return [name, fn] as const;
    });
    const onCustom = () => onActivity();
    window.addEventListener("dl:activity", onCustom as EventListener);
    const onVisible = () => {
      if (document.visibilityState === "visible") onActivity();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      registered.forEach(([name, fn]) => window.removeEventListener(name, fn));
      window.removeEventListener("dl:activity", onCustom as EventListener);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onActivity]);

  /* Główny zegar: bezczynność → COUNTDOWN; heartbeat gdy aktywny */
  useEffect(() => {
    const tick = () => {
      // Operacje w tle (wgrywanie danych itp.) liczą się jako pełna aktywność.
      if (operationsInFlight > 0) {
        lastActivityRef.current = Date.now();
        return;
      }
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= SESSION_TIMING.idleAfterMs) {
        setPhase((p) => (p === "ACTIVE" ? "COUNTDOWN" : p));
      }
    };
    const clock = setInterval(tick, 1000);
    const heartbeat = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (document.visibilityState === "visible" && idleMs < SESSION_TIMING.idleAfterMs) {
        void ping();
      }
    }, 45_000);
    return () => {
      clearInterval(clock);
      clearInterval(heartbeat);
    };
  }, [ping]);

  /* Odliczanie w fazie COUNTDOWN */
  useEffect(() => {
    if (phase !== "COUNTDOWN") return;
    resumeBtnRef.current?.focus();
    const startedAt = Date.now();
    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const left = SESSION_TIMING.countdownSeconds - elapsed;
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(iv);
        void hardLogoutRef.current();
      }
    }, 250);
    return () => clearInterval(iv);
  }, [phase]);

  if (phase === "ACTIVE") return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const pct = (secondsLeft / SESSION_TIMING.countdownSeconds) * 100;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-ink/80 backdrop-blur-md px-5"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
    >
      <div className="card !rounded-2xl max-w-md w-full p-7 text-center shadow-volt">
        {phase === "SAVING" ? (
          <>
            <span className="mx-auto grid place-items-center w-14 h-14 rounded-2xl border border-volt/40 bg-volt/10 text-volt">
              <Save size={22} className="anim-pulse-dot" aria-hidden />
            </span>
            <h2 id="idle-title" className="font-display font-bold text-[19px] mt-5">Zapisywanie wersji roboczych…</h2>
            <p id="idle-desc" className="text-[13.5px] text-dim mt-2 leading-relaxed">
              Otwarte, niezapisane dokumenty zapisujemy jako wersje robocze, a następnie wylogujemy Cię bezpiecznie.
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto grid place-items-center w-14 h-14 rounded-2xl border border-amp/50 bg-amp/10 text-amp">
              <TimerReset size={24} aria-hidden />
            </span>
            <h2 id="idle-title" className="font-display font-bold text-[19px] mt-5">Wykryliśmy bezczynność</h2>
            <p id="idle-desc" className="text-[13.5px] text-dim mt-2 leading-relaxed">
              Nie wykryto operacji ani interakcji od 5 minut. Sesja zostanie automatycznie zakończona za:
            </p>
            <p className="num-mono font-display font-bold text-[44px] text-amp mt-4" aria-live="polite">
              {mm}:{ss}
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-line overflow-hidden" aria-hidden>
              <div className="h-full rounded-full bg-gradient-to-r from-amp to-crit transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-4 text-[12px] text-faint">
              Wznowienie aktywności (ruch myszy, klawiatura, scroll) zatrzyma odliczanie.
            </p>
            <div className="mt-5 grid gap-2.5">
              <button ref={resumeBtnRef} type="button" onClick={onActivity} className="btn btn-primary w-full">
                <MousePointerClick size={16} aria-hidden /> Kontynuuję pracę
              </button>
              <button type="button" onClick={() => void hardLogoutRef.current()} className="btn btn-ghost btn-sm w-full">
                <LogOut size={14} aria-hidden /> Wyloguj teraz (dokumenty → wersje robocze)
              </button>
            </div>
          </>
        )}
        {savedDrafts > 0 && phase === "SAVING" && (
          <p className="mt-2 text-[12px] text-ok">Zapisano wersji roboczych: {savedDrafts}</p>
        )}
      </div>
    </div>
  );
}
