# cbos-crawler

Lokalne narzędzie do budowy przeszukiwalnej bazy badań opinii publicznej z
komunikatów CBOS pod bazę wiedzy Argusa. Kataloguje komunikaty z listingu
`cbos.pl`, filtruje je pod dwanaście tematów programowych, archiwizuje PDF-y,
rozczytuje tekst, strukturyzuje go w badania (typ `Badanie` z Argusa) przez
Claude API i eksportuje payload gotowy do załadunku. Samodzielne narzędzie,
docelowo do przeniesienia do osobnego repo (obecnie na branchu
`narzedzia/cbos-crawler`), wzorowane na `tools/bip-scraper`.

Rdzeń (`discover`, `crawl`, `extract`, `export`, `status`, `upload`) działa na
samym **Node 24+** (wbudowany SQLite, fetch, natywny TypeScript). Ekstrakcja PDF
wymaga jednorazowego `npm install` (`pdfjs-dist`). Etap `structure` woła Claude
API (klucz `CLAUDE_API_KEY` z `.env` w korzeniu repo).

## Dlaczego CBOS

Ze wszystkich instytutów w korpusach `docs/` tylko **CBOS ma otwarte, darmowe
archiwum** komunikatów w PDF pod stałym, przewidywalnym wzorcem URL
(`/SPISKOM.POL/{rok}/K_{NNN}_{RR}.PDF`). IBRiS, SW Research, United Surveys,
Opinia24 i Pollster publikują tylko przez zleceniodawców (redakcje, paywall),
więc nie nadają się do crawlu — te lepiej łapać ścieżką wzmianek/RSS. Kolejne
otwarte źródło do dołożenia adapterem: **Eurobarometer** (Komisja Europejska).
`robots.txt` CBOS blokuje wyłącznie `/stats/`; komunikaty są dozwolone.

## Potok

```
discover → crawl → extract → structure → export → upload
```

Każdy etap jest wznawialny — stan siedzi w SQLite (`data/cbos.sqlite`), więc
przerwanie (Ctrl+C, restart) jest bezpieczne, a ponowne uruchomienie
kontynuuje od miejsca przerwania. Katalog `data/` jest poza gitem.

## Użycie

```bash
npm install            # jednorazowo, pod ekstrakcję PDF (pdfjs-dist)
```

```bash
node src/cli.ts discover
```

Przechodzi listing komunikatów oknami (`publikacje_offset`), parsuje metadane
wprost z HTML (numer, tytuł, streszczenie z procentami, autor, data),
klasyfikuje tematycznie (`src/topics.ts`) i zapisuje do bazy. PDF-ów tu nie
pobiera. Domyślnie kataloguje roczniki od 2016 (`--min-year N`). Listing jest od
najnowszych, więc kończy, gdy zejdzie poniżej progu roku.

```bash
node src/cli.ts crawl
```

Pobiera PDF-y **tylko** komunikatów dopasowanych do tematów (`matched=1`),
szeregowo z odstępem (jeden host). URL PDF jest wyliczony z numeru/roku; brak
pliku pod wzorcem → status `missing`. `--limit N`, `--retry-errors`.

```bash
node src/cli.ts extract
```

Rozczytuje tekst z PDF do `data/texts/<sha>.txt` przez `pdfjs-dist`. Klucz stanu
to sha256 treści, więc ten sam plik rozczytuje się raz. Skany bez warstwy
tekstowej dostają status `needs_ocr` (kolejka pod przyszły OCR).

```bash
node src/cli.ts structure
```

Dla każdego komunikatu woła Claude (domyślnie `claude-sonnet-5`, `--model`),
który wyciąga pola typu `Badanie`: termin, próba, zleceniodawca, pytania i
rozkłady procentowe, plus ocenę przydatności i tematy. **Twarda zasada: model
nie zmyśla liczb** — bierze wyłącznie wartości z tekstu, brak = `null`. Wymaga
`CLAUDE_API_KEY`. `--limit N`, `--force`.

```bash
node src/cli.ts export
```

Składa `data/export/cbos-knowledge.json` — rekordy z metadanymi, tekstem i
strukturą, gotowe do załadunku. Pomija rekordy oznaczone przez AI jako
nieprzydatne (`--include-unusable` je zostawia).

```bash
node src/cli.ts upload --token <service_role|CRON_SECRET>
```

Wysyła eksport porcjami do Edge Function `argus-ingest` (operacja
`load_knowledge`), która liczy embeddingi (Supabase.ai gte-small,
**wyłącznie server-side**) i wstawia do tabeli `knowledge_docs`. Działa dopiero
**po** wypchnięciu migracji `knowledge_docs` i deployu `argus-ingest`. Token
podawany ad hoc (`--token` albo `ARGUS_INGEST_TOKEN`) — **nigdy** z repo `.env`,
bo klucz `service_role` jest sekretem Edge Functions.

```bash
node src/cli.ts status
```

Postęp per etap (można odpalać w trakcie z drugiego terminala).

## Strona Argusa (wymaga pushu — deploy = produkcja)

- Migracja `backend/supabase/migrations/20260727100000_knowledge_docs_cbos.sql`
  — globalna tabela `knowledge_docs` (read-only dla zalogowanych, insert tylko
  `service_role`), `vector(384)`, dedup po `content_hash`, RPC
  `match_knowledge_docs` do wyszukiwania wektorowego (opcjonalnie zawężone do
  jednego tematu).
- Operacja `load_knowledge` w `argus-ingest` (`_shared/knowledge.ts`) — liczy
  embeddingi i wstawia porcję rekordów (max 50 na wywołanie).

Docelowo generator przekazu i briefy odpytują `match_knowledge_docs`, żeby
sugerować treści na konkretnych, zweryfikowanych danych CBOS zamiast z pamięci
modelu.

## Filtr tematyczny

`src/topics.ts` mapuje komunikat na rodziny tematów Argusa po słowach w tytule i
streszczeniu. To prefiltr o wysokiej czułości (lepiej za dużo niż przegapić);
właściwą ocenę przydatności i wyciągnięcie liczb robi etap `structure` (AI) i
przegląd człowieka. Dopasowanie z granicą słowa (rdzenie + całe słowa dla
krótkich akronimów: NATO, OZE, PIT, UE), bo naiwny substring dawał trafienia w
środku słów (klasyk: „atom"/„nato" w „N**atom**iast").
