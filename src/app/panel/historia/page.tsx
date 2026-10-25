import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import { objects, measurementHistory, reports } from "@/db/schema";

export const dynamic = "force-dynamic";

const METRIC_LABEL: Record<string, string> = {
  ZS: "Impedancja Zs [Ω]",
  RISO: "Rezystancja izolacji [MΩ]",
  CONTINUITY: "Ciągłość PE [Ω]",
  RCD_TIME: "Czas zadziałania RCD [ms]",
  RCD_CURRENT: "Prąd wyzwalania RCD [mA]",
};

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/historia");

  const objs = await db.select().from(objects).where(eq(objects.userId, user.id)).limit(100);
  const objMap = new Map(objs.map((o) => [o.id, o]));
  const reps = await db
    .select({ id: reports.id, number: reports.number })
    .from(reports)
    .where(eq(reports.userId, user.id))
    .limit(300);
  const repNumber = new Map(reps.map((r) => [r.id, r.number]));

  const rows = objs.length
    ? await db
        .select()
        .from(measurementHistory)
        .where(inArray(measurementHistory.objectId, objs.map((o) => o.id)))
        .orderBy(asc(measurementHistory.measuredAt))
        .limit(20000)
    : [];

  // Grupowanie: obiekt → punkt → metryka → serie [{date, value, reportId}]
  type Series = { date: string; value: number | null; reportId: string | null }[];
  const grouped = new Map<string, Map<string, Map<string, Series>>>();
  for (const r of rows) {
    const d = String(r.measuredAt).slice(0, 10);
    const byPoint = grouped.get(r.objectId) ?? new Map();
    const byMetric = byPoint.get(r.pointKey) ?? new Map();
    const series = byMetric.get(r.metric) ?? [];
    series.push({ date: d, value: r.value ?? null, reportId: r.reportId });
    byMetric.set(r.metric, series);
    byPoint.set(r.pointKey, byMetric);
    grouped.set(r.objectId, byPoint);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <p className="kicker">Smart Compare+</p>
        <h1 className="display-1 text-[clamp(24px,3vw,32px)] mt-2">Historia pomiarów</h1>
        <p className="text-[13.5px] text-dim mt-1">
          Serie pomiarowe zapisywane przy zatwierdzaniu raportów — podstawa porównań i prognoz w raporcie obiektu.
        </p>
      </div>

      {grouped.size === 0 ? (
        <div className="card p-12 text-center">
          <History size={28} className="mx-auto text-faint" aria-hidden />
          <p className="mt-4 text-[14px] text-dim">Brak historii. Pojawi się po zatwierdzeniu pierwszego raportu obiektu.</p>
          <Link href="/panel/nowy-raport" className="btn btn-primary btn-sm mt-5">+ Nowy raport</Link>
        </div>
      ) : (
        [...grouped.entries()].map(([objectId, byPoint]) => {
          const obj = objMap.get(objectId);
          return (
            <section key={objectId} className="card overflow-hidden">
              <div className="px-6 py-4 hairline-b flex flex-wrap items-center gap-3">
                <h2 className="font-display font-semibold text-[15px]">{obj?.name ?? "Obiekt"}</h2>
                <span className="text-[12px] text-faint">{obj?.address ?? ""}</span>
                <span className="badge st-info ml-auto">{byPoint.size} punktów</span>
              </div>
              <div className="overflow-x-auto">
                <table className="rpt-table min-w-[860px]">
                  <thead>
                    <tr>
                      <th>Punkt</th>
                      <th>Pomiar</th>
                      <th>Serie (data → wynik)</th>
                      <th>Zmiana od pierwszego</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...byPoint.entries()].flatMap(([pointKey, byMetric]) =>
                      [...byMetric.entries()].map(([metric, series]) => {
                        const valid = series.filter((s) => s.value !== null);
                        const first = valid[0]?.value ?? null;
                        const last = valid[valid.length - 1]?.value ?? null;
                        const delta = first !== null && last !== null && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
                        const Icon = delta === null ? Minus : Math.abs(delta) < 5 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
                        const tone = delta === null || Math.abs(delta) < 5 ? "#5c6d89" : metric === "ZS" || metric === "CONTINUITY"
                          ? delta > 0 ? "#ffb224" : "#49dd8a"
                          : delta < 0 ? "#ffb224" : "#49dd8a";
                        return (
                          <tr key={`${pointKey}-${metric}`}>
                            <td className="num-mono text-volt">{pointKey}</td>
                            <td className="text-[12.5px]">{METRIC_LABEL[metric] ?? metric}</td>
                            <td className="num-mono text-[12px] text-dim">
                              {series.map((s, i) => {
                                const repNo = s.reportId ? repNumber.get(s.reportId) : null;
                                return (
                                  <span key={i} className="inline-block mr-3 mb-1" title={repNo ?? undefined}>
                                    <span className="text-faint">{s.date.slice(2)}:</span>{" "}
                                    <span className="text-mist">{s.value ?? "—"}</span>
                                  </span>
                                );
                              })}
                            </td>
                            <td className="num-mono text-[12.5px]" style={{ color: tone }}>
                              <span className="inline-flex items-center gap-1.5">
                                <Icon size={13} aria-hidden />
                                {delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%` : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
      <p className="text-[12px] text-faint">
        Porównywanie serii ma sens tylko przy zachowaniu tych samych metod i warunków pomiaru — raport obiektu (Smart Compare+) uwzględnia to automatycznie.
      </p>
    </div>
  );
}
