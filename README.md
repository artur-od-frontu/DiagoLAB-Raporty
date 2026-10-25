# DiagoLAB Raporty+

**Inteligentna platforma raportowania pomiarów elektrycznych.**

> Od wyników pomiarów do profesjonalnego raportu.

DiagoLAB Raporty+ przetwarza wyniki pomiarów instalacji elektrycznych, waliduje dane, porównuje je z kryteriami, wskazuje nieprawidłowości, prezentuje historię obiektu i generuje interaktywny raport oraz profesjonalny PDF A4.

System wspomaga pracę osoby wykonującej badania, ale jej nie zastępuje. Każda ocena końcowa wymaga świadomego zatwierdzenia przez wykonawcę.

---

## Najważniejsze funkcje

### Raporty

- interaktywny raport diagnostyczny,
- tabela wyników z wyszukiwaniem, filtrowaniem i sortowaniem,
- wykresy Chart.js z wartościami granicznymi,
- kategorie: `OK`, `OSTRZEŻENIE`, `KRYTYCZNE`, `BRAK DANYCH`,
- edycja, akceptacja i odrzucanie zaleceń,
- historia decyzji i zatwierdzeń,
- skrót integralności SHA-256,
- podpis wykonawcy z właściwym zastrzeżeniem prawnym,
- publiczny podgląd tylko do odczytu zabezpieczony tokenem HMAC.

### PDF

- generowanie po stronie serwera przez Playwright i Chromium,
- profesjonalny układ A4,
- strona tytułowa i dane obiektu,
- wyniki, analiza, ostrzeżenia i zalecenia,
- wykresy wektorowe SVG,
- dane wykonawcy i logo jego firmy,
- numer raportu i numeracja stron,
- kod QR do raportu interaktywnego,
- hash SHA-256 danych źródłowych.

### Import danych

Obsługiwane formaty:

- CSV,
- XLSX.

Importer automatycznie:

1. rozpoznaje kolumny po ich nazwach i synonimach,
2. gdy nagłówków brakuje — analizuje wartości i ich rozkład,
3. wykrywa m.in. Zs, Riso, ciągłość PE, RCD, In oraz charakterystykę B/C/D,
4. prezentuje źródło i poziom pewności przypisania,
5. umożliwia ręczne nadpisanie każdego mapowania,
6. blokuje ocenę, jeśli brakuje danych krytycznych.

### Smart Compare+

- powiązanie raportów z obiektem,
- identyfikacja tych samych punktów pomiarowych,
- porównywanie kolejnych serii,
- wykrywanie zmian i trendów,
- prezentowanie ograniczeń modelu,
- prognoza tylko przy wystarczającej historii.

### Tryb terenowy

Strona `/teren` działa jako notatnik pomiarowy offline:

- zapisuje dane lokalnie w formacie JSON,
- automatycznie zapisuje każdą zmianę,
- działa bez połączenia z internetem dzięki Service Workerowi,
- wykonuje lokalną analizę tym samym silnikiem co wersja chmurowa,
- eksportuje i importuje JSON,
- eksportuje CSV zgodny z polskim Excelem,
- po odzyskaniu połączenia wysyła dane do raportu w chmurze.

### Konta i sesje

- rejestracja i logowanie,
- weryfikacja e-mail i telefonu,
- reset hasła,
- hasła zabezpieczone przez `scrypt`,
- token sesji przechowywany w bazie wyłącznie jako SHA-256,
- sesja aktywna typu sliding,
- ostrzeżenie po 5 minutach bezczynności,
- wznowienie aktywności zatrzymuje odliczanie,
- automatyczny zapis otwartych dokumentów jako wersje robocze przed wylogowaniem,
- blokada konta po nadmiernej liczbie błędnych logowań.

### Profil instalatora

- dane osobowe i firmowe,
- NIP i dane kontaktowe,
- numer oraz zakres kwalifikacji,
- termin ważności świadectwa,
- logo firmy w raportach HTML i PDF,
- dane profilu automatycznie uzupełniają kolejne raporty.

### Pakiety raportów

Platforma korzysta wyłącznie z pakietów ilościowych — bez abonamentu:

