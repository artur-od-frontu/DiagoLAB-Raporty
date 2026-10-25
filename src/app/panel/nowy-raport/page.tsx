import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import { installerProfiles } from "@/db/schema";
import { NewReportWizard } from "@/components/new-report-wizard";
import type { InstrumentItem } from "@/components/instruments-manager";

export const dynamic = "force-dynamic";

export default async function NewReportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/nowy-raport");

  const [profile] = await db
    .select({ instruments: installerProfiles.instruments })
    .from(installerProfiles)
    .where(eq(installerProfiles.userId, user.id))
    .limit(1);

  const availableInstruments = (profile?.instruments ?? []) as InstrumentItem[];

  return <NewReportWizard availableInstruments={availableInstruments} />;
}
