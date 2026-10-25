import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { Building2, CalendarClock, FileText, Users } from "lucide-react";
import { getSessionUser, audit } from "@/lib/auth";
import { db } from "@/db";
import { objects, reports, clients } from "@/db/schema";

export const dynamic = "force-dynamic";

async function setInspection(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/logowanie");
  const objectId = String(formData.get("objectId") ?? "");
  const date = String(formData.get("nextInspectionAt") ?? "");
  if (!objectId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await db.update(objects).set({ nextInspectionAt: date }).where(eq(objects.id, objectId));
  await audit(user.id, "object.inspection-set", { objectId, date });
  revalidatePath("/panel/obiekty");
  revalidatePath("/panel");
}

export default async function ObjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/obiekty");

  const objs = await db
    .select()
    .from(objects)
    .where(eq(objects.userId, user.id))
    .orderBy(desc(objects.createdAt))
    .limit(100);
  const reps = await db
    .select({ id: reports.id, objectId: reports.objectId, number: reports.number, status: reports.status, createdAt: reports.createdAt, sourceRows: reports.sourceRows })
    .from(reports)
    .where(eq(reports.userId, user.id))
    .orderBy(desc(reports.createdAt))
    .limit(300);
  const clis = await db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.userId, user.id)).limit(300);
  const cliName = new Map(clis.map((c) => [c.id, c.name]));

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <p className="kicker">Obiekty pomiarowe</p>
        <h1 className="display-1 text-[clamp(24px,3vw,32px)] mt-2">Obiekty</h1>
        <p className="text-[13.5px] text-dim mt-1">
          Obiekty tworzą się automatycznie z raportów. Zatwierdzenie raportu ustawia termin kolejnego badania (+12 mies.).
        </p>
      </div>

      {objs.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 size={28} className="mx-auto text-faint" aria-hidden />
          <p className="mt-4 text-[14px] text-dim">Brak obiektów. Wygeneruj pierwszy raport z nazwą obiektu.</p>
          <Link href="/panel/nowy-raport" className="btn btn-primary btn-sm mt-5">+ Nowy raport</Link>
        </div>
      ) : (
        <div className="space-y-5">
          {objs.map((o) => {
            const objReports = reps.filter((r) => r.objectId === o.id);
            const approved = objReports.filter((r) => r.status === "ZATWIERDZONY");
            return (
              <section key={o.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 hairline-b">
                  <div>
                    <div className="flex items-center gap-3">
                      <Building2 size={17} className="text-volt" aria-hidden />
                      <h2 className="font-display font-semibold text-[16px]">{o.name}</h2>
                    </div>
                    <p className="text-[12.5px] text-faint mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      <span>{o.address ?? "adres nieustalony"}</span>
                      {o.clientId && cliName.get(o.clientId) && (
                        <span className="inline-flex items-center gap-1"><Users size={12} aria-hidden /> {cliName.get(o.clientId)}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="num-mono text-[20px] text-mist">{objReports.length}</p>
                      <p className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-faint">raportów</p>
                    </div>
                    <div>
                      <p className="num-mono text-[20px] text-ok">{approved.length}</p>
                      <p className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-faint">zatwierdzonych</p>
                    </div>
                    <form action={setInspection} className="flex items-end gap-2">
                      <input type="hidden" name="objectId" value={o.id} />
                      <div className="field">
                        <label className="flex items-center gap-1"><CalendarClock size={11} aria-hidden /> Kolejne badanie</label>
                        <input type="date" name="nextInspectionAt" defaultValue={o.nextInspectionAt ?? ""} className="input !py-2 !px-3 text-[12.5px] num-mono" />
                      </div>
                      <button type="submit" className="btn btn-ghost btn-sm">Zapisz</button>
                    </form>
                  </div>
                </div>
                {objReports.length > 0 && (
                  <div className="divide-y divide-line">
                    {objReports.slice(0, 5).map((r) => (
                      <Link key={r.id} href={`/panel/raporty/${r.id}`} className="px-6 py-3.5 flex items-center gap-4 hover:bg-panel2/50 transition-colors">
                        <FileText size={14} className="text-volt shrink-0" aria-hidden />
                        <span className="num-mono text-[12.5px] text-volt">{r.number}</span>
                        <span className={`badge ${r.status === "ZATWIERDZONY" ? "st-ok" : "st-warn"} !text-[9px]`}>{r.status === "ZATWIERDZONY" ? "zatwierdzony" : "szkic"}</span>
                        <span className="text-[11.5px] text-faint ml-auto">{r.sourceRows ?? "—"} pkt. · {new Date(r.createdAt).toLocaleDateString("pl-PL")}</span>
                      </Link>
                    ))}
                    {objReports.length > 5 && <p className="px-6 py-3 text-[12px] text-faint">…i {objReports.length - 5} więcej — patrz „Moje raporty”.</p>}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
