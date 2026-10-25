/**
 * Budowa pełnego modelu raportu z bazy danych (serwer-only).
 * Ten sam model zasila: stronę HTML raportu, publiczny podgląd
 * (link z tokenem) oraz generator PDF (ten sam szablon danych).
 */

import { asc, and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  reports,
  findingDecisions,
  measurementHistory,
  installerProfiles,
  type StoredReportData,
} from "@/db/schema";
import { analyzePoints, type HistorySample, type RawPoint } from "@/lib/engine";
import type { ReportMeta, ReportPayload, ReportPersistence } from "@/components/report-view";

export interface BuiltReport {
  payload: ReportPayload;
  persistence: ReportPersistence;
  status: string;
  objectId: string | null;
  userId: string;
}

type ReportRow = typeof reports.$inferSelect;

async function buildFromRow(rep: ReportRow): Promise<BuiltReport> {
  const stored = (rep.data ?? { meta: {}, points: [], analysis: null }) as StoredReportData;
  const points = ((stored.points ?? []) as RawPoint[]).filter(Boolean);
  // Deterministyczna ocena — przeliczamy bieżącym silnikiem (ten sam model co w HTML/PDF).
  const analysis = analyzePoints(points);

  const [profile] = await db.select().from(installerProfiles).where(eq(installerProfiles.userId, rep.userId)).limit(1);

  const sm = (stored.meta ?? {}) as Partial<ReportMeta>;
  const meta: ReportMeta = {
    reportNumber: rep.number,
    date: sm.date ?? rep.createdAt.toISOString().slice(0, 10),
    object: sm.object ?? "Obiekt nieprzypisany",
    objectAddress: sm.objectAddress ?? "—",
    client: sm.client ?? "—",
    contractor:
      sm.contractor ??
      profile?.companyName ??
      [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ??
      "—",
    installer: sm.installer ?? {
      name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "—",
      company: profile?.companyName ?? "—",
      certificateNo: profile?.certificateNo ?? "—",
      scope: profile?.qualificationScope ?? "—",
    },
    instrument: sm.instrument ?? "—",
    source: {
      fileName: sm.source?.fileName ?? rep.sourceFileName ?? "—",
      importedAt: sm.source?.importedAt ?? rep.createdAt.toISOString(),
    },
    weather: sm.weather ?? "—",
    // Logo pobierane z profilu „na żywo” — zmiana logo odświeża wszystkie raporty
    logoDataUrl: profile?.logoData ?? null,
  };

  // Historia pomiarów Zs obiektu → Smart Compare+
  let history: HistorySample[] | undefined;
  if (rep.objectId) {
    const rows = await db
      .select()
      .from(measurementHistory)
      .where(eq(measurementHistory.objectId, rep.objectId))
      .orderBy(asc(measurementHistory.measuredAt));
    const byDate = new Map<string, Record<string, number | null>>();
    for (const r of rows) {
      if (r.metric !== "ZS") continue;
      const d = String(r.measuredAt).slice(0, 10);
      const entry = byDate.get(d) ?? {};
      entry[r.pointKey] = r.value ?? null;
      byDate.set(d, entry);
    }
    const sorted = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, values }));
    if (sorted.length >= 2) history = sorted;
  }

  // Serwerowe decyzje o ostrzeżeniach
  const decRows = await db.select().from(findingDecisions).where(eq(findingDecisions.reportId, rep.id));
  const initialDecisions: ReportPersistence["initialDecisions"] = {};
  for (const d of decRows) {
    initialDecisions[d.findingKey] = { decision: d.decision, note: d.note ?? undefined };
  }

  const persistence: ReportPersistence = {
    reportId: rep.id,
    initialDecisions,
    initialApproval:
      rep.status === "ZATWIERDZONY"
        ? {
            assessment: rep.assessment ?? "POZYTYWNA",
            approvedAt: (rep.approvedAt ?? rep.createdAt).toISOString(),
          }
        : null,
  };

  return {
    payload: { meta, points, analysis, history, isDemo: false },
    persistence,
    status: rep.status,
    objectId: rep.objectId,
    userId: rep.userId,
  };
}

/** Wersja z kontrolą własności — API i strony panelu. */
export async function buildReportPayload(userId: string, reportId: string): Promise<BuiltReport | null> {
  const [rep] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, reportId), eq(reports.userId, userId)))
    .limit(1);
  if (!rep) return null;
  return buildFromRow(rep);
}

/** Wersja publiczna — wyłącznie dla linków z prawidłowym tokenem udostępnienia. */
export async function buildPublicReportPayload(reportId: string): Promise<BuiltReport | null> {
  const [rep] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!rep) return null;
  return buildFromRow(rep);
}
