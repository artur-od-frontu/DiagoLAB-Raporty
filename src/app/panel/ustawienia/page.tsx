import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SettingsClient } from "@/components/settings";
import { ACCOUNT_STATUS_LABEL } from "@/config/brand";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/logowanie?next=/panel/ustawienia");

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker">Konfiguracja konta</p>
        <h1 className="display-1 text-[clamp(24px,3vw,32px)] mt-2">Ustawienia</h1>
      </div>
      <SettingsClient email={user.email} statusLabel={ACCOUNT_STATUS_LABEL[user.status]} />
    </div>
  );
}
