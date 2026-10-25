import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/chrome";

export default function NotFoundPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen flex items-center justify-center px-5 pt-[72px]">
        <div className="text-center max-w-md">
          <p className="font-mono text-[72px] font-bold text-brand-mid/20 leading-none">404</p>
          <h1 className="font-display font-bold text-[24px] text-brand mt-4">Strona nie istnieje</h1>
          <p className="text-dim mt-3 leading-relaxed">
            Adres, który wpisałeś, nie prowadzi do żadnej strony w DiagoLAB Raporty+.
            Sprawdź link lub wróć do strony głównej.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <Link href="/" className="btn btn-primary btn-sm">Strona główna</Link>
            <Link href="/panel" className="btn btn-ghost btn-sm">Panel instalatora</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
