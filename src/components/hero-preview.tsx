"use client";

/**
 * Animowany podgląd przykładowego raportu (sekcja HERO).
 * Pokazuje produkt w działaniu — bez zdjęć stockowych.
 * Dane w podglądu są demonstracyjne.
 */

import { useRef, useState, type CSSProperties } from "react";
import { FileText, ShieldCheck, FileDown, TrendingUp } from "lucide-react";
import { CountUp, useReducedMotion } from "@/components/motion";

const BARS = [
  { code: "LP-01", v: 0.42, lim: 0.72, st: "#1e8e4f" },
  { code: "LP-02", v: 0.58, lim: 0.72, st: "#1e8e4f" },
  { code: "LP-03", v: 1.94, lim: 2.88, st: "#1e8e4f" },
  { code: "LP-04", v: 2.12, lim: 2.88, st: "#1e8e4f" },
  { code: "LP-05", v: 3.41, lim: 2.88, st: "#c62828" },
  { code: "LP-06", v: 1.18, lim: 4.6, st: "#e67700" },
  { code: "LP-07", v: 2.36, lim: 2.88, st: "#1e8e4f" },
  { code: "LP-08", v: 1.42, lim: 4.6, st: "#1e8e4f" },
];

const ROWS = [
  ["LP-03", "Strefa A — gniazda 230V", "B16 · RCD 30mA", "1,94 Ω", "OK", "st-ok"],
  ["LP-05", "Lakiernia — kompresor", "B16 · RCD 30mA", "3,41 Ω", "KRYTYCZNE", "st-crit"],
  ["LP-06", "Oświetlenie LED", "B10 · RCD 30mA", "254 ms", "OSTRZEŻENIE", "st-warn"],
] as const;

