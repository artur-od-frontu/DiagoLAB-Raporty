import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { FolderOpen, FilePlus2, Printer } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import { reports, type StoredReportData } from "@/db/schema";
import { ReportActions } from "@/components/report-actions";

export const dynamic = "force-dynamic";

export default async function MyReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/raporty");

  const rows = await db
    .select({
      id: reports.id,
      number: reports.number,
      status: reports.status,
      createdAt: reports.createdAt,
      approvedAt: reports.approvedAt,
      sourceFileName: reports.sourceFileName,
      sourceRows: reports.sourceRows,
      sourceSha256: reports.sourceSha256,
      data: reports.data,
    })
    .from(reports)
    .where(eq(reports.userId, user.id))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="kicker">Archiwum</p>
          <h1 className="display-1 text-[clamp(24px,3vw,32px)] mt-2">Moje raporty</h1>
          <p className="text-[13.5px] text-dim mt-1">Wszystkie raporty konta z integralnością źródeł danych.</p>
        </div>
        <Link href="/panel/nowy-raport" className="btn btn-primary btn-sm">
          <FilePlus2 size={15} aria-hidden /> + Nowy raport
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen size={28} className="mx-auto text-faint" aria-hidden />
          <p className="mt-4 text-[14px] text-dim">Brak raportów na koncie.</p>
          <Link href="/panel/nowy-raport" className="btn btn-ghost btn-sm mt-5">Wygeneruj pierwszy raport</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="rpt-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Numer</th>
                  <th>Obiekt</th>
                  <th>Status</th>
                  <th>Punkty</th>
                  <th>SHA-256</th>
                  <th>Utworzono</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/panel/raporty/${r.id}`} className="num-mono text-volt hover:text-mist transition-colors">
                        {r.number}
                      </Link>
                    </td>
                    <td className="text-[12.5px]">{String((r.data as StoredReportData | null)?.meta?.object ?? (r.data as StoredReportData | null)?.meta?.objectName ?? "—")}</td>
                    <td>
                      <span className={`badge ${r.status === "ZATWIERDZONY" ? "st-ok" : r.status === "DO_ZATWIERDZENIA" ? "st-warn" : "st-miss"}`}>
                        {r.status === "ZATWIERDZONY" ? "Zatwierdzony" : r.status === "DO_ZATWIERDZENIA" ? "Do zatwierdzenia" : "Szkic"}
                      </span>
                    </td>
                    <td className="num-mono">{r.sourceRows ?? "—"}</td>
                    <td className="num-mono text-[11px] text-faint">{r.sourceSha256 ? `${r.sourceSha256.slice(0, 10)}…` : "—"}</td>
                    <td className="num-mono text-[12px] text-dim">{new Date(r.createdAt).toLocaleString("pl-PL")}</td>
                    <td className="no-print">
                      <ReportActions reportId={r.id} status={r.status} number={r.number} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="flex items-center gap-2 text-[12px] text-faint">
        <Printer size={13} aria-hidden /> Podgląd i wydruk PDF raportu: otwórz raport → „Drukuj / PDF” (strona raportu, działa na żywo w wersji DEMO: <Link href="/demo" className="text-volt underline underline-offset-4">/demo</Link>).
      </p>
    </div>
  );
}
