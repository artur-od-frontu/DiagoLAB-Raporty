import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, ArrowLeft } from "lucide-react";
import { verifyShareToken } from "@/lib/share";
import { buildPublicReportPayload } from "@/lib/report-payload";
import { ReportView } from "@/components/report-view";
import { Logo } from "@/components/chrome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Raport współdzielony (podgląd)",
  robots: { index: false },
};

/**
 * Publiczny, tokenizowany podgląd raportu (link z QR w PDF).
 * Tylko do odczytu: bez decyzji, bez zatwierdzania, bez zapisu.
 */
export default async function SharedReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  if (!verifyShareToken(id, t ?? null)) notFound();
  const built = await buildPublicReportPayload(id);
  if (!built) notFound();

  return (
    <main className="min-h-screen bg-ink bg-noise">
      <div className="sticky top-0 z-40 glass hairline-b no-print">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-[13px] text-dim hover:text-mist transition-colors">
            <ArrowLeft size={15} aria-hidden /> DiagoLAB Raporty+
          </Link>
          <Logo compact />
          <span className="badge st-info inline-flex items-center gap-1.5">
            <Lock size={11} aria-hidden /> podgląd współdzielony — tylko do odczytu
          </span>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 py-8">
        <ReportView payload={built.payload} qrDataUrl={null} readOnly />
      </div>
    </main>
  );
}
