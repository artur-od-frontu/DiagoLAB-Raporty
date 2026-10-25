"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="text-center max-w-md">
        <p className="font-mono text-[48px] font-bold text-crit/30 leading-none">Błąd</p>
        <h1 className="font-display font-bold text-[22px] text-brand mt-4">Coś poszło nie tak</h1>
        <p className="text-dim mt-3 leading-relaxed">
          Wystąpił nieoczekiwany błąd. Jeśli problem się powtarza, skontaktuj się z nami:
          wsparcie@diagolab.pl
        </p>
        {error.digest && (
          <p className="font-mono text-[11px] text-faint mt-2">ref: {error.digest}</p>
        )}
        <div className="flex flex-wrap gap-3 justify-center mt-8">
          <button onClick={reset} className="btn btn-primary btn-sm">Spróbuj ponownie</button>
          <Link href="/" className="btn btn-ghost btn-sm">Strona główna</Link>
        </div>
      </div>
    </main>
  );
}