| Pakiet | Liczba raportów | Cena | Ważność |
|---|---:|---:|---:|
| START | 1 | 0 zł | 12 miesięcy, raz na konto |
| PAKIET 5 | 5 | 149 zł | 12 miesięcy |
| PAKIET 15 | 15 | 249 zł | 12 miesięcy |
| PAKIET 30 | 30 | 399 zł | 12 miesięcy |

Pakiety mogą się sumować. Raport jest pobierany najpierw z pakietu, który wygasa najwcześniej. Niewykorzystana pula przepada po 12 miesiącach.

---

## Stack technologiczny

### Aplikacja

- Next.js 16 — App Router,
- React 19,
- TypeScript,
- Tailwind CSS 4,
- Node.js 22.

### Dane

- PostgreSQL 16,
- Drizzle ORM,
- Drizzle Kit.

### Import i wizualizacja

- Papa Parse — CSV,
- SheetJS (`xlsx`) — XLSX,
- Chart.js — wykresy,
- Lucide — ikony,
- QRCode — kody QR.

### Raporty i jakość

- Playwright — generowanie PDF i testy E2E,
- Vitest — testy jednostkowe,
- GitHub Actions — CI.

---

## Architektura

```text
src/
├── app/
│   ├── api/                 # API: auth, raporty, profil, PDF, AI, płatności
│   ├── demo/                # raport demonstracyjny
│   ├── panel/               # panel instalatora
│   ├── r/[id]/              # publiczny podgląd raportu z tokenem
│   ├── rejestracja/         # kreator konta i profilu
│   ├── logowanie/           # logowanie i reset hasła
│   └── teren/               # tryb terenowy/offline
├── components/              # komponenty UI i raportu
├── config/                  # konfiguracja marki oraz cennika
├── db/                      # Drizzle: połączenie i schemat PostgreSQL
└── lib/
    ├── engine.ts            # deterministyczny silnik obliczeniowy
    ├── auth.ts              # sesje i bezpieczeństwo kont
    ├── pdf.ts               # kolejka i renderer Playwright
    ├── pdf-template.ts      # szablon PDF A4
    ├── report-payload.ts    # wspólny model HTML/PDF
    ├── share.ts             # tokeny HMAC publicznych linków
    └── session-timing.ts    # parametry sesji aktywnej

tests/e2e/                  # testy Playwright
.github/workflows/ci.yml    # pipeline CI
public/sw.js                # Service Worker trybu terenowego
```

### Podział odpowiedzialności

#### Moduł A — silnik obliczeniowy

`src/lib/engine.ts` jest izomorficzny i niezależny od warstwy UI. Odpowiada za:

- normalizację jednostek,
- walidację,
- obliczanie kryteriów,
- klasyfikację wyników,
- mapowanie kolumn,
- Smart Compare+,
- eksport CSV.

#### Moduł B — AI / narracja

`/api/ai-summary` odpowiada wyłącznie za opisy, podsumowania i propozycje zaleceń. Nie może zmieniać danych pomiarowych ani zatwierdzać bezpieczeństwa instalacji.

Bez `OPENAI_API_KEY` moduł działa w deterministycznym trybie regułowym.

---

## Wymagania lokalne

- Node.js 22,
- npm,
- PostgreSQL 16,
- Chromium i biblioteki systemowe Playwright do generowania PDF,
- Git.

---

## Uruchomienie lokalne

### 1. Klonowanie

```bash
git clone <URL_REPOZYTORIUM>
cd diagolab-raporty-plus
```

### 2. Zależności

```bash
npm ci
```

### 3. Konfiguracja środowiska

```bash
cp .env.example .env
```

Minimalna konfiguracja:

```dotenv
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/app_db
NEXT_PUBLIC_APP_URL=http://localhost:3000
SHARE_TOKEN_SECRET=wygenerowany-sekret-hmac
```

Sekret udostępniania wygeneruj np. poleceniem:

```bash
openssl rand -hex 32
```

### 4. Utworzenie bazy

Przykład dla lokalnego PostgreSQL:

```bash
createdb app_db
```

lub:

```bash
psql -U postgres -c "CREATE DATABASE app_db;"
```

### 5. Wgranie schematu

```bash
npx drizzle-kit push
```

