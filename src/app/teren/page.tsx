import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/chrome";
import { FieldWorkbook } from "@/components/field-workbook";

export const metadata: Metadata = {
  title: "Tryb terenowy — notatnik pomiarowy offline",
  description:
    "Notatnik pomiarowy offline: zapisuj punkty pomiarowe bez internetu, dane trzymane są jako JSON w przeglądarce, a po powrocie online wyślesz je do chmury DiagoLAB.",
  robots: { index: false },
};

export default function FieldPage() {
  return (
    <main className="min-h-screen bg-ink bg-noise">
      <div className="sticky top-0 z-40 glass hairline-b">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between gap-4">
          <Link href="/panel" className="inline-flex items-center gap-2 text-[13px] text-dim hover:text-mist transition-colors">
            <ArrowLeft size={15} aria-hidden /> Panel
          </Link>
          <Logo compact />
          <span className="badge st-info">Tryb offline · JSON</span>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 py-8">
        <header className="mb-7">
          <p className="kicker">DiagoLAB w terenie</p>
          <h1 className="display-1 text-[clamp(24px,3vw,34px)] mt-2">Notatnik pomiarowy offline</h1>
          <p className="text-[14px] text-dim mt-2 max-w-2xl leading-relaxed">
            Zapisuj punkty pomiarowe na hali, bez zasięgu. Analiza liczona lokalnie tym samym silnikiem kryteriów
            co chmura. Po powrocie online: jeden przycisk i dane trafiają do raportu w chmurze.
          </p>
        </header>
        <FieldWorkbook />
      </div>
    </main>
  );
}
