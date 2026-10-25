"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2, LoaderCircle } from "lucide-react";
import Link from "next/link";

export function ReportActions({ reportId, status, number }: { reportId: string; status: string; number: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!window.confirm(`Usunąć szkic raportu ${number}? Tej operacji nie można cofnąć.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Nie udało się usunąć raportu.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Błąd połączenia z serwerem.");
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Link
        href={`/panel/raporty/${reportId}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-volt hover:text-mist transition-colors"
      >
        <Eye size={14} aria-hidden /> Otwórz
      </Link>
      {status !== "ZATWIERDZONY" && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[12px] text-faint hover:text-crit transition-colors disabled:opacity-40"
          title="Usuń szkic"
        >
          {busy ? <LoaderCircle size={13} className="anim-spin-slow" aria-hidden /> : <Trash2 size={13} aria-hidden />}
          Usuń
        </button>
      )}
      {error && <span className="text-[11px] text-crit">{error}</span>}
    </span>
  );
}
