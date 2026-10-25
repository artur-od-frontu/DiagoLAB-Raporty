import { NextResponse } from "next/server";
import type { AnalysisResult } from "@/lib/engine";

export const runtime = "nodejs";

/**
 * MODUŁ B — AI DiagoLAB. Asysta techniczna dla osoby wykonującej pomiary.
 *
 * ZASADY BEZWZGLĘDNE (AI nie może ich naruszać):
 * 1. Opisuje WYŁĄCZNIE liczby i fakty z dostarczonego JSON.
 * 2. Nie wymyśla wyników, nie uzupełnia brakujących danych z wyobraźni.
 * 3. Nie potwierdza bezpieczeństwa instalacji — to wyłączna kompetencja
 *    wykonawcy posiadającego uprawnienia SEP.
 * 4. Wszelkie opisy AI wymagają weryfikacji przez wykonawcę.
 * 5. Każda odpowiedź kończy zastrzeżeniem o odpowiedzialności wykonawcy.
 * 6. AI NIE jest stroną w ocenie — jest asystentem przygotowującym materiał.
 *
 * CO AI ROBI DOBRZE:
 * - Objaśnia co dany wynik oznacza fizycznie i eksploatacyjnie.
 * - Wskazuje możliwe przyczyny odchyleń (nie diagnozuje definitywnie).
 * - Proponuje kolejność i kierunek działań naprawczych.
 * - Tłumaczy kryteria normatywne prostym językiem.
 * - Porównuje wyniki w kontekście historii obiektu.
 * - Pomaga sformułować zalecenia do raportu.
 */

const SYSTEM_PROMPT = `Używasz roli: Ekspert ds. weryfikacji i certyfikacji instalacji elektrycznych, audytor systemów elektroenergetycznych współpracujący ze Stowarzyszeniem Elektryków Polskich (SEP).

Działasz w systemie DiagoLAB Raporty+ w trybie "Human-in-the-loop" — Twoje teksty będą weryfikowane przez uprawnionego pomiarowca (E+D).

Jesteś specjalistycznym asystentem technicznym systemu DiagoLAB Raporty+ dla elektryków i instalatorów posiadających uprawnienia SEP.

Twoja rola: przygotowanie materiału pomocniczego do raportu — NIE wydawanie oceny końcowej.

BEZWZGLĘDNE ZASADY:
1. Opisujesz WYŁĄCZNIE dane z dostarczonego JSON. Żadnych wyników z głowy.
2. Nie potwierdzasz bezpieczeństwa instalacji. Nie piszesz "instalacja jest bezpieczna".
3. Nie uzupełniasz brakujących pomiarów domysłami. Brak danych = brak oceny.
4. Zawsze kończysz zastrzeżeniem o odpowiedzialności wykonawcy.
5. Jeśli wyniki są niepełne — mówisz o tym wprost i nie oceniasz fragmentu jako całości.

CO WOLNO CI ROBIĆ:
- Opisywać co dany wynik Zs/Riso/ciągłość/RCD oznacza eksploatacyjnie i fizycznie.
- Wyjaśniać jakie fizyczne przyczyny najczęściej prowadzą do danego odchylenia (np. utlenione styki, luźne zaciski, starzenie izolacji).
- Sugerować kolejność działań naprawczych (rewizja połączeń, wymiana aparatu, doposażenie rozdzielnicy).
- Tłumaczyć kryteria normowe (PN-HD 60364, SEP-E-004) prostym językiem.
- Przywołać odpowiedni arkusz normy (np. PN-HD 60364-7-701 dla łazienek).
- Zwracać uwagę na kombinacje wyników, które łącznie mogą być istotne.
- Informować o czym wykonawca powinien pamiętać przy kolejnym pomiarze.
- Klasyfikować usterki na: 🔴 PILNE (zagrożenie życia), 🟡 DO NAPRAWY (niezgodność), 🔵 SUGESTIA (dobra praktyka SEP).

FORMAT ODPOWIEDZI (generuj WYŁĄCZNIE ten format):
Dla KAŻDEJ usterki osobno:

**Nieprawidłowość:** [Precyzyjny opis problemu. Numer obwodu, zmierzona wartość, wartość dopuszczalna wg norm. Fizyczna i normatywna przyczyna odrzucenia.]

**Zalecenie / Sugestia:** [Praktyczna porada inżynierska. Potencjalne przyczyny usterki + kroki naprawcze + arkusz normy.]

Po opisie usterek dodaj jedno zdanie podsumowujące.

STYL: Rygorystyczny, techniczny, bezosobowy język inżynierski (np. "Stwierdzono...", "Zaleca się...", "Należy dokonać..."). Kategorycznie unikaj zwrotów potocznych i form osobowych. Max 500 tokenów.`;

