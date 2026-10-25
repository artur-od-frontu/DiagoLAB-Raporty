import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BadgeCheck,
  CalendarClock,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  Cpu,
  Database,
  FileDown,
  FileText,
  Gauge,
  History,
  Layers,
  Lock,
  Plus,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Table2,
  TrendingUp,
  TriangleAlert,
  Upload,
  Wallet,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { PLANS, formatPlanPrice, pricePerReport, BRAND } from "@/config/brand";
import { Reveal } from "@/components/motion";
import { HeroReportPreview } from "@/components/hero-preview";

/* ============================== HERO ============================== */

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-[72px]">
      <div className="absolute inset-0 bg-blueprint" aria-hidden />
      <div className="absolute -top-40 left-1/4 w-[560px] h-[560px] glow-volt pointer-events-none" aria-hidden />
      <div className="absolute -bottom-64 right-0 w-[520px] h-[520px] glow-amp pointer-events-none" aria-hidden />

      {/* fala — oscyloskop */}
      <svg className="absolute bottom-0 left-0 w-full opacity-[0.16] pointer-events-none" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden>
        <path className="anim-sine" d="M0 45 Q 90 8, 180 45 T 360 45 T 540 45 T 720 45 T 900 45 T 1080 45 T 1260 45 T 1440 45" fill="none" stroke="#45e0ff" strokeWidth="1.6" />
      </svg>

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
        <div>
          <Reveal>
            <span className="chip"><span className="dot anim-pulse-dot" aria-hidden />Ekosystem {BRAND.family} · {BRAND.ecosystem.join(" | ")}</span>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="display-1 text-[clamp(38px,5.2vw,64px)] mt-6">
              Wyniki pomiarów zamienione w&nbsp;<span className="text-grad-volt">inteligentny raport.</span>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-6 text-[16.5px] leading-[1.75] text-dim max-w-xl">
              Prześlij wyniki pomiarów instalacji elektrycznej. DiagoLAB przygotuje interaktywne wykresy,
              analizę wyników, propozycje zaleceń oraz profesjonalny raport PDF.
            </p>
          </Reveal>
          <Reveal delay={270}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/rejestracja" className="btn btn-primary btn-thermo">
                Wygeneruj pierwszy raport gratis
                <ArrowRight size={17} strokeWidth={2.2} aria-hidden />
              </Link>
              <Link href="/demo" className="btn btn-ghost">
                Zobacz przykładowy raport
              </Link>
            </div>
            <p className="mt-4 text-[12.5px] text-faint font-mono">Bez karty płatniczej. Jeden pełny raport gratis.</p>
          </Reveal>
          <Reveal delay={360}>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
              {[
                [ShieldCheck, "Kryteria wg PN-HD 60364-6"],
                [Database, "Hash SHA-256 źródeł danych"],
                [Clock, "Od importu do PDF w minuty"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof ShieldCheck;
                return (
                  <span key={label as string} className="inline-flex items-center gap-2 text-[12.5px] text-dim">
                    <I size={14} className="text-volt" aria-hidden /> {label as string}
                  </span>
                );
              })}
            </div>
          </Reveal>
        </div>

        <Reveal delay={220} className="relative">
          <HeroReportPreview />
        </Reveal>
      </div>

      {/* pasek techniczny */}
      <div className="relative hairline-t hairline-b bg-abyss/60 overflow-hidden" aria-hidden>
        <div className="flex whitespace-nowrap anim-ticker py-3.5 w-max">
          {[0, 1].map((n) => (
            <div key={n} className="flex gap-10 pr-10 font-mono text-[10.5px] tracking-[0.26em] uppercase text-faint">
              <span>Impedancja pętli zwarcia</span><span className="text-volt">·</span>
              <span>Rezystancja izolacji</span><span className="text-volt">·</span>
              <span>Ciągłość przewodów ochronnych</span><span className="text-volt">·</span>
              <span>Badanie RCD</span><span className="text-volt">·</span>
              <span>Napięcie dotykowe</span><span className="text-volt">·</span>
              <span>Smart Compare+</span><span className="text-amp">·</span>
              <span>Raport PDF A4</span><span className="text-volt">·</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================= 1 · JAK DZIAŁA ========================= */

const STEPS = [
  { icon: Upload, no: "01", t: "Import wyników", d: "Przeciągnij plik CSV lub XLSX z pomiarów. System rozpozna kolumny, jednostki i rodzaje pomiarów — poprawisz mapowanie przed analizą." },
  { icon: Cpu, no: "02", t: "Silnik analizy", d: "Moduł obliczeniowy waliduje dane, liczy limity i porównuje z kryteriami. Moduł AI tworzy wyłącznie opisy i propozycje — nigdy wyniki." },
  { icon: Gauge, no: "03", t: "Raport interaktywny", d: "Dashboard z tabelą, wykresami, ostrzeżeniami i historią obiektu. Przeglądasz, filtrujesz, zarządzasz zaleceniami." },
  { icon: BadgeCheck, no: "04", t: "Zatwierdzenie i PDF", d: "Weryfikujesz dane, wydajesz ocenę końcową i podpisujesz. Generujesz profesjonalny PDF A4 z kodem QR do wersji online." },
];

export function HowItWorks() {
  return (
    <Section id="jak-dziala" kicker="Proces" title="Jak działa DiagoLAB Raporty+" lead="Cztery kroki od surowych danych do dokumentu gotowego do przekazania klientowi. Każdy kanał decyzji kończy się na instalatorze.">
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
        {STEPS.map((s, i) => (
          <Reveal key={s.no} delay={i * 90}>
            <div className="card card-hover p-6 h-full relative overflow-hidden">
              <span className="absolute -top-3 right-3 font-display font-bold text-[58px] leading-none text-line2/60 select-none" aria-hidden>{s.no}</span>
              <span className="grid place-items-center w-11 h-11 rounded-xl border border-line2 bg-abyss text-volt">
                <s.icon size={19} aria-hidden />
              </span>
              <h3 className="font-display font-semibold text-[16.5px] mt-5">{s.t}</h3>
              <p className="text-[13.5px] leading-relaxed text-dim mt-2.5">{s.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ========================= 2 · IMPORT ========================= */

export function ImportSection() {
  return (
    <Section id="import" kicker="Moduł importu" title="Przeciągnij plik. Resztą zajmie się system." lead="Obsługa formatów wdrażana etapami — od najczęściej używanych w terenie.">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <Reveal>
          <div className="card p-8 relative">
            <div className="hairline !border-dashed rounded-xl px-6 py-12 text-center bg-abyss/60">
              <span className="mx-auto grid place-items-center w-14 h-14 rounded-2xl border border-volt/40 bg-volt/10 text-volt">
                <Upload size={22} aria-hidden />
              </span>
              <p className="font-display font-semibold mt-5">Przeciągnij plik z wynikami</p>
              <p className="text-[12.5px] text-faint mt-1.5">lub</p>
              <p className="btn btn-ghost btn-sm mt-3 inline-flex">WYBIERZ PLIK</p>
              <div className="mt-6 flex justify-center gap-2 flex-wrap">
                <span className="chip st-ok !rounded-full">CSV · dostępny</span>
                <span className="chip st-ok !rounded-full">XLSX · dostępny</span>
                <span className="chip !rounded-full">PDF · roadmapa</span>
                <span className="chip !rounded-full">TXT · roadmapa</span>
                <span className="chip !rounded-full">JSON · roadmapa</span>
              </div>
            </div>
            <p className="mt-4 text-[11.5px] text-faint font-mono text-center">Podgląd interfejsu · wersja robocza działa w Panelu → „Nowy raport”</p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <FeatureList
            items={[
              ["Automatyczne rozpoznawanie", "Wykrywamy rodzaje pomiarów, liczbę rekordów i rozpoznane kolumny po nazwach nagłówków."],
              ["Mapowanie kolumn i jednostki", "Poprawisz przypisanie kolumn, wskażesz jednostki i uzupełnisz braki — zanim ruszy analiza."],
              ["Walidacja krytycznych danych", "Podgląd tabeli wskazuje brakujące dane i potencjalne błędy. Bez kompletu danych krytycznych ocena się nie uruchomi."],
              ["Integralność źródła", "Każdy import dostaje skrót SHA-256 — raport zawsze wskazuje, z jakich danych powstał."],
            ]}
          />
        </Reveal>
      </div>
    </Section>
  );
}

/* ========================= 3 · ANALIZA ========================= */

export function AnalysisSection() {
  return (
    <Section id="analiza" kicker="Silnik analizy" title="Dwa moduły. Zero zgadywania." lead="Świadomie rozdzielamy matematykę od narracji — to fundament wiarygodności raportu.">
      <div className="grid lg:grid-cols-2 gap-5">
        <Reveal>
          <div className="card card-hover p-7 h-full">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-volt/10 border border-volt/40 text-volt"><Cpu size={19} aria-hidden /></span>
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-faint uppercase">Moduł A · deterministyczny</p>
                <h3 className="font-display font-semibold text-[17px]">Silnik obliczeniowy</h3>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {["Normalizacja jednostek i formatów (0,42 Ω → kΩ → ms)", "Walidacja i wykrywanie braków krytycznych", "Limity Zs wg charakterystyki B/C/D i prądu In", "Progi RCD: czas i prąd wyzwalania", "Porównanie z kryteriami + stan każdego pomiaru"].map((t) => (
                <li key={t} className="flex gap-2.5 text-[13.5px] text-dim"><CircleCheck size={15} className="text-volt shrink-0 mt-0.5" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={110}>
          <div className="card card-hover p-7 h-full">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-info/10 border border-info/40 text-info"><Sparkles size={19} aria-hidden /></span>
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-faint uppercase">Moduł B · asysta AI</p>
                <h3 className="font-display font-semibold text-[17px]">Warstwa narracyjna</h3>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {["Podsumowania i opisy techniczne wyników", "Propozycje zaleceń i działań naprawczych", "Opis wykrytych nieprawidłowości", "Analiza trendów z historii pomiarów", "Klucz API wyłącznie po stronie serwera"].map((t) => (
                <li key={t} className="flex gap-2.5 text-[13.5px] text-dim"><CircleCheck size={15} className="text-info shrink-0 mt-0.5" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
      <Reveal delay={180}>
        <div className="mt-6 hairline rounded-2xl bg-panel/60 px-6 py-5 flex flex-wrap gap-x-10 gap-y-3">
          {[
            [Lock, "AI nie wymyśla wyników"],
            [ShieldCheck, "AI nie potwierdza bezpieczeństwa instalacji"],
            [BadgeCheck, "Każdą decyzję zatwierdza instalator"],
          ].map(([Icon, t]) => {
            const I = Icon as typeof Lock;
            return (
              <span key={t as string} className="inline-flex items-center gap-2.5 text-[13px] text-mist">
                <I size={15} className="text-amp" aria-hidden /> {t as string}
              </span>
            );
          })}
        </div>
      </Reveal>
    </Section>
  );
}

/* ========================= 4 · RAPORTY (bento) ========================= */

const BENTO = [
  { icon: Table2, t: "Interaktywna tabela wyników", d: "Sortowanie, filtrowanie, wyszukiwanie i rozwijane szczegóły każdego punktu pomiarowego z kryterium i limitem.", wide: true },
  { icon: ScanLine, t: "Wykresy z linią limitu", d: "Słupkowe, liniowe i porównawcze — animowane, z możliwością wyłączenia animacji." },
  { icon: TriangleAlert, t: "Ostrzeżenia z kategoriami", d: "KRYTYCZNE · OSTRZEŻENIE · ZALECENIE · INFORMACJA — każde z przyczyną i proponowanym działaniem." },
  { icon: Database, t: "Źródła i integralność", d: "Plik, data importu, SHA-256, wersja algorytmów. Raport jest weryfikowalny." },
  { icon: History, t: "Historia obiektu", d: "Smart Compare+ łączy punkty między badaniami i pokazuje trendy w czasie." },
  { icon: FileDown, t: "PDF klasy A4", d: "Strona tytułowa, wykresy, numeracja stron i QR do wersji interaktywnej." },
];

export function ReportsBento() {
  return (
    <Section kicker="Produkt" title="Interaktywny raport — serce platformy" lead="Profesjonalny dashboard diagnostyczny zamiast martwego protokołu. Zobacz go w działaniu na danych demonstracyjnych.">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {BENTO.map((b, i) => (
          <Reveal key={b.t} delay={i * 70} className={b.wide ? "md:col-span-2 lg:col-span-1" : ""}>
            <div className="card card-hover p-6 h-full">
              <b.icon size={20} className="text-volt" aria-hidden />
              <h3 className="font-display font-semibold text-[15.5px] mt-4">{b.t}</h3>
              <p className="text-[13px] leading-relaxed text-dim mt-2">{b.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={200}>
        <div className="mt-8 text-center">
          <Link href="/demo" className="btn btn-primary">
            Otwórz przykładowy raport <ArrowUpRight size={16} aria-hidden />
          </Link>
          <p className="mt-3 text-[12px] text-faint font-mono">Dane demonstracyjne — wyraźnie oznaczone w raporcie</p>
        </div>
      </Reveal>
    </Section>
  );
}

/* ========================= 5 · PORÓWNANIE ========================= */

const CMP: [string, boolean, boolean][] = [
  ["Czas przygotowania dokumentacji", false, true],
  ["Automatyczna kontrola kryteriów PN-HD 60364-6", false, true],
  ["Interaktywne wykresy i tabele", false, true],
  ["Historia pomiarów obiektu i trendy", false, true],
  ["Integralność danych (SHA-256)", false, true],
  ["Profesjonalny PDF z QR do wersji online", false, true],
  ["Praca na telefonie w terenie", false, true],
];

export function ComparisonSection() {
  return (
    <Section kicker="Zmiana nawyków" title="Koniec z protokołami w Wordzie i Excelu" lead="To samo zadanie — diametralnie inne doświadczenie i kontrola jakości.">
      <Reveal>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="cmp-table min-w-[640px]">
              <thead>
                <tr className="bg-abyss/70">
                  <th className="text-faint font-mono !text-[11px] tracking-[0.18em] uppercase">Aspekt pracy</th>
                  <th className="text-dim">Tradycyjny protokół<br /><span className="font-mono text-[10px] text-faint">Word / Excel</span></th>
                  <th className="text-volt border-x border-volt/25 bg-volt/5">DiagoLAB Raporty+<br /><span className="font-mono text-[10px] text-volt/70">platforma</span></th>
                </tr>
              </thead>
              <tbody>
                {CMP.map(([label, trad, dl]) => (
                  <tr key={label}>
                    <td className="text-mist text-[13.5px]">{label}</td>
                    <td>{trad ? <CircleCheck className="text-ok" size={17} aria-label="tak" /> : <CircleX className="text-faint" size={17} aria-label="nie" />}</td>
                    <td className="border-x border-volt/25 bg-volt/5">{dl ? <CircleCheck className="text-volt" size={17} aria-label="tak" /> : <CircleX className="text-faint" size={17} aria-label="nie" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
      <Reveal delay={120}>
        <div className="grid sm:grid-cols-3 gap-5 mt-8">
          {[[Clock, "minuty zamiast godzin"], [Wrench, "mniej błędów przepisywania"], [Layers, "jeden model danych: HTML = PDF"]].map(([Icon, t], i) => {
            const I = Icon as typeof Clock;
            return (
              <div key={t as string} className="hairline rounded-xl px-5 py-4 flex items-center gap-3 bg-panel/50">
                <I size={17} className="text-volt" aria-hidden />
                <span className="text-[13.5px] text-mist">{t as string}</span>
              </div>
            );
          })}
        </div>
      </Reveal>
    </Section>
  );
}

/* ========================= 6 · KORZYŚCI ========================= */

export function BenefitsSection() {
  const items = [
    [Zap, "Szybciej", "Import → analiza → PDF bez przepisywania wyników między narzędziami."],
    [ShieldCheck, "Pewniej", "Silnik pilnuje kryteriów; Ty wydajesz ocenę. Mniej pomyłek, więcej spokoju."],
    [Award, "Profesjonalniej", "Raport z logo Twojej firmy, wykresami i QR — wizerunek, który wygrywa zlecenia."],
    [Users, "Dla klienta zrozumiale", "Klient widzi wyniki, wykresy i zalecenia — nie tylko tabelę liczb."],
    [CalendarClock, "Terminy pod kontrolą", "Historia obiektów i nadchodzące badania okresowe w jednym miejscu."],
    [TrendingUp, "Z historią", "Smart Compare+ pokazuje degradację instalacji zanim stanie się awarią."],
  ] as const;
  return (
    <Section id="korzysci" kicker="Dla instalatora" title="Zbudowane wokół Twojej pracy" lead="Narzędzie tworzone z myślą o codzienności pomiarowców — od terenu po biuro klienta.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(([Icon, t, d], i) => (
          <Reveal key={t} delay={i * 60}>
            <div className="card card-hover p-6 h-full">
              <Icon size={19} className="text-amp" aria-hidden />
              <h3 className="font-display font-semibold text-[15.5px] mt-4">{t}</h3>
              <p className="text-[13px] text-dim leading-relaxed mt-2">{d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ========================= 7 · SMART COMPARE+ ========================= */

export function SmartCompareSection() {
  return (
    <Section id="smart-compare" kicker="Historia pomiarów" title="DiagoLAB Smart Compare+" lead="Łączymy raporty z obiektem, identyfikujemy te same punkty i pokazujemy, jak zmienia się instalacja w czasie.">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <Reveal>
          <div className="card p-7">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-faint">LP-05 · Zs [Ω] · 4 serie pomiarowe</p>
              <span className="badge st-warn">trend +14,4%</span>
            </div>
            <svg viewBox="0 0 360 170" className="w-full mt-4" aria-hidden>
              {[0.2, 0.5, 0.8].map((f) => (
                <line key={f} x1="0" x2="360" y1={150 - f * 130} y2={150 - f * 130} stroke="#1c2a45" strokeWidth="1" />
              ))}
              <line x1="0" x2="360" y1={66} y2="66" stroke="#ff6473" strokeWidth="1.4" strokeDasharray="5 5" />
              <text x="352" y="60" textAnchor="end" fill="#ff6473" fontSize="9" fontFamily="var(--font-jetbrains)">limit 2,88 Ω</text>
              <path d="M20 96 C 90 90, 140 76, 200 62 S 310 36, 340 30" fill="none" stroke="#45e0ff" strokeWidth="2.6" strokeLinecap="round" className="anim-sine" />
              {[[20, 96], [127, 78], [233, 50], [340, 30]].map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r={i === 3 ? 5 : 4} fill={i === 3 ? "#ff6473" : "#45e0ff"} />
                  <text x={x} y="166" textAnchor="middle" fill="#5c6d89" fontSize="9" fontFamily="var(--font-jetbrains)">{2023 + i}</text>
                </g>
              ))}
            </svg>
            <p className="mt-3 text-[12px] leading-relaxed text-dim">Impedancja rośnie z badania na badanie — w 2026 przekracza limit. Bez historii ten trend byłby niewidoczny. <span className="text-faint">(wykres: dane demonstracyjne)</span></p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <FeatureList
            items={[
              ["Powiązanie z obiektem", "Raporty grupujemy po obiekcie — żadnego szukania protokołów po dyskach."],
              ["Te same punkty, kolejne lata", "System rozpoznaje punkty pomiarowe między badaniami i zestawia wyniki."],
              ["Wykrywanie zmian", "Automatyczne podsumowanie: stabilne, rosnące, niepokojące trendy."],
              ["Uczciwe prognozy", "Prognoza tylko przy ≥ 3 porównywalnych seriach — zawsze z opisem ograniczeń modelu."],
            ]}
          />
        </Reveal>
      </div>
    </Section>
  );
}

/* ========================= 8 · CENNIK ========================= */

export function PricingSection() {
  return (
    <Section
      id="cennik"
      kicker="Cennik"
      title="Płacisz za raporty, nie za abonament"
      lead="Proste pakiety ilościowe — kupujesz tyle raportów, ile potrzebujesz. Bez subskrypcji, bez cyklicznych obciążeń. Każdy pakiet ważny 12 miesięcy od zakupu."
    >
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        {PLANS.map((p, i) => {
          const per = pricePerReport(p);
          return (
            <Reveal key={p.id} delay={i * 70} className="h-full">
              <div className={`card h-full p-6 flex flex-col relative ${p.highlighted ? "!border-flame/55 shadow-flame" : "card-hover"}`}>
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge !bg-flame/15 !text-flame !border-flame/55">
                    {p.badge}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-[16px] tracking-wide">{p.name}</h3>
                  <span className="font-mono text-[9px] text-faint uppercase">0{i + 1}</span>
                </div>
                <p className="text-[12px] text-faint mt-1">{p.tagline}</p>

                <p className="mt-5 flex items-end gap-1.5">
                  <span className="font-display font-bold text-[32px] text-mist leading-none">{formatPlanPrice(p)}</span>
                  {p.pricePLN > 0 && <span className="text-[12px] text-faint mb-1">jednorazowo</span>}
                </p>

                <p className="text-[13px] text-volt mt-2 font-mono font-semibold">
                  {p.reportsIncluded} {p.reportsIncluded === 1 ? "raport" : "raportów"}
                </p>
                <p className="text-[11px] text-faint font-mono mt-0.5">
                  {per ? `${per} · ważność ${p.validityMonths} mies.` : `ważność ${p.validityMonths} mies. · tylko raz na konto`}
                </p>

                <ul className="mt-5 space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-[12.5px] text-dim">
                      <Check size={14} className="text-volt shrink-0 mt-0.5" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.id === "START" ? "/rejestracja" : `/rejestracja?plan=${p.id}`}
                  className={`btn mt-6 ${p.highlighted ? "btn-primary" : "btn-ghost"} btn-sm w-full`}
                >
                  {p.cta}
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={180}>
        <div className="mt-7 grid sm:grid-cols-3 gap-4">
          {[
            [Wallet, "Bez abonamentu", "Jednorazowy zakup pakietu — żadnych cyklicznych obciążeń karty."],
            [CalendarClock, "Ważność 12 miesięcy", "Niewykorzystane raporty wygasają po roku od zakupu pakietu."],
            [Layers, "Pakiety się sumują", "Dokupienie kolejnego pakietu powiększa pulę dostępnych raportów."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Wallet;
            return (
              <div key={t as string} className="hairline rounded-xl px-5 py-4 bg-panel/50">
                <I size={16} className="text-volt" aria-hidden />
                <p className="text-[13.5px] text-mist font-semibold mt-2.5">{t as string}</p>
                <p className="text-[12px] text-dim leading-relaxed mt-1">{d as string}</p>
              </div>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={220}>
        <p className="mt-6 text-center text-[12px] text-faint font-mono">
          Płatności realizowane przez bezpieczną integrację serwerową · historia transakcji w panelu
        </p>
      </Reveal>
    </Section>
  );
}

/* ========================= 9 · FAQ ========================= */

const FAQ: [string, string][] = [
  ["Czy raport z DiagoLAB zastępuje protokół pomiarowy?", "Raport porządkuje wyniki, liczy limity i dokumentuje ocenę, ale nie zastępuje kwalifikacji wykonawcy. Każdy raport wymaga zatwierdzenia przez osobę wykonującą badania — system to narzędzie wspomagające, nie automat wydający dokumenty."],
  ["Jakie formaty plików obsługujecie?", "Obecnie CSV i XLSX (z automatycznym mapowaniem kolumn i normalizacją jednostek). PDF, TXT i JSON są na roadmapie — obsługę formatów wdrażamy etapami, zaczynając od najczęstszych w pracy terenowej."],
  ["Czy AI może zmienić moje wyniki lub ocenę?", "Nie. Moduł AI (Moduł B) tworzy wyłącznie opisy, podsumowania i propozycje zaleceń. Nie ma dostępu do zmiany wyników, nie wymyśla pomiarów i nie potwierdza bezpieczeństwa instalacji. Każdą propozycję możesz edytować, zaakceptować lub odrzucić z uzasadnieniem."],
  ["Jak chronione są moje dane i raporty?", "HTTPS, bezpieczne sesje, kontrola uprawnień po stronie serwera, walidacja i limity plików, logi audytowe oraz zgodność z RODO. Pliki i raporty nie są publicznie dostępne bez autoryzacji właściciela konta."],
  ["Jak działa darmowy raport?", "Rejestrujesz konto, potwierdzasz e-mail i numer telefonu kodem SMS, uzupełniasz profil instalatora, przesyłasz plik z wynikami i generujesz jeden pełny raport — bez karty płatniczej. Wykorzystanie darmowego raportu jest zapisywane; system ma zabezpieczenia przed nadużyciami."],
  ["Czy mogę zrezygnować z abonamentu?", "Tak, w każdej chwili z poziomu panelu. Raporty już wygenerowane pozostają w Twoim archiwum zgodnie z warunkami przechowywania danych."],
];

export function FaqSection() {
  return (
    <Section id="faq" kicker="Pytania" title="Najczęstsze pytania" lead="">
      <div className="grid lg:grid-cols-2 gap-4 max-w-5xl">
        {FAQ.map(([q, a], i) => (
          <Reveal key={q} delay={(i % 2) * 80}>
            <details className="faq">
              <summary>
                {q}
                <Plus size={17} className="plus" aria-hidden />
              </summary>
              <div className="faq-body">{a}</div>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ========================= 10 · REJESTRACJA CTA ========================= */

export function RegisterCta() {
  const steps = [
    "Rejestracja konta",
    "Potwierdzenie e-maila",
    "Kod SMS na telefon",
    "Profil instalatora",
    "Przesłanie pliku",
    "Gotowy raport",
  ];
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-24">
        <Reveal>
          <div className="card relative overflow-hidden !rounded-3xl px-7 md:px-14 py-14 text-center">
            <div className="absolute inset-0 bg-blueprint opacity-60" aria-hidden />
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[420px] glow-volt pointer-events-none" aria-hidden />
            <div className="relative">
              <p className="kicker">{BRAND.promise}</p>
              <h2 className="display-1 text-[clamp(30px,4vw,48px)] mt-4">
                Twój pierwszy inteligentny raport <span className="text-grad-volt">jest gratis.</span>
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-2.5">
                {steps.map((s, i) => (
                  <span key={s} className="chip !py-2 !px-3.5">
                    <span className="num-mono text-volt">{String(i + 1).padStart(2, "0")}</span> {s}
                  </span>
                ))}
              </div>
              <Link href="/rejestracja" className="btn btn-primary btn-thermo mt-9 text-[15px] !px-9 !py-4">
                Wygeneruj pierwszy raport gratis <ArrowRight size={17} aria-hidden />
              </Link>
              <p className="mt-4 text-[12.5px] text-faint font-mono">Bez karty płatniczej. Jeden pełny raport gratis.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ========================= wspólne ========================= */

function Section({
  id, kicker, title, lead, children,
}: {
  id?: string; kicker: string; title: string; lead: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="relative border-t border-line">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-20 lg:py-24">
        <Reveal>
          <p className="kicker">{kicker}</p>
          <h2 className="display-1 text-[clamp(26px,3.4vw,40px)] mt-4 max-w-3xl">{title}</h2>
          {lead && <p className="mt-4 text-[15px] leading-relaxed text-dim max-w-2xl">{lead}</p>}
        </Reveal>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

function FeatureList({ items }: { items: [string, string][] }) {
  return (
    <ul className="space-y-6">
      {items.map(([t, d], i) => (
        <Reveal as="li" key={t} delay={i * 80} className="flex gap-4">
          <span className="mt-1 grid place-items-center w-8 h-8 rounded-lg border border-volt/40 bg-volt/10 shrink-0">
            <Zap size={14} className="text-volt" aria-hidden />
          </span>
          <div>
            <h3 className="font-display font-semibold text-[15px]">{t}</h3>
            <p className="text-[13.5px] text-dim leading-relaxed mt-1.5">{d}</p>
          </div>
        </Reveal>
      ))}
    </ul>
  );
}
