import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { PanelShell } from "@/components/panel";

export const metadata: Metadata = {
  title: "Panel instalatora",
  robots: { index: false },
};

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return <PanelShell user={user}>{children}</PanelShell>;
}
