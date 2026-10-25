import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { CreditCard, Check, Zap, TriangleAlert } from "lucide-react";
import { getSessionUser, audit } from "@/lib/auth";
import { db } from "@/db";
import { users, subscriptions, transactions } from "@/db/schema";
import { PLANS, formatPlanPrice, pricePerReport, PACKAGE_VALIDITY_MONTHS, ACCOUNT_STATUS_LABEL } from "@/config/brand";

export const dynamic = "force-dynamic";

const DEV_MODE = !process.env.PAYMENTS_PROVIDER_KEY;

async function buyPlan(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/abonament");
  const planId = String(formData.get("planId") ?? "");
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || plan.pricePLN === 0) return;

  // Rejestracja transakcji (ceny wyłącznie z konfiguracji serwera).
  await db.insert(transactions).values({
    userId: user.id,
    planId: plan.id,
    amountGr: plan.pricePLN * 100,
    provider: DEV_MODE ? "dev-simulator" : process.env.PAYMENTS_PROVIDER ?? null,
    status: DEV_MODE ? "OPLACONA" : "NOWA",
  });

  if (DEV_MODE) {
    // Tryb deweloperski: aktywacja pakietu bez bramki płatności.
    // Model ilościowy: każdy zakup to osobna pula ważna 12 miesięcy.
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + plan.validityMonths);
    await db.insert(subscriptions).values({
      userId: user.id,
      planId: plan.id,
      status: "AKTYWNY",
      reportsLimit: plan.reportsIncluded,
      reportsUsed: 0,
      validUntil,
    });
    await db.update(users).set({ status: "AKTYWNE" }).where(eq(users.id, user.id));
    await audit(user.id, "package.activate.dev", { planId: plan.id, reports: plan.reportsIncluded });
  }
  revalidatePath("/panel/abonament");
  redirect("/panel/abonament?status=ok");
}

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/abonament");
  const params = await searchParams;

  const [u] = await db
    .select({ status: users.status, freeReportUsedAt: users.freeReportUsedAt, emailVerifiedAt: users.emailVerifiedAt, phoneVerifiedAt: users.phoneVerifiedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const allPacks = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).orderBy(desc(subscriptions.startedAt)).limit(50);
  const now = new Date();
  const activePacks = allPacks.filter(
    (pk) => pk.status === "AKTYWNY" && (!pk.validUntil || pk.validUntil > now) && (pk.reportsLimit ?? 0) > pk.reportsUsed
  );
  const availableReports = activePacks.reduce((sum, pk) => sum + ((pk.reportsLimit ?? 0) - pk.reportsUsed), 0);
  const nearestExpiry = activePacks
    .map((pk) => pk.validUntil)
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const txs = await db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(20);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <p className="kicker">Pakiety i płatności</p>
        <h1 className="display-1 text-[clamp(24px,3vw,32px)] mt-2">Pakiety raportów</h1>
        <p className="text-[13.5px] text-dim mt-1">Model ilościowy — płacisz za raporty, nie za abonament. Każdy pakiet ważny {PACKAGE_VALIDITY_MONTHS} miesięcy od zakupu.</p>
      </div>

      {params.status === "ok" && (
        <p className="flex items-center gap-2 text-[13px] text-ok hairline rounded-lg px-4 py-3 bg-ok/5">
          <Check size={15} aria-hidden /> Pakiet został aktywowany{DEV_MODE ? " (tryb deweloperski — symulacja płatności)" : ""}.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rpt-kpi">
          <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-dim">Status konta</p>
          <p className="num-mono text-[18px] mt-2 text-volt">{ACCOUNT_STATUS_LABEL[u?.status ?? "NIEZWERYFIKOWANE"]}</p>
          <p className="text-[11.5px] text-faint mt-1">
            e-mail: {u?.emailVerifiedAt ? "potwierdzony" : "oczekuje"} · telefon: {u?.phoneVerifiedAt ? "potwierdzony" : "oczekuje"}
          </p>
        </div>
        <div className="rpt-kpi">
          <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-dim">Darmowy raport</p>
          <p className="num-mono text-[18px] mt-2 text-mist">{u?.freeReportUsedAt ? "Wykorzystany" : "Dostępny"}</p>
          <p className="text-[11.5px] text-faint mt-1">{u?.freeReportUsedAt ? new Date(u.freeReportUsedAt).toLocaleDateString("pl-PL") : "jeden pełny raport gratis"}</p>
        </div>
        <div className="rpt-kpi">
          <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-dim">Dostępne raporty</p>
          <p className="num-mono text-[18px] mt-2 text-ok">{availableReports}</p>
          <p className="text-[11.5px] text-faint mt-1">
            {activePacks.length
              ? `${activePacks.length} ${activePacks.length === 1 ? "aktywny pakiet" : "aktywne pakiety"}${nearestExpiry ? ` · najbliższe wygaśnięcie ${nearestExpiry.toLocaleDateString("pl-PL")}` : ""}`
              : "brak aktywnych pakietów"}
          </p>
        </div>
      </div>

      {DEV_MODE && (
        <p className="flex items-start gap-2 text-[12.5px] text-amp hairline rounded-lg px-4 py-3 bg-amp/5">
          <TriangleAlert size={15} className="shrink-0 mt-0.5" aria-hidden />
          Bramka płatności nie jest skonfigurowana (brak PAYMENTS_PROVIDER_KEY). Aktywacja pakietów działa w trybie symulacji DEV.
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        {PLANS.filter((p) => p.pricePLN > 0).map((p) => (
          <div key={p.id} className={`card p-6 flex flex-col ${p.highlighted ? "!border-flame/50" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-bold text-[15px]">{p.name}</h2>
              {p.badge ? (
                <span className="badge !bg-flame/15 !text-flame !border-flame/55">{p.badge}</span>
              ) : (
                <Zap size={14} className="text-faint" aria-hidden />
              )}
            </div>
            <p className="mt-3">
              <span className="font-display font-bold text-[26px]">{formatPlanPrice(p)}</span>
              <span className="text-[11.5px] text-faint"> jednorazowo</span>
            </p>
            <p className="font-mono text-[12px] text-volt mt-1 font-semibold">{p.reportsIncluded} raportów</p>
            <p className="font-mono text-[10.5px] text-faint mt-0.5">{pricePerReport(p)} · ważność {p.validityMonths} mies.</p>
            <ul className="mt-4 space-y-2 flex-1">
              {p.features.slice(0, 4).map((f) => (
                <li key={f} className="flex gap-2 text-[12px] text-dim"><Check size={13} className="text-volt shrink-0 mt-0.5" aria-hidden />{f}</li>
              ))}
            </ul>
            <form action={buyPlan} className="mt-5">
              <input type="hidden" name="planId" value={p.id} />
              <button type="submit" className={`btn btn-sm w-full ${p.highlighted ? "btn-primary" : "btn-ghost"}`}>
                <CreditCard size={14} aria-hidden /> {DEV_MODE ? "Aktywuj (symulacja DEV)" : p.cta}
              </button>
            </form>
          </div>
        ))}
      </div>

      {activePacks.length > 0 && (
        <section className="card overflow-hidden">
          <div className="px-6 py-4 hairline-b">
            <h2 className="font-display font-semibold text-[15px]">Twoje aktywne pakiety</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="rpt-table min-w-[560px]">
              <thead><tr><th>Pakiet</th><th>Wykorzystano</th><th>Pozostało</th><th>Ważny do</th></tr></thead>
              <tbody>
                {activePacks.map((pk) => (
                  <tr key={pk.id}>
                    <td className="font-mono text-[12px] text-volt">{pk.planId}</td>
                    <td className="num-mono">{pk.reportsUsed} / {pk.reportsLimit ?? "—"}</td>
                    <td className="num-mono text-ok">{(pk.reportsLimit ?? 0) - pk.reportsUsed}</td>
                    <td className="num-mono text-[12px] text-dim">{pk.validUntil ? pk.validUntil.toLocaleDateString("pl-PL") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-6 py-3 text-[11.5px] text-faint">Raporty pobierane są najpierw z pakietu, który wygasa najwcześniej. Niewykorzystane raporty przepadają po upływie ważności.</p>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="px-6 py-4 hairline-b">
          <h2 className="font-display font-semibold text-[15px]">Historia transakcji</h2>
        </div>
        {txs.length === 0 ? (
          <p className="px-6 py-8 text-[13px] text-faint">Brak transakcji.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="rpt-table min-w-[560px]">
              <thead><tr><th>Data</th><th>Pakiet</th><th>Kwota</th><th>Status</th><th>Operator</th></tr></thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td className="num-mono text-[12px] text-dim">{new Date(t.createdAt).toLocaleString("pl-PL")}</td>
                    <td className="font-mono text-[12px] text-volt">{t.planId}</td>
                    <td className="num-mono">{(t.amountGr / 100).toLocaleString("pl-PL")} {t.currency}</td>
                    <td><span className={`badge ${t.status === "OPLACONA" ? "st-ok" : t.status === "NOWA" ? "st-warn" : "st-crit"}`}>{t.status}</span></td>
                    <td className="font-mono text-[11.5px] text-faint">{t.provider ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
