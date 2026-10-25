import Link from "next/link";
import { eq, desc, count } from "drizzle-orm";
import { FilePlus2, FolderOpen, Gauge, TriangleAlert, ClipboardCheck, CalendarClock, Building2, ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import { reports, objects, subscriptions, users } from "@/db/schema";
import type { StoredReportData } from "@/db/schema";
import { CountUp } from "@/components/motion";

export const dynamic = "force-dynamic";

interface DashData {
  reportsTotal: number;
  limitLabel: string;
  critical: number;
  pendingApproval: number;
  recent: { id: string; number: string; status: string; createdAt: Date; sourceRows: number | null; object: string }[];
  objectsList: { name: string; address: string | null; nextInspection: string | null }[];
}

export default async function PanelDashboard() {
  const user = await getSessionUser();
  const data = user ? await loadReal(user.id) : demoData();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="kicker">Panel instalatora</p>
          <h1 className="display-1 text-[clamp(24px,3vw,34px)] mt-2">Dzień dobry{user ? "" : " — tryb DEMO"}</h1>
          <p className="text-[13.5px] text-dim mt-1">Przegląd raportów, limitów i nadchodzących badań.</p>
        </div>
        <Link href="/panel/nowy-raport" className="btn btn-primary">
          <FilePlus2 size={17} aria-hidden /> + Nowy raport
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <Stat icon={FolderOpen} label="Raporty" value={data.reportsTotal} tone="#45e0ff" />
        <Stat icon={Gauge} label="Dostępny limit" custom={data.limitLabel} tone="#49dd8a" />
        <Stat icon={TriangleAlert} label="Nieprawidłowości (30 dni)" value={data.critical} tone="#ff6473" />
        <Stat icon={ClipboardCheck} label="Do zatwierdzenia" value={data.pendingApproval} tone="#ffb224" />
        <Stat icon={Building2} label="Aktywne obiekty" value={data.objectsList.length} tone="#8fa8ff" />
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* Ostatnie raporty */}
        <section className="card !rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 hairline-b">
            <h2 className="font-display font-semibold text-[15px]">Ostatnie raporty</h2>
            <Link href="/panel/raporty" className="text-[12.5px] text-volt hover:underline underline-offset-4 inline-flex items-center gap-1">
              wszystkie <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
          <div className="divide-y divide-line">
            {data.recent.length === 0 && (
              <p className="px-6 py-10 text-center text-[13px] text-faint">
                Brak raportów. <Link href="/panel/nowy-raport" className="text-volt underline underline-offset-4">Wygeneruj pierwszy raport</Link>.
              </p>
            )}
            {data.recent.map((r) => (
              <Link key={r.id} href={`/panel/raporty/${r.id}`} className="px-6 py-4 flex items-center gap-4 hover:bg-panel2/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[12.5px] text-volt">{r.number}</p>
                  <p className="text-[12px] text-faint mt-0.5 truncate">{r.object} · {r.sourceRows ?? "—"} pkt.</p>
                </div>
                <span className={`badge ${r.status === "ZATWIERDZONY" ? "st-ok" : "st-warn"}`}>
                  {r.status === "ZATWIERDZONY" ? "Zatwierdzony" : "Do zatwierdzenia"}
                </span>
                <span className="hidden sm:block font-mono text-[11px] text-faint">{new Date(r.createdAt).toLocaleDateString("pl-PL")}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Terminy badań */}
        <section className="card !rounded-2xl overflow-hidden">
          <div className="px-6 py-4 hairline-b flex items-center gap-2">
            <CalendarClock size={16} className="text-amp" aria-hidden />
            <h2 className="font-display font-semibold text-[15px]">Terminy kolejnych badań</h2>
          </div>
          <ul className="divide-y divide-line">
            {data.objectsList.map((o) => (
              <li key={o.name} className="px-6 py-4">
                <p className="text-[13.5px] text-mist">{o.name}</p>
                <p className="text-[12px] text-faint mt-0.5">{o.address ?? "—"}</p>
                <p className="font-mono text-[11.5px] text-amp mt-1.5">
                  {o.nextInspection ? `kolejne badanie: ${new Date(o.nextInspection).toLocaleDateString("pl-PL")}` : "termin nieustalony"}
                </p>
              </li>
            ))}
            {data.objectsList.length === 0 && <li className="px-6 py-8 text-[13px] text-faint">Brak obiektów — zostaną utworzone przy pierwszym raporcie.</li>}
          </ul>
        </section>
      </div>

      {!user && (
        <p className="text-[12px] text-faint font-mono">
          Dane demonstracyjne oznaczone etykietą DEMO. Po zalogowaniu dashboard pokazuje Twoje rzeczywiste raporty i limity.
        </p>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, custom, tone }: { icon: typeof FolderOpen; label: string; value?: number; custom?: string; tone: string }) {
  return (
    <div className="rpt-kpi card-hover">
      <div className="flex items-center justify-between">
        <Icon size={16} style={{ color: tone }} aria-hidden />
      </div>
      <div className="num mt-3" style={{ color: tone }}>
        {custom ? <span className="num-mono">{custom}</span> : <CountUp value={value ?? 0} />}
      </div>
      <div className="lbl font-mono text-[10px] tracking-[0.16em] uppercase text-dim mt-2">{label}</div>
    </div>
  );
}

/* ------------------- Dane ------------------- */

async function loadReal(userId: string): Promise<DashData> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [rowCount] = await db.select({ n: count() }).from(reports).where(eq(reports.userId, userId));
  const recent = await db
    .select({ id: reports.id, number: reports.number, status: reports.status, createdAt: reports.createdAt, sourceRows: reports.sourceRows, data: reports.data })
    .from(reports)
    .where(eq(reports.userId, userId))
    .orderBy(desc(reports.createdAt))
    .limit(6);

  const last30 = await db
    .select({ data: reports.data, status: reports.status })
    .from(reports)
    .where(eq(reports.userId, userId))
    .orderBy(desc(reports.createdAt))
    .limit(50);

  let critical = 0;
  let pendingApproval = 0;
  for (const r of last30) {
    const summary = (r.data as StoredReportData | null)?.analysis as { summary?: { critical?: number } } | undefined;
    critical += summary?.summary?.critical ?? 0;
    if (r.status === "DO_ZATWIERDZENIA" || r.status === "SZKIC") pendingApproval++;
  }

  const objs = await db.select().from(objects).where(eq(objects.userId, userId)).orderBy(desc(objects.createdAt)).limit(5);
  const [u] = await db.select({ status: users.status, freeReportUsedAt: users.freeReportUsedAt }).from(users).where(eq(users.id, userId)).limit(1);
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.startedAt)).limit(1);

  let limitLabel = "—";
  if (u?.status === "DEMO") limitLabel = u.freeReportUsedAt ? "0 / 1" : "1 gratis";
  else if (u?.status === "AKTYWNE" && sub) limitLabel = sub.reportsLimit === null ? "∞" : `${sub.reportsLimit - sub.reportsUsed} / ${sub.reportsLimit}`;

  return {
    reportsTotal: rowCount?.n ?? 0,
    limitLabel,
    critical,
    pendingApproval,
    recent: recent.map((r) => ({
      ...r,
      object: String((r.data as StoredReportData | null)?.meta?.objectName ?? "Obiekt nieprzypisany"),
    })),
    objectsList: objs.map((o) => ({ name: o.name, address: o.address, nextInspection: o.nextInspectionAt })),
  };
}

