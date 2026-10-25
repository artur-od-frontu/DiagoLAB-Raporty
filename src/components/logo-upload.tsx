"use client";

/**
 * Upload logo firmy — używany w kreatorze rejestracji (krok „Profil")
 * oraz na stronie Profil instalatora. Logo trafia do nagłówka raportu
 * interaktywnego i na stronę tytułową PDF.
 */

import { useRef, useState } from "react";
import { ImagePlus, Trash2, CircleCheck, TriangleAlert, LoaderCircle } from "lucide-react";

export function LogoUpload({
  initialLogo = null,
  compact = false,
}: {
  initialLogo?: string | null;
  compact?: boolean;
}) {
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/profile/logo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Nie udało się wgrać logo." });
        return;
      }
      setLogo(data.logoDataUrl);
      setMsg({ ok: true, text: `Logo zapisane w profilu (${Math.round((data.bytes ?? 0) / 1024)} KB) — pojawi się w raportach.` });
    } catch {
      setMsg({ ok: false, text: "Błąd połączenia z serwerem." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile/logo", { method: "DELETE" });
      if (res.ok) {
        setLogo(null);
        setMsg({ ok: true, text: "Logo usunięte z profilu." });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="logo-upload">
      <div
        role="button"
        tabIndex={0}
        aria-label="Wgraj logo firmy"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
        className={`hairline !border-dashed rounded-xl text-center cursor-pointer transition-colors ${
          dragOver ? "!border-volt bg-volt/8" : "bg-abyss/50 hover:!border-volt/60"
        } ${compact ? "p-4" : "p-5"}`}
      >
        {logo ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="Logo firmy — podgląd" className="h-14 w-auto max-w-[160px] object-contain bg-white/90 rounded-lg p-1.5" />
            <div className="text-left flex-1 min-w-0">
              <p className="text-[13px] text-mist font-semibold">Logo firmy</p>
              <p className="text-[11.5px] text-faint">Kliknij, aby podmienić plik</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void remove(); }}
              disabled={busy}
              className="p-2 text-faint hover:text-crit transition-colors disabled:opacity-40"
              aria-label="Usuń logo"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : (
          <>
            <span className="mx-auto grid place-items-center w-10 h-10 rounded-xl border border-volt/40 bg-volt/10 text-volt">
              {busy ? <LoaderCircle size={17} className="anim-spin-slow" aria-hidden /> : <ImagePlus size={17} aria-hidden />}
            </span>
            <p className="text-[13px] text-mist mt-3">{busy ? "Wgrywanie…" : "Wgraj logo swojej firmy"}</p>
            <p className="text-[11px] text-faint mt-1">PNG · JPEG · WEBP · SVG · maks. 512 KB</p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />

      {msg && (
        <p className={`mt-2.5 text-[12px] flex items-center gap-1.5 ${msg.ok ? "text-ok" : "text-amp"}`} role="status">
          {msg.ok ? <CircleCheck size={13} aria-hidden /> : <TriangleAlert size={13} aria-hidden />} {msg.text}
        </p>
      )}
    </div>
  );
}
