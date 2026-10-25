import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { Users, UserPlus } from "lucide-react";
import { getSessionUser, audit } from "@/lib/auth";
import { db } from "@/db";
import { clients } from "@/db/schema";

export const dynamic = "force-dynamic";

async function addClient(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/logowanie");
  const v = (k: string) => {
    const val = formData.get(k);
    return typeof val === "string" && val.trim() ? val.trim() : null;
  };
  const name = v("name");
  if (!name) return;
  const nip = v("nip")?.replace(/[-\s]/g, "") ?? null;
  await db.insert(clients).values({
    userId: user.id,
    name,
    nip: nip && /^\d{10}$/.test(nip) ? nip : null,
    email: v("email"),
    phone: v("phone"),
    address: v("address"),
  });
  await audit(user.id, "client.create", { name });
  revalidatePath("/panel/klienci");
  redirect("/panel/klienci?dodano=1");
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ dodano?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/klienci");
  const params = await searchParams;

  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.userId, user.id))
    .orderBy(desc(clients.createdAt))
    .limit(200);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <p className="kicker">Baza zleceniodawców</p>
        <h1 className="display-1 text-[clamp(24px,3vw,32px)] mt-2">Klienci</h1>
        <p className="text-[13.5px] text-dim mt-1">Klienci są tworzeni także automatycznie podczas generowania raportu.</p>
      </div>

      {params.dodano && (
        <p className="text-[13px] text-ok hairline !border-ok/40 rounded-lg px-4 py-3 bg-ok/5">Klient został dodany.</p>
      )}

      <section className="card p-6">
        <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
          <UserPlus size={16} className="text-volt" aria-hidden /> Dodaj klienta
        </h2>
        <form action={addClient} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          <div className="field"><label htmlFor="name">Nazwa *</label><input id="name" name="name" required className="input" placeholder="np. Meblex Sp. z o.o." /></div>
          <div className="field"><label htmlFor="nip">NIP</label><input id="nip" name="nip" className="input num-mono" placeholder="10 cyfr" /></div>
          <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" /></div>
          <div className="field"><label htmlFor="phone">Telefon</label><input id="phone" name="phone" className="input" /></div>
          <div className="field lg:col-span-2"><label htmlFor="address">Adres</label><input id="address" name="address" className="input" /></div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" className="btn btn-primary btn-sm">Dodaj klienta</button>
          </div>
        </form>
      </section>

      <section className="card overflow-hidden">
        <div className="px-6 py-4 hairline-b flex items-center gap-2">
          <Users size={16} className="text-volt" aria-hidden />
          <h2 className="font-display font-semibold text-[15px]">Lista klientów ({rows.length})</h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-[13px] text-faint">
            Brak klientów. Dodaj pierwszego powyżej lub wygeneruj raport — klient utworzy się automatycznie.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="rpt-table min-w-[720px]">
              <thead><tr><th>Nazwa</th><th>NIP</th><th>Kontakt</th><th>Adres</th><th>Dodano</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="text-mist">{c.name}</td>
                    <td className="num-mono text-[12.5px] text-dim">{c.nip ?? "—"}</td>
                    <td className="text-[12.5px] text-dim">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="text-[12.5px] text-dim">{c.address ?? "—"}</td>
                    <td className="num-mono text-[12px] text-faint">{new Date(c.createdAt).toLocaleDateString("pl-PL")}</td>
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
