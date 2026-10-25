import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.AI_MODEL || "gemini-3.6-flash";

if (!apiKey) {
  throw new Error("Brak zmiennej środowiskowej GEMINI_API_KEY w konfiguracji systemowej.");
}

// Inicjalizacja oficjalnego klienta Google AI
const ai = new GoogleGenerativeAI(apiKey);

export interface MappingResult {
  mapping: {
    locationName: string | null;
    pointId: string | null;
    pointName: string | null;
    measurementType: string | null;
    mainValue: string | null;
    unit: string | null;
  };
}

/**
 * Przesyła próbkę danych z pliku do Gemini w celu automatycznego wykrycia mapowania kolumn
 */
export async function generateFileMapping(sampleData: Record<string, string>): Promise<MappingResult> {
  const prompt = `
    Jesteś precyzyjnym systemem mapowania baz danych dla plików z mierników elektrycznych Sonel.
    Twoim zadaniem jest przypisanie indeksów kolumn z pliku (np. "col_0", "col_1") do wewnętrznych kluczy bazy danych.

    NASZ DOCELOWY SCHEMAT BAZY DANYCH:
    - "locationName" (Nazwa obiektu, budynku lub pomieszczenia)
    - "pointId" (Identyfikator/numer punktu pomiarowego np. 101, 202 - jeśli istnieje)
    - "pointName" (Nazwa punktu pomiarowego, gniazda, wyłącznika)
    - "measurementType" (Rodzaj pomiaru, np. pętla zwarcia, RCD, izolacja, ciągłość)
    - "mainValue" (Główny wynik liczbowy pomiaru, np. 0.22, 500, >2000)
    - "unit" (Jednostka miary, np. Ohm, MOhm, ms, V)

    ANALIZOWANA PRÓBKA DANYCH Z PIERWSZEGO WIERSZA PLIKU:
    ${JSON.stringify(sampleData, null, 2)}

    ZASADY ANALIZY:
    1. Dopasuj klucz bazy danych do odpowiedniej "col_X" na podstawie analizy wartości próbki.
    2. Jeśli kolumna z próbki zawiera wartości takie jak "Ohm", "MOhm", "ms", to MUSI być to "unit".
    3. Jeśli kolumna zawiera wartości liczbowe z kropką/przecinkiem (np. 0.22, 500, 22), to jest to "mainValue".
    4. Jeśli dana kolumna z bazy nie ma odpowiednika w pliku, ustaw dla niej wartość null.

    ZWRÓĆ WYŁĄCZNIE CZYSTY OBIEKT JSON ZGODNY Z FORMATEM SYSTEMOWYM. NIE DODAWAJ ŻADNEGO TEKSTU, WSTĘPU ANI OZNACZEŃ MARCDOWN (BRAK \`\`\`json).
  `;

  const model = ai.getGenerativeModel({
    model: modelName,
    // Wymuszenie zwrócenia strukturyzowanego obiektu JSON przez Gemini
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent(prompt);

  const responseText = result.response.text();
  if (!responseText) {
    throw new Error("Model Gemini zwrócił pustą odpowiedź.");
  }

  return JSON.parse(responseText) as MappingResult;
}