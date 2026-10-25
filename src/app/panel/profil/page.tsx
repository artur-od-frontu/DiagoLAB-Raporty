import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { IdCard, Upload, CircleCheck } from "lucide-react";
import { getSessionUser, audit } from "@/lib/auth";
import { db } from "@/db";
import { installerProfiles } from "@/db/schema";
import { LogoUpload } from "@/components/logo-upload";

export const dynamic = "force-dynamic";

async function saveProfile(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) return;
  const v = (k: string) => {
    const val = formData.get(k);
    return typeof val === "string" && val.trim() ? val.trim() : null;
  };
  await db
    .insert(installerProfiles)
    .values({
      userId: user.id,
      firstName: v("firstName"),
      lastName: v("lastName"),
      companyName: v("companyName"),
      nip: v("nip")?.replace(/[-\s]/g, "") ?? null,
      address: v("address"),
      phone: v("phone"),
      email: v("email") ?? user.email,
      certificateNo: v("certificateNo"),
      qualificationScope: v("qualificationScope"),
      certificateValidUntil: v("certificateValidUntil"),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: installerProfiles.userId,
      set: {
        firstName: v("firstName"),
        lastName: v("lastName"),
        companyName: v("companyName"),
        nip: v("nip")?.replace(/[-\s]/g, "") ?? null,
        address: v("address"),
        phone: v("phone"),
        email: v("email") ?? user.email,
        certificateNo: v("certificateNo"),
        qualificationScope: v("qualificationScope"),
        certificateValidUntil: v("certificateValidUntil"),
        updatedAt: new Date(),
      },
    });
  await audit(user.id, "profile.save");
  revalidatePath("/panel/profil");
  redirect("/panel/profil?zapisano=1");
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ zapisano?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/profil");
  const params = await searchParams;

  const [profile] = await db.select().from(installerProfiles).where(eq(installerProfiles.userId, user.id)).limit(1);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="kicker">Dane wykonawcy</p>
        <h1 className="display-1 text-[clamp(24px,3vw,32px)] mt-2">Profil instalatora</h1>
        <p className="text-[13.5px] text-dim mt-1">
          Dane z profilu automatycznie uzupełniają kolejne raporty. Numer świadectwa i dane osobowe wpisujesz samodzielnie — system nigdy ich nie generuje.
        </p>
      </div>

      {params.zapisano && (
        <p className="flex items-center gap-2 text-[13px] text-ok hairline rounded-lg px-4 py-3 bg-ok/5">
          <CircleCheck size={15} aria-hidden /> Profil został zapisany.
        </p>
      )}

      <form action={saveProfile} className="card p-6 md:p-8">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field name="firstName" label="Imię" defaultValue={profile?.firstName ?? ""} required />
          <Field name="lastName" label="Nazwisko" defaultValue={profile?.lastName ?? ""} required />
          <Field name="companyName" label="Nazwa firmy" defaultValue={profile?.companyName ?? ""} />
          <Field name="nip" label="NIP" defaultValue={profile?.nip ?? ""} placeholder="10 cyfr" />
          <Field name="address" label="Adres" defaultValue={profile?.address ?? ""} className="sm:col-span-2" />
          <Field name="phone" label="Telefon" defaultValue={profile?.phone ?? ""} />
          <Field name="email" label="E-mail" type="email" defaultValue={profile?.email ?? user.email} />
        </div>

        <h2 className="font-display font-semibold text-[15px] mt-8 flex items-center gap-2">
          <IdCard size={16} className="text-volt" aria-hidden /> Kwalifikacje
        </h2>
        <div className="grid sm:grid-cols-2 gap-5 mt-4">
          <Field name="certificateNo" label="Numer świadectwa kwalifikacyjnego" defaultValue={profile?.certificateNo ?? ""} placeholder="np. E/12/345678/2024" />
          <div className="field">
            <label htmlFor="qualificationScope">Zakres kwalifikacji</label>
            <select id="qualificationScope" name="qualificationScope" className="input" defaultValue={profile?.qualificationScope ?? "E do 1 kV"}>
              <option>E — eksploatacja do 1 kV</option>
              <option>E do 1 kV</option>
              <option>E — eksploatacja i dozór do 1 kV</option>
              <option>E+D — eksploatacja i dozór do 1 kV</option>
              <option>E+D — eksploatacja i dozór powyżej 1 kV</option>
              <option>E — pomiary i kontrola (PN-HD 60364-6)</option>
            </select>
          </div>
          <Field name="certificateValidUntil" label="Ważność świadectwa (jeśli dotyczy)" type="date" defaultValue={profile?.certificateValidUntil ?? ""} />
        </div>

        <h2 className="font-display font-semibold text-[15px] mt-8 flex items-center gap-2">
          <Upload size={16} className="text-volt" aria-hidden /> Logo i podpis
        </h2>
        <p className="text-[12.5px] text-dim mt-3">
          Logo trafia do nagłówka raportu interaktywnego i na stronę tytułową PDF. Zapisuje się od razu — niezależnie od przycisku poniżej.
        </p>
        <div className="grid sm:grid-cols-2 gap-5 mt-4">
          <LogoUpload initialLogo={profile?.logoData ?? null} />
          <div className="hairline !border-dashed rounded-xl p-5 text-center bg-abyss/50 grid place-content-center">
            <p className="text-[13px] text-dim">Podpis (obraz)</p>
            <p className="font-mono text-[10px] text-faint mt-1.5">podgląd, nie kwalifikowany podpis elektroniczny — ETAP</p>
          </div>
        </div>

        <button type="submit" className="btn btn-primary mt-8">Zapisz profil</button>
      </form>
    </div>
  );
}

function Field({
  name, label, type = "text", defaultValue, placeholder, required, className = "",
}: {
  name: string; label: string; type?: string; defaultValue?: string; placeholder?: string; required?: boolean; className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={name}>{label}{required ? " *" : ""}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} className="input" />
    </div>
  );
}
