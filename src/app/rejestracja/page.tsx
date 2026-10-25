"use client";

/**
 * REJESTRACJA — ścieżka modelu "jeden pełny raport gratis"
 * 1. Konto → 2. Kod e-mail → 3. Kod SMS → 4. Profil instalatora → 5. Start
 * Bez karty płatniczej. Wykorzystanie raportu zapisywane po stronie serwera.
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowLeft, CircleCheck, ShieldCheck, Mail, Phone, IdCard, LoaderCircle, KeyRound } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { LogoUpload } from "@/components/logo-upload";
import { PLANS } from "@/config/brand";

type Step = 1 | 2 | 3 | 4 | 5;

function RegisterWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = PLANS.find((p) => p.id === params.get("plan"));

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [devCodes, setDevCodes] = useState<{ email?: string; sms?: string } | null>(null);

  const [account, setAccount] = useState({ email: "", password: "", phone: "" });
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [profile, setProfile] = useState({
    firstName: "", lastName: "", companyName: "", nip: "", address: "",
    certificateNo: "", qualificationScope: "E do 1 kV", certificateValidUntil: "",
  });

  const post = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await post("/api/auth/register", account);
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Nie udało się utworzyć konta.");
    setUserId(r.data.userId);
    if (r.data.verification?.devEmailCode) setDevCodes({ email: r.data.verification.devEmailCode, sms: r.data.verification.devSmsCode });
    setStep(2);
  };

  const submitCode = async (channel: "email" | "sms") => {
    setBusy(true); setError(null);
    const code = channel === "email" ? emailCode : smsCode;
    const r = await post("/api/auth/verify", { userId, channel, code });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Nieprawidłowy kod.");
    if (channel === "email" && r.data.status !== "DEMO") return setStep(3);
    if (channel === "email") { await autoLogin(); return setStep(4); }
    await autoLogin();
    setStep(4);
  };

  const autoLogin = async () => {
    await post("/api/auth/login", { email: account.email, password: account.password });
  };

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await post("/api/profile", { ...profile, email: account.email, phone: account.phone });
    setBusy(false);
    if (!r.ok) {
      if (r.status === 401) { setError("Sesja wygasła — przejdź do profilu po zalogowaniu."); }
      else setError(r.data.error ?? "Nie udało się zapisać profilu.");
      return;
    }
    setStep(5);
    router.refresh();
  };

  const steps = ["Konto", "E-mail", "Telefon", "Profil", "Start"];

  return (
    <div className="max-w-xl w-full mx-auto">
      {/* postęp */}
      <ol className="flex items-center justify-center gap-1.5 mb-8" aria-label="Postęp rejestracji">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              className={`grid place-items-center w-8 h-8 rounded-full font-mono text-[11px] transition-colors ${
                step > i + 1 ? "bg-ok/20 text-ok border border-ok/40"
                : step === i + 1 ? "bg-volt/15 text-volt border border-volt/50 shadow-volt"
                : "border border-line2 text-faint"
              }`}
              aria-current={step === i + 1 ? "step" : undefined}
            >
              {step > i + 1 ? <CircleCheck size={14} aria-hidden /> : i + 1}
            </span>
            <span className={`hidden sm:block text-[11px] font-mono uppercase tracking-[0.1em] ${step === i + 1 ? "text-mist" : "text-faint"}`}>{s}</span>
            {i < steps.length - 1 && <span className="w-5 h-px bg-line2 mx-1" aria-hidden />}
          </li>
        ))}
      </ol>

      <div className="card p-7 md:p-9">
        {plan && step === 1 && (
          <p className="mb-5 chip !border-volt/40 !text-volt">Wybrany pakiet: {plan.name} — aktywacja po zalogowaniu w panelu</p>
        )}

        {error && (
          <p className="mb-5 text-[13px] text-crit hairline !border-crit/40 rounded-lg px-4 py-3 bg-crit/5" role="alert">{error}</p>
        )}

        {/* KROK 1: konto */}
        {step === 1 && (
          <form onSubmit={submitAccount} className="space-y-5">
            <header>
              <h1 className="font-display font-bold text-[22px]">Utwórz konto</h1>
              <p className="text-[13px] text-dim mt-1.5">Jeden pełny raport gratis — bez karty płatniczej. W kolejnych krokach potwierdzisz e-mail i telefon.</p>
            </header>
            <div className="field">
              <label htmlFor="email">Adres e-mail</label>
              <input id="email" type="email" required autoComplete="email" className="input" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} placeholder="jan@firma.pl" />
            </div>
            <div className="field">
              <label htmlFor="password">Hasło (min. 8 znaków)</label>
              <input id="password" type="password" required minLength={8} autoComplete="new-password" className="input" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} placeholder="••••••••" />
            </div>
            <div className="field">
              <label htmlFor="phone">Telefon (weryfikacja SMS)</label>
              <input id="phone" type="tel" required autoComplete="tel" className="input" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} placeholder="+48 600 000 000" />
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-40">
              {busy ? <LoaderCircle size={16} className="anim-spin-slow" aria-hidden /> : <ArrowRight size={16} aria-hidden />}
              {busy ? "Tworzenie konta…" : "Dalej — wyślij kody weryfikacyjne"}
            </button>
            <p className="text-[11.5px] text-faint leading-relaxed text-center">
              Rejestrując się akceptujesz regulamin i politykę prywatności (RODO). Dane służą wyłącznie do świadczenia usługi.
            </p>
          </form>
        )}

        {/* KROK 2/3: kody */}
        {(step === 2 || step === 3) && (
          <form
            onSubmit={(e) => { e.preventDefault(); submitCode(step === 2 ? "email" : "sms"); }}
            className="space-y-5"
          >
            <header className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-xl border border-volt/40 bg-volt/10 text-volt shrink-0">
                {step === 2 ? <Mail size={17} aria-hidden /> : <Phone size={17} aria-hidden />}
              </span>
              <div>
                <h1 className="font-display font-bold text-[20px]">{step === 2 ? "Potwierdź e-mail" : "Potwierdź numer telefonu"}</h1>
                <p className="text-[13px] text-dim mt-1">
                  {step === 2 ? `Wysłaliśmy 6-cyfrowy kod na ${account.email}.` : `Wysłaliśmy kod SMS na ${account.phone}.`}
                </p>
                {devCodes && (
                  <p className="mt-2 font-mono text-[11px] text-amp" data-testid={step === 2 ? "dev-code-email" : "dev-code-sms"}>
                    Tryb DEV (brak bramki {step === 2 ? "SMTP" : "SMS"}): kod = {step === 2 ? devCodes.email : devCodes.sms}
                  </p>
                )}
              </div>
            </header>
            <div className="field">
              <label htmlFor="code">Kod weryfikacyjny</label>
              <input
                id="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code"
                className="input num-mono text-center !text-[22px] tracking-[0.5em]"
                value={step === 2 ? emailCode : smsCode}
                onChange={(e) => (step === 2 ? setEmailCode(e.target.value) : setSmsCode(e.target.value))}
                placeholder="______"
              />
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-40">
              {busy ? "Weryfikacja…" : "Potwierdź i kontynuuj"}
            </button>
            <p className="text-[11.5px] text-faint text-center">Kod ważny 15 minut. To zabezpieczenie przed nadużyciami darmowego raportu.</p>
          </form>
        )}

        {/* KROK 4: profil */}
        {step === 4 && (
          <form onSubmit={submitProfile} className="space-y-5">
            <header className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-xl border border-volt/40 bg-volt/10 text-volt shrink-0"><IdCard size={17} aria-hidden /></span>
              <div>
                <h1 className="font-display font-bold text-[20px]">Profil instalatora</h1>
                <p className="text-[13px] text-dim mt-1">Dane trafią automatycznie do nagłówka i podpisu każdego Twojego raportu.</p>
              </div>
            </header>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="field"><label htmlFor="fn">Imię</label><input id="fn" required className="input" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} /></div>
              <div className="field"><label htmlFor="ln">Nazwisko</label><input id="ln" required className="input" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} /></div>
              <div className="field"><label htmlFor="cn">Nazwa firmy</label><input id="cn" className="input" value={profile.companyName} onChange={(e) => setProfile({ ...profile, companyName: e.target.value })} /></div>
              <div className="field"><label htmlFor="nip">NIP</label><input id="nip" className="input num-mono" placeholder="10 cyfr" value={profile.nip} onChange={(e) => setProfile({ ...profile, nip: e.target.value })} /></div>
              <div className="field sm:col-span-2"><label htmlFor="adr">Adres</label><input id="adr" className="input" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></div>
              <div className="field"><label htmlFor="cert">Nr świadectwa kwalifikacyjnego</label><input id="cert" className="input num-mono" placeholder="np. E/12/345678/2024" value={profile.certificateNo} onChange={(e) => setProfile({ ...profile, certificateNo: e.target.value })} /></div>
              <div className="field">
                <label htmlFor="scope">Zakres kwalifikacji</label>
                <select id="scope" className="input" value={profile.qualificationScope} onChange={(e) => setProfile({ ...profile, qualificationScope: e.target.value })}>
                  <option>E do 1 kV</option>
                  <option>E+D do 1 kV</option>
                  <option>E+D powyżej 1 kV</option>
                  <option>E — pomiary i kontrola (PN-HD 60364-6)</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Logo firmy (opcjonalnie)</label>
              <LogoUpload compact />
              <p className="text-[11.5px] text-faint">Pojawi się w nagłówku Twoich raportów i na stronie tytułowej PDF.</p>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-40">
              {busy ? "Zapisywanie…" : "Zapisz profil i aktywuj raport gratis"}
            </button>
          </form>
        )}

        {/* KROK 5: start */}
        {step === 5 && (
          <div className="text-center py-4">
            <span className="mx-auto grid place-items-center w-16 h-16 rounded-2xl bg-ok/15 border border-ok/40 text-ok">
              <CircleCheck size={28} aria-hidden />
            </span>
            <h1 className="font-display font-bold text-[22px] mt-6">Konto gotowe. Raport czeka.</h1>
            <p className="text-[13.5px] text-dim mt-2 max-w-sm mx-auto leading-relaxed">
              Konto zweryfikowane (e-mail + telefon), profil zapisany. Masz do wykorzystania <strong className="text-mist">jeden pełny raport gratis</strong>.
            </p>
            <div className="mt-8 grid gap-3">
              <Link href="/panel/nowy-raport" className="btn btn-primary w-full">
                Wygeneruj pierwszy raport gratis <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/panel" className="btn btn-ghost btn-sm w-full">Przejdź do panelu</Link>
            </div>
          </div>
        )}
      </div>

      {step < 4 && (
        <p className="text-center mt-5 text-[12.5px] text-dim">
          Masz już konto? <Link href="/logowanie" className="text-volt hover:underline underline-offset-4">Zaloguj się</Link>
        </p>
      )}
      {step > 1 && step < 5 && (
        <button type="button" onClick={() => setStep((s) => (s - 1) as Step)} className="mx-auto mt-4 flex items-center gap-1.5 text-[12px] text-faint hover:text-dim">
          <ArrowLeft size={13} aria-hidden /> Wstecz
        </button>
      )}
      {step === 1 && (
        <p className="text-center mt-6 text-[11px] text-faint flex items-center justify-center gap-1.5">
          <ShieldCheck size={12} aria-hidden /> Bezpieczne sesje · HTTPS · kontrola uprawnień po stronie serwera
        </p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-ink bg-noise relative">
        <div className="absolute inset-0 bg-blueprint pointer-events-none" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5 pt-36 pb-24 flex justify-center">
          <Suspense fallback={<div className="card p-9 max-w-xl w-full text-center text-dim">Ładowanie formularza…</div>}>
            <RegisterWizard />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