function rulesFallback(a: AnalysisResult): string {
  const { summary, findings } = a;
  const crit = findings.filter((f) => f.category === "KRYTYCZNE");
  const warn = findings.filter((f) => f.category === "OSTRZEŻENIE");
  const miss = summary.missing > 0;

  let p1 = `Oceniono ${summary.total} punktów pomiarowych. `;
  if (crit.length) {
    p1 += `Wykryto ${summary.critical} wynik${summary.critical > 1 ? "i" : ""} poza kryteriami bezpieczeństwa: `;
    p1 += crit.map((f) => `${f.parameter} w punkcie ${f.pointCode}`).join("; ") + ".";
  } else if (warn.length) {
    p1 += `Wszystkie wyniki mieszczą się w granicach normatywnych. `;
    p1 += `${summary.warning} wynik${summary.warning > 1 ? "i" : ""} w strefie ostrzegawczej wymagają obserwacji.`;
  } else {
    p1 += `Wszystkie zmierzone parametry spełniają kryteria normatywne (PN-HD 60364-6:2016).`;
  }

  let p2 = "";
  if (crit.length) {
    const first = crit[0];
    p2 = `Wynik krytyczny ${first.pointCode} (${first.parameter}) wskazuje na możliwość nieprawidłowego działania zabezpieczenia — obwód należy wyłączyć z eksploatacji do czasu usunięcia przyczyny i wykonania pomiaru kontrolnego. `;
    p2 += `Proponowane działania opisano w sekcji zaleceń.`;
  } else if (warn.length) {
    p2 = `Wyniki w strefie ostrzegawczej: ${warn.map((f) => `${f.pointCode} (${f.parameter.toLowerCase()})`).join(", ")}. `;
    p2 += `Zaleca się zaplanowanie kontrolnego pomiaru przy najbliższej okazji serwisowej — przekroczenie progu docelowo może wymagać interwencji.`;
  }

  if (miss) {
    p2 += (p2 ? " " : "") + `Uwaga: ${summary.missing} punkt${summary.missing > 1 ? "ów" : ""} posiada niekompletne dane pomiarowe — ocena tych obwodów jest niemożliwa do czasu uzupełnienia zakresu badań.`;
  }

  const p3 = "Powyższy opis ma charakter pomocniczy i wymaga weryfikacji przez wykonawcę badań posiadającego uprawnienia SEP. Ocenę końcową wystawia i zatwierdza wyłącznie wykonawca odpowiedzialny za przeprowadzone pomiary.";
  return [p1, p2, p3].filter(Boolean).join("\n\n");
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
    // Kompaktowy zapis dla AI — tylko istotne fakty, nie surowe dane
    const compact = {
      łączna_liczba_punktów: analysis.summary.total,
      wyniki_ok: analysis.summary.ok,
      ostrzeżenia: analysis.summary.warning,
      krytyczne: analysis.summary.critical,
      niekompletne: analysis.summary.missing,
      punkty_z_rcd: analysis.summary.rcdProtected,
      kryteria: analysis.criteriaSet,
      ustalenia: analysis.findings.map((f) => ({
        kategoria: f.category,
        punkt: f.pointCode,
        parametr: f.parameter,
        wynik: f.result,
        kryterium: f.criterion,
      })),
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? "gpt-4o-mini",
        temperature: 0.25,     // niska temperatura = bardziej deterministyczne, techniczne odpowiedzi
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              "Przygotuj materiał pomocniczy do raportu pomiarowego dla wykonawcy.",
              "Dane z silnika analitycznego DiagoLAB (PN-HD 60364-6:2016):",
              JSON.stringify(compact, null, 2),
            ].join("\n\n"),
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("pusta odpowiedź AI");

    return NextResponse.json({ text, mode: "ai" });
  } catch {
    // Awaria AI → deterministyczny fallback (raport nadal działa)
    return NextResponse.json({ text: rulesFallback(analysis), mode: "rules" });
  }
}
