"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  FolderOpen,
  Users,
  Building2,
  History,
  IdCard,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  TriangleAlert,
  Signal,
} from "lucide-react";
import { Logo } from "@/components/chrome";
import { SessionGuard } from "@/components/session-guard";
import type { SessionUser } from "@/lib/auth";
import { ACCOUNT_STATUS_LABEL } from "@/config/brand";

const MENU = [
  { href: "/panel", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { href: "/panel/nowy-raport", label: "Nowy raport", icon: FilePlus2, enabled: true },
  { href: "/panel/raporty", label: "Moje raporty", icon: FolderOpen, enabled: true },
  { href: "/panel/klienci", label: "Klienci", icon: Users, enabled: true },
  { href: "/panel/obiekty", label: "Obiekty", icon: Building2, enabled: true },
  { href: "/panel/historia", label: "Historia pomiarów", icon: History, enabled: true },
  { href: "/teren", label: "Tryb terenowy", icon: Signal, enabled: true },
  { href: "/panel/profil", label: "Profil instalatora", icon: IdCard, enabled: true },
  { href: "/panel/abonament", label: "Abonament", icon: CreditCard, enabled: true },
  { href: "/panel/ustawienia", label: "Ustawienia", icon: Settings, enabled: true },
];

export function PanelShell({ user, children }: { user: SessionUser | null; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const nav = (
    <nav aria-label="Menu panelu" className="flex flex-col gap-1 p-4">
      {MENU.map((m) => {
        const active = pathname === m.href;
        if (!m.enabled) {
          return (
            <span
              key={m.href}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] text-faint cursor-not-allowed"
              title="Moduł w przygotowaniu — kolejny etap wdrożenia"
              aria-disabled
            >
              <m.icon size={16} aria-hidden />
              <span className="flex-1">{m.label}</span>
              <span className="badge st-miss !text-[8.5px] !px-1.5 !py-0.5">ETAP</span>
            </span>
          );
        }
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] transition-colors ${
              active ? "bg-volt/12 text-volt border border-volt/30" : "text-dim hover:text-mist hover:bg-panel2 border border-transparent"
            }`}
          >
            <m.icon size={16} aria-hidden />
            {m.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink lg:grid lg:grid-cols-[264px_1fr]">
      {/* Sesja czynna: licznik bezczynności + automatyczny zapis wersji roboczych */}
      {user && <SessionGuard />}

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col hairline !border-y-0 !border-l-0 bg-abyss sticky top-0 h-screen">
        <div className="p-5 hairline-b"><Logo /></div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <UserBox user={user} onLogout={logout} />
      </aside>

      {/* Topbar mobile */}
      <div className="lg:hidden sticky top-0 z-40 glass hairline-b flex items-center justify-between px-4 h-16">
        <Logo compact />
        <div className="flex items-center gap-2">
          <Link href="/panel/nowy-raport" className="btn btn-primary btn-sm">+ Nowy raport</Link>
          <button type="button" onClick={() => setOpen(!open)} className="p-2 text-dim" aria-label={open ? "Zamknij menu" : "Otwórz menu"} aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-ink/95 backdrop-blur-sm">
          <div className="flex justify-between items-center px-4 h-16 hairline-b">
            <Logo />
            <button type="button" onClick={() => setOpen(false)} className="p-2 text-dim" aria-label="Zamknij menu"><X size={20} /></button>
          </div>
          {nav}
          <div className="absolute bottom-0 inset-x-0"><UserBox user={user} onLogout={logout} /></div>
        </div>
      )}

      {/* Treść */}
      <div className="min-w-0">
        {!user && (
          <div className="no-print bg-amp/8 border-b border-amp/30 px-5 py-3 flex flex-wrap items-center gap-3">
            <TriangleAlert size={15} className="text-amp shrink-0" aria-hidden />
            <p className="text-[13px] text-amp">Tryb demonstracyjny panelu — dane poniżej są przykładowe (DEMO). Zaloguj się, aby pracować na swoich raportach.</p>
            <Link href="/logowanie" className="text-[12.5px] underline underline-offset-4 text-mist hover:text-volt ml-auto">Zaloguj się</Link>
          </div>
        )}
        <main className="p-5 lg:p-9 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}

function UserBox({ user, onLogout }: { user: SessionUser | null; onLogout: () => void }) {
  if (!user) {
    return (
      <div className="p-4 hairline-t">
        <Link href="/rejestracja" className="btn btn-primary btn-sm w-full">Załóż konto gratis</Link>
      </div>
    );
  }
  return (
    <div className="p-4 hairline-t">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-9 h-9 rounded-full bg-volt/15 border border-volt/40 text-volt font-display font-bold text-[13px]">
          {user.email.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-mist truncate">{user.email}</p>
          <p className="font-mono text-[9.5px] tracking-[0.12em] uppercase text-faint">{ACCOUNT_STATUS_LABEL[user.status]}</p>
        </div>
        <button type="button" onClick={onLogout} className="p-2 text-faint hover:text-crit transition-colors" title="Wyloguj" aria-label="Wyloguj">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