### 6. Chromium do PDF i testów E2E

```bash
npx playwright install --with-deps chromium
```

Na Linuxie polecenie instaluje również biblioteki wymagane przez headless Chromium.

### 7. Start aplikacji

```bash
npm run dev
```

Aplikacja będzie dostępna pod adresem:

```text
http://localhost:3000
```

---

## Zmienne środowiskowe

| Zmienna | Wymagana | Opis |
|---|---:|---|
| `DATABASE_URL` | tak | połączenie z PostgreSQL |
| `NEXT_PUBLIC_APP_URL` | tak | publiczny URL aplikacji, linki i QR |
| `SHARE_TOKEN_SECRET` | produkcja | sekret HMAC publicznych linków raportów |
| `OPENAI_API_KEY` | nie | dostęp do Modułu B przez OpenAI API |
| `AI_MODEL` | nie | nazwa modelu, domyślnie `gpt-4o-mini` |
| `SMTP_URL` | nie | wysyłka kodów e-mail |
| `SMS_PROVIDER_KEY` | nie | wysyłka kodów SMS |
| `PAYMENTS_PROVIDER` | nie | identyfikator operatora płatności |
| `PAYMENTS_PROVIDER_KEY` | nie | klucz serwerowy operatora płatności |

Brak opcjonalnych integracji uruchamia jawnie oznaczony tryb deweloperski lub deterministyczny fallback.

Nigdy nie zapisuj sekretów w kodzie ani w plikach dostępnych dla przeglądarki. Plik `.env` jest ignorowany przez Git.

---

## Komendy

```bash
npm run dev          # serwer deweloperski
npm run build        # build produkcyjny
npm run start        # uruchomienie buildu produkcyjnego
npm run lint         # ESLint
npm run typecheck    # TypeScript bez emisji plików
```

Dodatkowe komendy jakości:

```bash
npx next typegen
npx vitest run
npx playwright test
npx drizzle-kit push
```

---

## Testy

### Jednostkowe

```bash
npx vitest run
```

Testy obejmują m.in.:

- jednostki i formaty liczbowe,
- kryteria Zs, Riso, RCD i ciągłości,
- automatyczne mapowanie kolumn,
- import bez nagłówków,
- Smart Compare+,
- sesje i hasła,
- cennik pakietów,
- tokeny udostępniania,
- szablon PDF i ochronę przed XSS,
- logo firmy w PDF.

### E2E

```bash
npx playwright test
```

Testy Playwright obejmują m.in.:

- landing page i cennik,
- nawigację reagującą na scroll,
- rejestrację i weryfikację konta,
- logowanie,
- raport demonstracyjny,
- filtrowanie i zatwierdzanie wyników,
- tryb terenowy i trwałość danych po przeładowaniu,
- generator PDF,
- ochronę publicznych linków raportów.

### Pełna walidacja przed commitem

```bash
npx next typegen
npm run typecheck
npx vitest run
npm run build
npx playwright test
```

---

## GitHub Actions

Workflow `.github/workflows/ci.yml` wykonuje:

1. `npm ci`,
2. generowanie typów Next.js,
3. kontrolę TypeScript,
4. testy Vitest,
5. build produkcyjny,
6. podstawowy skan sekretów,
7. uruchomienie PostgreSQL 16,
8. wgranie schematu Drizzle,
9. instalację Chromium,
10. testy Playwright,
11. zapis raportu testowego jako artefaktu przy błędzie.

Dla gałęzi `main` zalecane są:

- branch protection,
- wymagany pull request,
- co najmniej jeden review,
- wymagane zielone joby CI,
- zablokowany force-push.

---

## Baza danych

Najważniejsze tabele:

- `users` — konta i wykorzystanie raportu gratis,
- `sessions` — bezpieczne sesje aktywne,
- `verification_codes` — e-mail i SMS,
- `installer_profiles` — dane instalatora i logo,
- `clients` — klienci,
- `objects` — obiekty,
- `reports` — wspólny model raportu,
- `finding_decisions` — decyzje dotyczące ostrzeżeń,
- `measurement_history` — historia Smart Compare+,
- `subscriptions` — ilościowe pule raportów,
- `transactions` — historia płatności,
- `drafts` — wersje robocze,
- `audit_logs` — dziennik zdarzeń.

