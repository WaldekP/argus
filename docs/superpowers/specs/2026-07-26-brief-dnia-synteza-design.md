# Brief dnia (synteza) — projekt

Data: 2026-07-26. Status: zatwierdzony przez usera, gotowy do implementacji.

## Cel

Codzienny, syntetyczny przegląd tego, co wydarzyło się w polskiej polityce,
**pod kątem strategii Ryszarda Petru** (elektoraty docelowe, budowa nowej partii
wolnościowo-liberalnej). Jeden brief na dzień na tenant. To realizacja pominiętej
połowy TASK 9 z CLAUDE.md („synteza RSS + stenogramy per tematy użytkownika") —
warstwa syntezy nad istniejącym, surowym strumieniem wzmianek.

Nie mylić z **briefem przedwywiadowym** (TASK 5, serce MVP): tamten dotyczy jednego
wywiadu. Ten to poranna orientacja w sytuacji.

## Decyzje usera (podjęte w brainstormingu)

1. **Rozbudowa ekranu „Brief poranny"**: synteza na górze, istniejące wzmianki
   o hasłach Petru jako sekcja niżej. Brief poranny pokazuje **tylko dzisiejszy** dzień.
2. **Kąt: angażowany pod strategię Petru** — agent dobiera i komentuje wydarzenia
   przez pryzmat celów, wartości i granic polityka oraz elektoratów docelowych.
3. **Źródło materiału: Bing News (ogólne zapytania polityczne) + dane Sejmu** z danego
   dnia. Bez budowania ingestu ~50 feedów RSS (zostaje na później).
4. **Zakładka „Briefy" = archiwum wszystkich briefów dnia** (dziś placeholder).
5. **Zakładka „Media" ukryta** (plik zostaje, znika z paska).

## Założenie do potwierdzenia przy review

Zakładka „Briefy" jest w CLAUDE.md zarezerwowana dla briefów **przedwywiadowych**
(TASK 5, jeszcze nie zbudowane). Na teraz trzymamy tam archiwum briefów dnia; gdy
powstaną briefy przedwywiadowe, obie rzeczy rozdzieli przełącznik (segment) w tej
samej zakładce. Jeśli user woli inne rozwiązanie — korekta przed implementacją.

## Architektura

### Model danych — migracja `daily_briefs`

Tabela globalnie per tenant, RLS jak `mentions` (pełny dostęp w obrębie tenanta,
zero dostępu poza). Brief to gotowy artefakt czytany w całości, więc wydarzenia
trzymamy jako `jsonb` (jak dossier/analizy), bez tabeli-dziecka.

```
daily_briefs
  id            uuid pk
  tenant_id     uuid not null -> tenants(id) on delete cascade
  brief_date    date not null                      -- doba, której dotyczy
  status        text not null default 'generating' -- generating | ready | error
  lead          text                               -- jedno zdanie „nagłówek dnia"
  items         jsonb not null default '[]'         -- tablica wydarzeń (schema niżej)
  source_stats  jsonb not null default '{}'         -- ile prasy / Sejmu wzięto pod uwagę
  model         text
  error         text
  generated_at  timestamptz
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
  unique (tenant_id, brief_date)
```

Indeks: `(tenant_id, brief_date desc)`. Trigger `set_updated_at`. RLS: policy
`for all to authenticated using (tenant_id in (select tenant_id from memberships
where user_id = auth.uid()))` — wzorzec z `mentions`.

Kształt jednego elementu `items[]`:
```
{
  kategoria: string,            -- np. "Sejm", "Rząd", "Opozycja", "Gospodarka"
  naglowek: string,             -- zwięzły tytuł wydarzenia
  streszczenie: string,         -- 2-3 zdania faktów
  znaczenie_dla_ciebie: string, -- warstwa strategiczna pod Petru (okazja/ryzyko)
  zrodla: [{ tytul, url, redakcja }],  -- >=1, wyłącznie z podanego materiału
  source_type: "press" | "sejm"        -- pod przyszłe rozszerzenia (twitter)
}
```

### Edge Function `argus-morning-brief` (nowa)

Konwencja jak reszta: CORS preflight → auth → walidacja tenant → operacja, pole
`operation` w body. Model przez `_shared/ai.ts` (`getGenerationModel` = Sonnet 5),
`withStructuredOutput(zod)`.

| operation | kto | co robi |
| --- | --- | --- |
| `generate` | cron (`x-argus-cron`) dla wszystkich tenantów **lub** user (regeneracja dziś) | zbiera materiał → synteza → upsert `daily_briefs` (tenant_id, brief_date) |
| `get` | user | brief na datę (domyślnie dziś) dla tenanta |
| `list` | user | lista `{ brief_date, lead, status }` do archiwum (zakładka Briefy) |

`generate` jest idempotentne per (tenant, dzień): ponowne wywołanie nadpisuje brief
(regeneracja). Autoryzacja crona jak w `argus-ingest` (`x-argus-cron` albo
service_role). Wywołanie userskie generuje tylko dla jego tenanta i tylko „dziś".

### „Mini-agent": zbieranie + synteza

Moduł `_shared/daily-brief.ts`, kroki jako osobne collectory (pod przyszły Twitter):

- **`collectPress(supabase)`** — stała, globalna lista zapytań politycznych
  (`POLITYKA_QUERIES`: Sejm, rząd, kluby, kluczowi politycy) przez istniejące
  `fetchFromSources(SOURCES, query, 1)` z `news-sources.ts` (Bing → Google fallback).
  Okno 1 dzień, dedup po URL, sekwencyjnie (jak w `mentions.ts` — równoległe requesty
  = odcięcie). Twardy limit pozycji (~40 najświeższych), by prompt był ograniczony.
- **`collectSejm(supabase, date)`** — głosowania i wystąpienia z danego dnia z
  `sejm.ts` / tabel `sejm_statements`, `sejm_mp_votes`. Materiał w pełni wiarygodny
  źródłowo.
- *(przyszłość: `collectTwitter` — dorzuca itemy do tej samej puli, reszta bez zmian)*

**Synteza** — jeden krok Sonnet z `withStructuredOutput`:
- Wejście do promptu: profil polityka z `politician_profiles`
  (`full_name, district, goals, values, boundaries, style_profile`), `segments`
  tenanta oraz ponumerowana pula surowego materiału (prasa + Sejm z URL-ami).
- Wyjście: `lead` + `items[]` (5-7 wydarzeń), zod-walidowane.
- Twarde zasady (z CLAUDE.md, w promptcie): zero zmyślonych cytatów i liczb; każde
  wydarzenie musi wskazać ≥1 URL **z podanej puli** (walidacja w kodzie — element bez
  URL z puli odrzucany); `znaczenie_dla_ciebie` respektuje `boundaries` (bez pogardy
  wobec elektoratów Konfederacji / Trzeciej Drogi / KO — to elektorat docelowy);
  brak materiału = brief `ready` z pustą listą i uczciwym `lead`, nie halucynacja.

Prompt: `_shared/prompts/morning-brief-synthesis.md`, po polsku, wersjonowany;
bundlowany do `prompts/index.ts` przez `backend/scripts/build-prompts.sh`.

Limit workera: prasa to wiele requestów HTTP + jedno wywołanie Sonnet. Jeśli okaże
się za ciężkie na jeden przebieg, `collectPress` porcjujemy (mniej zapytań na wywołanie),
ale MVP celuje w jeden przebieg (analogicznie do `generate_step` w `argus-content`).

### Cron

pg_cron 6:30 woła `argus-morning-brief` `generate` (nagłówek `x-argus-cron`). Zgodnie
z uwagą w CLAUDE.md o rozjechanej historii migracji — konfiguracja crona jako **krok
deployu**, nie migracja w repo. Przycisk „Wygeneruj/Odśwież" w UI daje działanie bez crona.

### Frontend

Wspólny komponent **`DailyBriefView`** (`src/components/daily-brief-view.tsx`)
renderuje karty wydarzeń: chip `kategoria`, `naglowek` (serif), `streszczenie`,
teal-owy blok „**Co to znaczy dla Ciebie**" (`znaczenie_dla_ciebie`), tappable `zrodla`
(otwierają URL, event `daily_brief_item_source_opened`). Kolory wyłącznie z
`src/constants/Colors.ts`, typografia i klimat jak w `brief-poranny/index.tsx`.

- **`src/app/brief-poranny/index.tsx`** — nad istniejącą listą wzmianek dochodzi
  sekcja „**Przegląd dnia**" (dzisiejszy `daily_briefs` przez `get`), z `DailyBriefView`
  i przyciskiem regeneracji. Sekcja „**Wzmianki o Tobie**" (obecna logika) niżej.
  Stany: `generating` (spinner + info), `error` (alert + retry), `ready` pusty
  (uczciwy komunikat, że dziś cicho). Ekran = tylko dziś.
- **`src/app/(tabs)/briefs.tsx`** — archiwum: `list` → lista `{data, lead}`, tap →
  read-only widok briefu (`get` na wskazaną datę, ten sam `DailyBriefView`). Trasa
  szczegółu np. `src/app/brief-poranny/[date].tsx`.
- **`src/app/(tabs)/_layout.tsx`** — `media` z `options={{ href: null }}` (znika z paska,
  plik `media.tsx` zostaje). Opis karty „Brief poranny" na Dziś ew. dopieścić.

### Client API

`src/lib/api/daily-brief.ts`: `getDailyBrief(date?)`, `listDailyBriefs()`,
`generateDailyBrief()` — wołają `argus-morning-brief` z tokenem z sesji, wzorzec jak
`src/lib/api/mentions.ts`. Typy `DailyBrief`, `DailyBriefItem`.

### Analytics (PostHog)

Nowe: `morning_brief_generated`, `daily_brief_item_source_opened`. Istniejący
`morning_brief_read` zostaje.

## Poza zakresem (świadomie)

- Twitter/X i inne social — tylko projekt pod rozszerzenie (`source_type`, modularne collectory).
- Klasyfikacja tonu wzmianek (odłożona globalnie).
- Ingest ~50 feedów RSS do `news_items` — zostajemy na Bing News.
- Powiadomienia push o gotowym briefie.

## Weryfikacja

- Migracja przechodzi, RLS: tenant A nie widzi briefów tenanta B (test jak w
  `backend/scripts/run-rls-tests.sh`).
- `generate` dla tenanta pilotażowego (Petru) tworzy brief z 5-7 wydarzeniami, każde
  z realnym URL z puli; brak wymyślonych cytatów/liczb.
- Brief poranny pokazuje „Przegląd dnia" + wzmianki; regeneracja działa.
- Zakładka Briefy listuje briefy dnia, szczegół otwiera read-only.
- Zakładka Media zniknęła z paska.
```