function demoData(): DashData {
  return {
    reportsTotal: 14,
    limitLabel: "1 gratis",
    critical: 3,
    pendingApproval: 2,
    recent: [
      { id: "d1", number: "DLR/2026/0114", status: "ZATWIERDZONY", createdAt: new Date("2026-01-14"), sourceRows: 12, object: "Hala produkcyjna, Gliwice (DEMO)" },
      { id: "d2", number: "DLR/2026/0112", status: "DO_ZATWIERDZENIA", createdAt: new Date("2026-01-12"), sourceRows: 24, object: "Biurowiec Orion, Katowice (DEMO)" },
      { id: "d3", number: "DLR/2026/0108", status: "SZKIC", createdAt: new Date("2026-01-08"), sourceRows: 8, object: "Sklep spożywczy, Zabrze (DEMO)" },
      { id: "d4", number: "DLR/2025/1288", status: "ZATWIERDZONY", createdAt: new Date("2025-12-18"), sourceRows: 31, object: "Szkoła podstawowa, Tychy (DEMO)" },
    ],
    objectsList: [
      { name: "Hala produkcyjna, Gliwice (DEMO)", address: "ul. Przemysłowa 12", nextInspection: "2027-01-14" },
      { name: "Biurowiec Orion, Katowice (DEMO)", address: "ul. Koronna 4", nextInspection: "2026-07-01" },
      { name: "Sklep spożywczy, Zabrze (DEMO)", address: "ul. Wolności 88", nextInspection: "2026-04-10" },
    ],
  };
}
