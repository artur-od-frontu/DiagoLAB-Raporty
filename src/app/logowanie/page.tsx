"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, LogIn, LoaderCircle, CircleCheck, ArrowLeft } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/chrome";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/panel";
  const reason = params.get("reason");
  const draftSaved = params.get("saved") === "1";

  const [mode, setMode] = useState<"login" | "reset" | "resetSent" | "resetDone">("login");
  const [resetCode, setResetCode] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", code: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await post("/api/auth/login", { email: form.email, password: form.password });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Błąd logowania.");
    router.push(next);
    router.refresh();
  };

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await post("/api/auth/reset-request", { email: form.email });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Nie udało się wysłać kodu.");
    if (r.data.devCode) setResetCode(r.data.devCode);
    setMode("resetSent");
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await post("/api/auth/reset-confirm", { email: form.email, code: form.code, newPassword: form.newPassword });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Nie udało się zmienić hasła.");
    setMode("resetDone");
  };

  return (
    <div className="max-w-md w-full mx-auto">
      <div className="card p-7 md:p-9">
        {reason === "idle" && (
          <p className="mb-5 text-[12.5px] leading-relaxed text-amp hairline !border-amp/40 rounded-lg px-4 py-3 bg-amp/5" role="status">
            Sesja została automatycznie zakończona z powodu bezczynności.
            {draftSaved
              ? " Niezapisane dokumenty zapisaliśmy jako wersje robocze — znajdziesz je po zalogowaniu (np. w „Nowy raport”)."
              : " Zaloguj się ponownie, aby kontynuować."}
          </p>
        )}
        {error && <p className="mb-5 text-[13px] text-crit hairline !border-crit/40 rounded-lg px-4 py-3 bg-crit/5" role="alert">{error}</p>}

        {mode === "login" && (
          <form onSubmit={login} className="space-y-5">
            <header>
              <h1 className="font-display font-bold text-[22px]">Zaloguj się</h1>
              <p className="text-[13px] text-dim mt-1.5">Dostęp do panelu instalatora i archiwum raportów.</p>
            </header>
            <div className="field">
              <label htmlFor="email">Adres e-mail</label>
              <input id="email" type="email" required autoComplete="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="password">Hasło</label>
              <input id="password" type="password" required autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-40">
              {busy ? <LoaderCircle size={16} className="anim-spin-slow" aria-hidden /> : <LogIn size={16} aria-hidden />}
              {busy ? "Logowanie…" : "Zaloguj się"}
            </button>
            <button type="button" onClick={() => setMode("reset")} className="w-full text-center text-[12.5px] text-dim hover:text-volt transition-colors">
              Nie pamiętam hasła
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={requestReset} className="space-y-5">
            <header className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-xl border border-volt/40 bg-volt/10 text-volt"><KeyRound size={16} aria-hidden /></span>
              <div>
                <h1 className="font-display font-bold text-[20px]">Reset hasła</h1>
                <p className="text-[13px] text-dim mt-1">Wyślemy 6-cyfrowy kod na Twój adres e-mail.</p>
              </div>
            </header>
            <div className="field">
              <label htmlFor="r-email">Adres e-mail</label>
              <input id="r-email" type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-40">{busy ? "Wysyłanie…" : "Wyślij kod resetujący"}</button>
            <button type="button" onClick={() => setMode("login")} className="mx-auto flex items-center gap-1.5 text-[12px] text-faint hover:text-dim"><ArrowLeft size={13} aria-hidden /> Wróć do logowania</button>
          </form>
        )}

        {mode === "resetSent" && (
          <form onSubmit={confirmReset} className="space-y-5">
            <h1 className="font-display font-bold text-[20px]">Ustaw nowe hasło</h1>
            {resetCode && <p className="font-mono text-[11px] text-amp">Tryb DEV (brak SMTP): kod = {resetCode}</p>}
            <div className="field">
              <label htmlFor="r-code">Kod z e-maila</label>
              <input id="r-code" inputMode="numeric" pattern="\d{6}" maxLength={6} required className="input num-mono text-center !text-[20px] tracking-[0.4em]" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="______" />
            </div>
            <div className="field">
              <label htmlFor="r-pass">Nowe hasło (min. 8 znaków)</label>
              <input id="r-pass" type="password" minLength={8} required autoComplete="new-password" className="input" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-40">{busy ? "Zmienianie…" : "Zmień hasło"}</button>
          </form>
        )}

        {mode === "resetDone" && (
          <div className="text-center py-4">
            <CircleCheck size={40} className="mx-auto text-ok" aria-hidden />
            <h1 className="font-display font-bold text-[20px] mt-4">Hasło zmienione</h1>
            <p className="text-[13px] text-dim mt-2">Możesz się zalogować nowym hasłem.</p>
            <button type="button" onClick={() => { setMode("login"); setError(null); }} className="btn btn-primary mt-6 w-full">Przejdź do logowania</button>
          </div>
        )}
      </div>

      <p className="text-center mt-5 text-[12.5px] text-dim">
        Nie masz konta? <Link href="/rejestracja" className="text-volt hover:underline underline-offset-4">Wygeneruj pierwszy raport gratis</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-ink bg-noise relative">
        <div className="absolute inset-0 bg-blueprint pointer-events-none" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5 pt-36 pb-24 flex justify-center">
          <Suspense fallback={<div className="card p-9 max-w-md w-full text-center text-dim">Ładowanie…</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
