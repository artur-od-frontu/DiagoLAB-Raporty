"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, FileDown, Trash2, ShieldCheck, LoaderCircle, CircleCheck } from "lucide-react";

export function SettingsClient({ email, statusLabel }: { email: string; statusLabel: string }) {
  const router = useRouter();

  return (
    <div className="max-w-3xl space-y-6">
      <section className="card p-6">
        <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
          <ShieldCheck size={16} className="text-volt" aria-hidden /> Konto
        </h2>
        <dl className="mt-4 grid sm:grid-cols-2 gap-4">
          <div>
            <dt className="font-mono text-[10px] tracking-[0.18em] uppercase text-faint">Adres e-mail</dt>
            <dd className="text-[14px] text-mist mt-1">{email}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] tracking-[0.18em] uppercase text-faint">Status konta</dt>
            <dd className="text-[14px] text-volt mt-1">{statusLabel}</dd>
          </div>
        </dl>
      </section>

      <PasswordSection />
      <ExportSection />
      <DangerSection email={email} onDeleted={() => (window.location.href = "/")} />
    </div>
  );
}

function PasswordSection() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", repeat: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (form.newPassword !== form.repeat) return setMsg({ ok: false, text: "Nowe hasła nie są identyczne." });
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: "Hasło zostało zmienione." } : { ok: false, text: data.error ?? "Nie udało się zmienić hasła." });
      if (res.ok) setForm({ currentPassword: "", newPassword: "", repeat: "" });
    } catch {
      setMsg({ ok: false, text: "Błąd połączenia z serwerem." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
        <KeyRound size={16} className="text-volt" aria-hidden /> Zmiana hasła
      </h2>
      {msg && (
        <p className={`mt-4 text-[13px] flex items-center gap-2 ${msg.ok ? "text-ok" : "text-crit"}`} role="alert">
          {msg.ok && <CircleCheck size={14} aria-hidden />} {msg.text}
        </p>
      )}
      <form onSubmit={submit} className="grid sm:grid-cols-3 gap-4 mt-5">
        <div className="field"><label htmlFor="cur">Obecne hasło</label><input id="cur" type="password" required autoComplete="current-password" className="input" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></div>
        <div className="field"><label htmlFor="new">Nowe hasło</label><input id="new" type="password" required minLength={8} autoComplete="new-password" className="input" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></div>
        <div className="field"><label htmlFor="rep">Powtórz nowe</label><input id="rep" type="password" required minLength={8} autoComplete="new-password" className="input" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })} /></div>
        <div className="sm:col-span-3">
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm disabled:opacity-40">
            {busy ? <LoaderCircle size={14} className="anim-spin-slow" aria-hidden /> : null} Zmień hasło
          </button>
        </div>
      </form>
    </section>
  );
}

function ExportSection() {
  return (
    <section className="card p-6">
      <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
        <FileDown size={16} className="text-volt" aria-hidden /> Dane osobowe (RODO)
      </h2>
      <p className="text-[13px] text-dim mt-2 leading-relaxed">
        Pobierz komplet swoich danych: konto, profil instalatora, klienci, obiekty, wykaz raportów (z hashami źródeł), transakcje i subskrypcje.
      </p>
      <a href="/api/account/export" className="btn btn-ghost btn-sm mt-5" download>
        <FileDown size={14} aria-hidden /> Pobierz eksport JSON
      </a>
    </section>
  );
}

function DangerSection({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się usunąć konta.");
        setBusy(false);
        return;
      }
      onDeleted();
    } catch {
      setError("Błąd połączenia z serwerem.");
      setBusy(false);
    }
  };

  return (
    <section className="card p-6 !border-crit/35">
      <h2 className="font-display font-semibold text-[15px] flex items-center gap-2 text-crit">
        <Trash2 size={16} aria-hidden /> Strefa ryzyka — usunięcie konta
      </h2>
      <p className="text-[13px] text-dim mt-2 leading-relaxed">
        Usunięcie konta kasuje profil, klientów, obiekty, raporty, wersje robocze i historię pomiarów. Operacji nie można cofnąć.
        Aby potwierdzić, wpisz swój adres e-mail: <span className="text-mist num-mono">{email}</span>
      </p>
      {error && <p className="mt-3 text-[13px] text-crit" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3 mt-5">
        <input
          className="input max-w-xs"
          placeholder="wpisz e-mail, aby potwierdzić"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-label="Potwierdzenie usunięcia konta adresem e-mail"
        />
        <button
          type="button"
          onClick={remove}
          disabled={busy || confirm.trim().toLowerCase() !== email.toLowerCase()}
          className="btn btn-ghost btn-sm !border-crit/50 text-crit hover:!border-crit disabled:opacity-35"
        >
          {busy ? "Usuwanie…" : "Usuń konto bezpowrotnie"}
        </button>
      </div>
    </section>
  );
}
