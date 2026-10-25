import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { buildReportPayload } from "@/lib/report-payload";
import { shareUrl } from "@/lib/share";
import { BRAND } from "@/config/brand";
import { ReportView } from "@/components/report-view";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/raporty");

  const { id } = await params;
  const built = await buildReportPayload(user.id, id);
  if (!built) notFound();

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/panel/raporty" className="inline-flex items-center gap-2 text-[13px] text-dim hover:text-mist transition-colors">
          <ArrowLeft size={15} aria-hidden /> Moje raporty
        </Link>
        <span className={`badge ${built.status === "ZATWIERDZONY" ? "st-ok" : "st-warn"}`}>
          {built.status === "ZATWIERDZONY" ? "Raport zatwierdzony" : "Szkic — wymaga zatwierdzenia"}
        </span>
      </div>
      <ReportView
        payload={built.payload}
        qrDataUrl={null}
        persistence={built.persistence}
        shareUrl={shareUrl(BRAND.appUrl, id)}
      />
    </div>
  );
}
