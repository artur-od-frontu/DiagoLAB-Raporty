import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { analyzePoints } from "@/lib/engine";
import { DEMO_META, DEMO_POINTS, DEMO_HISTORY, DEMO_DISCLAIMER } from "@/lib/demo-data";
import { BRAND } from "@/config/brand";
import { ReportLoader, type ReportPayload } from "@/components/report-view";
import { Logo } from "@/components/chrome";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Przykładowy raport interaktywny (DEMO)",
  description:
    "Zobacz, jak DiagoLAB Raporty+ zamienia wyniki pomiarów w inteligentny raport: wykresy, analizę, ostrzeżenia, Smart Compare+ i zatwierdzanie.",
};

export default async function DemoPage() {
  const sessionUser = await getSessionUser();
  const analysis = analyzePoints(DEMO_POINTS);
  const payload: ReportPayload = {
    meta: DEMO_META,
    points: DEMO_POINTS,
    analysis,
    history: DEMO_HISTORY,
    isDemo: true,
  };

  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(`${BRAND.appUrl}/demo`, {
      width: 264,
      margin: 1,
      color: { dark: "#06222e", light: "#9ff0ff" },
    });
  } catch {
    qrDataUrl = null;
  }

  return (
    <main className="min-h-screen bg-ink bg-noise">
      <div className="absolute inset-x-0 top-0 h-[480px] bg-blueprint pointer-events-none" aria-hidden />

      {/* Pasek narzędzi DEMO */}
      <div className="sticky top-0 z-40 glass hairline-b no-print">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-[13px] text-dim hover:text-mist transition-colors">
            <ArrowLeft size={15} aria-hidden /> Strona główna
          </Link>
          <Logo compact />
          <Link href="/rejestracja" className="btn btn-primary btn-sm">
            Wygeneruj swój raport gratis
          </Link>
        </div>
      </div>

      {/* Jasne oznaczenie danych demonstracyjnych */}
      <div className="no-print mx-auto max-w-6xl px-5 mt-8">
        <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-amp hairline rounded-xl px-4 py-3 bg-amp/5">
          <TriangleAlert size={15} className="shrink-0 mt-0.5" aria-hidden />
          {DEMO_DISCLAIMER}
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 relative">
        <ReportLoader demoPayload={payload} qrDataUrl={qrDataUrl} sessionActive={Boolean(sessionUser)} />
      </div>
    </main>
  );
}
