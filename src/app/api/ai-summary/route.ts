import { NextResponse } from "next/server";
import type { AnalysisResult } from "@/lib/engine";

export const runtime = "nodejs";

/**
 * MODUŁ B — AI. Generuje wyłącznie narrację nad wynikami dostarczonymi
 * przez Moduł A. AI nie może tworzyć wyników ani potwierdzać bezpieczeństwa.
 *
 * Klucz API jest wyłącznie po stronie serwera (process.env.OPENAI_API_KEY).
 * Bez klucza endpoint zwraca tryb "rules" — deterministyczne podsumowanie.
 */

const SYSTEM_PROMPT = `Jesteś asystentem technicznym systemu DiagoLAB Raporty+ do analizy pomiarów instalacji elektrycznych (PN-HD 60364-6).
ZASADY BEZWZGLĘDNE:
1. Opisujesz WYŁĄCZNIE liczby i fakty z dostarczonego JSON. Nie wolno Ci wymyślać wyników, punktów ani przyczyn.
2. Nie potwierdzasz bezpieczeństwa instalacji i nie wydajesz oceny końcowej — to robi wykonawca.
3. Pisz po polsku, rzeczowo, max 3 akapity. Możesz wskazać kontekst techniczny i typowe działania naprawcze jako propozycje.
4. Kończysz zdaniem przypominającym, że ocenę zatwierdza wykonawca badań.`;

function rulesFallback(a: AnalysisResult): string {
  const { summary, findings } = a;
  const crit = findings.filter((f) => f.category === "KRYTYCZNE");
  const warn = findings.filter((f) => f.category === "OSTRZEŻENIE");
  const p1 = `Zbadano ${summary.total} punktów pomiarowych. Wyniki spełniające kryteria: ${summary.ok}, ostrzeżenia: ${summary.warning}, nieprawidłowości krytyczne: ${summary.critical}${summary.missing ? `, punkty z niekompletnymi danymi: ${summary.missing}` : ""}.`;
  const p2 = crit.length
    ? `Najważniejsze ustalenie: ${crit.map((f) => `${f.parameter} w punkcie ${f.pointCode} (${f.result})`).join("; ")}. Takie wyniki wymagają usunięcia przyczyny i powtórzenia pomiaru przed dopuszczeniem obwodu do eksploatacji.`
    : `Nie stwierdzono wyników poza kryteriami bezpieczeństwa. ${warn.length ? "Wartości w strefie ostrzegawczej warto skontrolować przy kolejnym badaniu okresowym." : ""}`;
  const p3 = warn.length
    ? `Strefa ostrzegawcza dotyczy: ${warn.map((f) => `${f.pointCode} — ${f.parameter.toLowerCase()}`).join("; ")}. Zalecane działania opisano w sekcji G raportu. Końcową ocenę po weryfikacji danych zatwierdza wykonawca badań.`
    : `Szczegółowe kryteria podano przy każdym punkcie pomiarowym. Końcową ocenę po weryfikacji danych zatwierdza wykonawca badań.`;
  return [p1, p2, p3].join("\n\n");
}

export async function POST(req: Request) {
  let analysis: AnalysisResult;
  try {
    const body = (await req.json()) as { analysis?: AnalysisResult };
    if (!body.analysis?.summary) throw new Error("bad payload");
    analysis = body.analysis;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane wejściowe." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ text: rulesFallback(analysis), mode: "rules" });
  }

  try {
    const compact = {
      podsumowanie: analysis.summary,
      ustalenia: analysis.findings.map((f) => ({
        kategoria: f.category, punkt: f.pointCode, parametr: f.parameter, wynik: f.result,
      })),
      kryteria: analysis.criteriaSet,
    };
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 420,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(compact) },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("pusta odpowiedź AI");
    return NextResponse.json({ text, mode: "ai" });
  } catch {
    // Awaria AI nie blokuje raportu — deterministyczny fallback.
    return NextResponse.json({ text: rulesFallback(analysis), mode: "rules" });
  }
}
