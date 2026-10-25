import Link from "next/link";
import { BRAND } from "@/config/brand";
import { ArrowUpRight } from "lucide-react";
import { ScrollAwareBar } from "@/components/scroll-aware-bar";

/* △ Logo DiagoLAB Raporty+ — znak „impuls" + techniczna typografia.
     Diago = biel · LAB = ognisty pomarańcz · Raporty+ = elektryczny cyjan. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 group" aria-label="DiagoLAB Raporty+ — strona główna">
      <span className="relative grid place-items-center w-10 h-10 rounded-xl border border-line2 bg-panel overflow-hidden">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
          <path
            d="M2 15.5 L7.5 15.5 L10 6 L14 21 L16.5 11.5 L18.5 15.5 L24 15.5"
            stroke="#ff6a1f"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="15.5" r="1.6" fill="#45e0ff" />
        </svg>
        <span
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ boxShadow: "inset 0 0 18px rgba(255,106,31,.3)" }}
        />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display font-bold text-[15px] tracking-tight text-brand">
            Diago<span className="text-flame">LAB</span>
          </span>
          <span className="block font-mono text-[9.5px] tracking-[0.3em] text-brand-mid mt-1 uppercase">
            Raporty<span className="text-brand-mid">+</span>
          </span>
        </span>
      )}
    </Link>
  );
}

const NAV = [
  { href: "/#jak-dziala", label: "Jak działa" },
  { href: "/#import", label: "Import" },
  { href: "/#analiza", label: "Analiza" },
  { href: "/demo", label: "Przykładowy raport" },
  { href: "/#cennik", label: "Cennik" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <ScrollAwareBar>
        <div className="mx-auto max-w-7xl px-5 lg:px-8 h-[72px] flex items-center justify-between gap-6">
          <Logo />
          <nav aria-label="Nawigacja główna" className="hidden lg:flex items-center gap-7">
            {NAV.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="text-[13.5px] text-dim hover:text-mist transition-colors"
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/logowanie" className="hidden sm:inline-flex text-[13.5px] text-dim hover:text-mist transition-colors px-3 py-2">
              Zaloguj
            </Link>
            <Link href="/rejestracja" className="btn btn-primary btn-sm">
              Wygeneruj raport gratis
              <ArrowUpRight size={15} strokeWidth={2.4} aria-hidden />
            </Link>
          </div>
        </div>
      </ScrollAwareBar>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink bg-noise">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-16">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div>
            <Logo />
            <p className="mt-5 text-sm text-dim leading-relaxed max-w-xs">
              {BRAND.promise} Część ekosystemu {BRAND.family} — razem z aplikacją {BRAND.ecosystem[0]}.
            </p>
            <p className="mt-4 font-mono text-[10.5px] tracking-[0.14em] text-faint uppercase">
              △ Design system: wersja tymczasowa
            </p>
          </div>
          <FooterCol
            title="Produkt"
            links={[
              ["Przykładowy raport", "/demo"],
              ["Cennik", "/#cennik"],
              ["Panel instalatora", "/panel"],
              ["Smart Compare+", "/#smart-compare"],
            ]}
          />
          <FooterCol
            title="Konto"
            links={[
              ["Rejestracja", "/rejestracja"],
              ["Logowanie", "/logowanie"],
              ["Abonament", "/panel/abonament"],
              ["Pomoc", "/#faq"],
            ]}
          />
          <FooterCol
            title="Formalności"
            links={[
              ["RODO i prywatność", "/#faq"],
              ["Bezpieczeństwo", "/#analiza"],
              ["Regulamin", "/#faq"],
              ["Kontakt", `mailto:${BRAND.supportEmail}`],
            ]}
          />
        </div>

        <div className="mt-14 pt-8 hairline-t">
          <p className="text-[12.5px] leading-relaxed text-faint max-w-4xl">
            Raporty są przygotowywane z wykorzystaniem systemu {BRAND.product}. Wyniki pochodzą z danych
            przekazanych przez użytkownika. System wspomaga analizę, ale nie zastępuje kwalifikacji i oceny
            osoby wykonującej badania. Końcową ocenę zatwierdza wykonawca pomiarów. Podpis graficzny nie
            stanowi kwalifikowanego podpisu elektronicznego.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
              © {new Date().getFullYear()} {BRAND.family} · {BRAND.product}
            </p>
            <p className="font-mono text-[11px] text-faint">PL · IEC / PN-HD 60364-6</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] tracking-[0.24em] text-faint uppercase mb-4">{title}</p>
      <ul className="space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[13.5px] text-dim hover:text-volt transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
