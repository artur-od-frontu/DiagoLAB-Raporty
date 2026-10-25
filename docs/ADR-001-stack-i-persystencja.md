# ADR-001: Stack technologiczny i warstwa persystencji

**Status:** PROPONOWANE (rekomendacja zespołu) — decyzja finalna po stronie właściciela produktu
**Data:** 2026-10
**Kontekst:** DiagoLAB Raporty+ — platforma SaaS do raportowania pomiarów elektrycznych

---

## Rozważana alternatywa (wariant „from scratch")

| Element propozycji | Ocena dla tego produktu |
|---|---|
| HTML + CSS + JS + Vite (bez frameworka) | Koszt: reimplementacja SSR/SEO, routingu, ochrony tras; zysk głównie edukacyjny. Next produkuje na wyjściu dokładnie HTML/CSS/JS. |
| Node + Express (osobny backend) | Koszt: 2 procesy, CORS, cookie cross-site, 2 deploye. Next (Node) już dostarcza API, streaming i middleware w jednym procesie. |
| Baza na plikach JSON | **Odrzucone dla produkcji** — argumentacja poniżej. |
| Git + GitHub Actions (CI) | **Przyjęte** — `.github/workflows/ci.yml`. |
| Pełne testy (best practices) | **Przyjęte** — Vitest; plan: rozszerzenie o testy API i E2E (Playwright). |

## Dlaczego NIE plikowa baza JSON dla produkcji

1. **Wyścigi zapisu (lost update):** równoległe POST /api/reports nadpisuje się wzajemnie → limit „1 raport gratis" do ominięcia wielowątkowo; podważa model anty-nadużyciowy.
2. **Brak atomowości:** utworzenie raportu = 5 powiązanych zapisów (raport, klient, obiekt, subskrypcja, licznik). Awaria w połowie = trwała niespójność.
3. **Skala danych:** `measurement_history` (punkty × metryki × serie lat) wymusza pełny odczyt pliku przy każdym porównaniu Smart Compare+.
4. **Backup / RODO:** kasowanie konta i migawki w trakcie zapisu = ryzyko uszkodzenia bazy.
5. **Deployment:** drugi proces/instancja = druga, rozjechana baza; na serverless system plików może być nietrwały.
6. **Integralność:** SHA-256 chroni treść raportów, ale nie samą bazę.

**Pliki JSON pozostają właściwe dla:** konfiguracji (cennik: `src/config/brand.ts`), fixtures testowych, eksportu/importu (RODO: `/api/account/export`), wersji roboczych i ewentualnego przyszłego **trybu offline single-user** (tablet pomiarowca w terenie).

## Decyzja zespołu (rekomendacja)

**Opcja A — przyjęta jako kierunek:** pozostajemy przy Next.js (App Router) + PostgreSQL/Drizzle.
Uzasadnienie: obecny stack już dostarcza wszystko z wariantu „from scratch" poza edukacyjną frajdą, a ryzyko regresji kluczowej logiki (sesje czynne, wersje robocze, Smart Compare+) przy rewrite jest nieproporcjonalnie wysokie. Silnik analityczny (`src/lib/engine.ts`) celowo pozostaje **framework-agnostyczny i izomorficzny** — do przeniesienia w dowolne środowisko bez zmian.

**Opcja B (przyszłość, jeśli pojawią się klienci API — np. app DiagoLAB Pomiary):** czysty Express jako warstwa API obok webu, dzielący bazę i engine przez wspólny pakiet.

**Opcja C (rewrite Express+Vite+JSON):** wyłącznie jako osobny projekt edukacyjny w oddzielnym repozytorium.

## Konsekwencje

- Obowiązkowe bramy jakości w CI: typecheck → testy jednostkowe → build → skan sekretów.
- Każda zmiana silnika analitycznego wymaga aktualizacji testów w `src/lib/__tests__/`.
- Rozszerzenie testów: testy API (route handlers) i E2E krytycznych ścieżek (rejestracja → import → zatwierdzenie).