export function HeroReportPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<CSSProperties>({});
  const reduced = useReducedMotion();

  const onMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ transform: `perspective(1400px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)` });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({})}
      className="relative transition-transform duration-300 ease-out will-change-transform"
      style={tilt}
      aria-label="Podgląd przykładowego raportu (dane demonstracyjne)"
    >
      {/* rama raportu */}
      <div className="relative card overflow-hidden !rounded-2xl">
        {/* pasek tytułu */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 hairline-b">
          <span className="w-2.5 h-2.5 rounded-full bg-crit/70" aria-hidden />
          <span className="w-2.5 h-2.5 rounded-full bg-amp/70" aria-hidden />
          <span className="w-2.5 h-2.5 rounded-full bg-ok/70" aria-hidden />
          <span className="ml-2 font-mono text-[10px] tracking-[0.18em] text-faint uppercase flex items-center gap-2">
            <FileText size={11} aria-hidden /> DLR/2026/0114-DEMO · raport interaktywny
          </span>
          <span className="ml-auto badge st-warn">DEMO</span>
        </div>

        <div className="relative p-5 md:p-6">
          {/* skaner */}
          <div className="absolute left-5 right-5 top-0 h-8 anim-scan pointer-events-none" aria-hidden>
            <div className="h-full w-full rounded bg-gradient-to-b from-transparent via-volt/10 to-transparent border-b border-volt/40" />
          </div>

          {/* KPI */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { n: 12, l: "Punktów", c: "#45e0ff" },
              { n: 9, l: "OK", c: "#49dd8a" },
              { n: 2, l: "Ostrzeżenia", c: "#ffb224" },
              { n: 1, l: "Krytyczne", c: "#ff6473" },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-line bg-abyss/80 px-3 py-3">
                <div className="font-display font-bold text-[22px] leading-none" style={{ color: k.c }}>
                  <CountUp value={k.n} />
                </div>
                <div className="font-mono text-[8.5px] tracking-[0.18em] uppercase text-faint mt-1.5">{k.l}</div>
              </div>
            ))}
          </div>

          {/* mini wykres Zs */}
          <div className="mt-4 rounded-xl border border-line bg-abyss/80 p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-faint">Impedancja pętli zwarcia vs limit</p>
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-volt">
                <span className="inline-block w-4 border-t border-dashed border-volt" aria-hidden /> limit Zs
              </span>
            </div>
            <svg viewBox="0 0 320 120" className="w-full mt-2" aria-hidden>
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <line key={f} x1="0" x2="320" y1={110 - f * 100} y2={110 - f * 100} stroke="#dce3ed" strokeWidth="1" />
              ))}
              {BARS.map((b, i) => {
                const x = 8 + i * 39;
                const h = (b.v / 5) * 100;
                const limY = 110 - (b.lim / 5) * 100;
                return (
                  <g key={b.code}>
                    <line x1={x - 3} x2={x + 26} y1={limY} y2={limY} stroke="#1a5fb4" strokeWidth="1.4" strokeDasharray="4 4" />
                    <rect
                      x={x} y={110 - h} width="20" height={Math.max(h, 2)}
                      rx="3" fill={`${b.st}55`} stroke={b.st} strokeWidth="1.4"
                      className="anim-bar" style={{ animationDelay: `${0.3 + i * 0.09}s`, transformBox: "fill-box" }}
                    />
                    <text x={x + 10} y="119" textAnchor="middle" fill="#5c6d89" fontSize="7" fontFamily="var(--font-jetbrains)">{b.code}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* mini tabela */}
          <div className="mt-4 rounded-xl border border-line bg-abyss/80 divide-y divide-line overflow-hidden">
            {ROWS.map(([code, loc, prot, val, st, cls], i) => (
              <div key={code} className="reveal flex items-center gap-3 px-4 py-2.5" style={{ ["--reveal-delay" as string]: `${600 + i * 150}ms` }}>
                <span className="font-mono text-[10.5px] text-volt font-semibold">{code}</span>
                <span className="text-[11px] text-dim truncate flex-1">{loc}</span>
                <span className="font-mono text-[9.5px] text-faint hidden sm:block">{prot}</span>
                <span className="font-mono text-[10.5px] text-mist">{val}</span>
                <span className={`badge ${cls} !text-[8.5px] !px-2 !py-1`}>{st}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="font-mono text-[9px] tracking-[0.14em] text-faint uppercase">SHA-256: 8f2c…e91a · silnik v1.3.2</p>
            <p className="font-mono text-[9px] tracking-[0.14em] text-faint uppercase">PN-HD 60364-6</p>
          </div>
        </div>
      </div>

      {/* pływające chipy */}
      <div className="absolute -left-4 md:-left-10 top-16 anim-float no-print" style={{ animationDelay: "0.4s" }} aria-hidden>
        <div className="glass hairline rounded-xl px-4 py-3 flex items-center gap-2.5 shadow-panel">
          <ShieldCheck size={15} className="text-ok" />
          <div>
            <p className="text-[11px] font-semibold text-mist leading-none">Kryteria zweryfikowane</p>
            <p className="font-mono text-[9px] text-faint mt-1">Moduł A · deterministyczny</p>
          </div>
        </div>
      </div>
      <div className="absolute -right-3 md:-right-8 top-40 anim-float no-print" style={{ animationDelay: "1.3s" }} aria-hidden>
        <div className="glass hairline rounded-xl px-4 py-3 flex items-center gap-2.5 shadow-panel">
          <FileDown size={15} className="text-volt" />
          <div>
            <p className="text-[11px] font-semibold text-mist leading-none">PDF A4 gotowy</p>
            <p className="font-mono text-[9px] text-faint mt-1">strona tytułowa · QR · strony</p>
          </div>
        </div>
      </div>
      <div className="absolute -left-2 md:-left-6 bottom-10 anim-float no-print" style={{ animationDelay: "2.1s" }} aria-hidden>
        <div className="glass hairline rounded-xl px-4 py-3 flex items-center gap-2.5 shadow-panel">
          <TrendingUp size={15} className="text-amp" />
          <div>
            <p className="text-[11px] font-semibold text-mist leading-none">Smart Compare+</p>
            <p className="font-mono text-[9px] text-faint mt-1">trend 2023→2026 wykryty</p>
          </div>
        </div>
      </div>
    </div>
  );
}