Mimo historycznej nazwy tabeli `subscriptions`, przechowuje ona obecnie jednorazowe, ilościowe pule raportów z terminem ważności — nie abonamenty cykliczne.

---

## Generator PDF

Endpointy:

```text
GET /api/demo/pdf
GET /api/reports/:id/pdf
```

Generator używa singletona Chromium i szeregowej kolejki zadań, aby nie uruchamiać wielu kosztownych procesów jednocześnie.

Jeśli Chromium lub jego biblioteki systemowe są niedostępne, API zwraca `503 PDF_RENDERER_UNAVAILABLE` zamiast pustego pliku.

Wdrożenie produkcyjne musi zawierać:

```bash
npx playwright install --with-deps chromium
```

lub równoważne zależności w obrazie Docker.

---

## Bezpieczeństwo

Zaimplementowane mechanizmy:

- `scrypt` dla haseł,
- hashowanie tokenów sesji SHA-256,
- cookies `httpOnly`, `sameSite=lax`, `secure` na produkcji,
- serwerowa kontrola dostępu i limitów,
- ochrona przed wielokrotnym darmowym raportem,
- blokada konta po błędnych logowaniach,
- walidacja plików i limity wielkości,
- wykrywanie faktycznego MIME logo,
- sanityzacja SVG,
- tokeny udostępniania HMAC i porównanie timing-safe,
- prywatne raporty i pliki źródłowe,
- logi audytowe,
- eksport i usuwanie danych zgodnie z RODO,
- escape danych użytkownika w PDF.

Przed produkcją należy dodatkowo skonfigurować:

- HTTPS,
- rotację sekretów,
- backup PostgreSQL,
- monitoring i alerty,
- rate limiting na poziomie reverse proxy lub infrastruktury,
- produkcyjne SMTP, SMS i operatora płatności,
- politykę retencji logów i dokumentów.

---

## Design system

Obecny design system jest oznaczony jako tymczasowy do momentu dostarczenia pełnych materiałów marki DiagoLAB Pomiary.

Aktualna identyfikacja:

- `Diago` — biały,
- `LAB` — ognisty pomarańcz `#ff6a1f`,
- `Raporty+` — elektryczny cyjan `#45e0ff`,
- wypełnione CTA — ognisty gradient z wolnym widmem UV/Thermo,
- animacje respektują `prefers-reduced-motion`,
- nawigacja staje się całkowicie nieprzezroczysta po rozpoczęciu scrollowania.

---

## Dane demonstracyjne

Dane na stronie `/demo` są jawnie oznaczone jako demonstracyjne i nie stanowią wyników rzeczywistych badań.

Przykładowy plik importu:

```text
public/samples/pomiary-przyklad.csv
```

---

## Ograniczenia i integracje wymagające konfiguracji

- Bez `OPENAI_API_KEY` analiza opisowa działa regułowo.
- Bez SMTP i dostawcy SMS kody są zwracane tylko w trybie deweloperskim.
- Bez operatora płatności zakup pakietów działa jako jawna symulacja DEV.
- PDF wymaga działającego headless Chromium.
- Import PDF/TXT/JSON oraz graficzny podpis wykonawcy pozostają kolejnymi etapami rozwoju.
- Podpis graficzny nie jest kwalifikowanym podpisem elektronicznym.

---

## Dokumentacja architektoniczna

Decyzje architektoniczne znajdują się w katalogu:

```text
docs/
```

Najważniejszy dokument:

```text
docs/ADR-001-stack-i-persystencja.md
```

---

## Licencja

Projekt jest prywatnym produktem DiagoLAB. Brak publicznej licencji oznacza, że kopiowanie, dystrybucja i wykorzystanie kodu bez zgody właściciela są zabronione.

---

## Informacja o odpowiedzialności

Raporty są przygotowywane z wykorzystaniem systemu DiagoLAB Raporty+. Wyniki pochodzą z danych przekazanych przez użytkownika. System wspomaga analizę, ale nie zastępuje kwalifikacji, wiedzy i oceny osoby wykonującej badania. Końcową ocenę zawsze zatwierdza wykonawca.
