import { NextRequest, NextResponse } from "next/server";
import { generateFileMapping } from "@/lib/ai-mapper";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nie przesłano żadnego pliku." }, { status: 400 });
    }

    // 1. Dekodowanie z uwzględnieniem polskich znaków (standard Windows-1250 z oprogramowania Sonel)
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder("windows-1250");
    const rawText = decoder.decode(arrayBuffer);
    
    const lines = rawText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) {
      return NextResponse.json({ error: "Przesłany plik jest pusty." }, { status: 400 });
    }

    // 2. Automatyczny detektor separatora (idiotproof)
    const separators = [";", ",", "\t"];
    const testBlock = lines.slice(0, 5).join("\n");
    let bestSeparator = ";";
    let maxCount = 0;

    separators.forEach(sep => {
      const count = (testBlock.match(new RegExp(`\\${sep}`, "g")) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestSeparator = sep;
      }
    });

    // 3. Odnalezienie pierwszej linii zawierającej faktyczne dane (pomijamy metadane nagłówka miernika)
    const dataLines = lines.filter(line => line.includes(bestSeparator));
    if (dataLines.length === 0) {
      return NextResponse.json({ error: "Nie udało się zidentyfikować struktury kolumn w pliku." }, { status: 400 });
    }

    // Parsujemy pierwszy poprawny wiersz jako próbkę
    const firstRowColumns = dataLines[0].split(bestSeparator).map(col => col.trim());
    const sampleObject: Record<string, string> = {};
    
    firstRowColumns.forEach((val, index) => {
      sampleObject[`col_${index}`] = val || "puste";
    });

    // 4. Wywołanie sztucznej inteligencji w celu stworzenia bezpiecznej mapy kolumn
    const aiMapping = await generateFileMapping(sampleObject);

    // Zwracamy do frontendu zarówno propozycję mapowania, jak i sparsowaną próbkę do podglądu w tabeli
    return NextResponse.json({
      separatorUsed: bestSeparator,
      sampleData: sampleObject,
      suggestedMapping: aiMapping.mapping
    });

  } catch (error) {
    console.error("Błąd podczas automatycznego importu pliku:", error);
    return NextResponse.json({ 
      error: "Wystąpił wewnętrzny błąd podczas walidacji pliku przez AI.",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
