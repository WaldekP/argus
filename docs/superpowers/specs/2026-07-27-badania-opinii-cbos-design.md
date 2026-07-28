# Badania opinii publicznej (CBOS) jako źródło danych referencyjnych

Data: 2026-07-27. Decyzja usera (sesja): zbudować własną, przeszukiwalną bazę
badań opinii publicznej z komunikatów CBOS, żeby asystent Argusa i briefy
groundowały odpowiedzi na konkretnych, zweryfikowanych liczbach zamiast na
pamięci modelu. Zakres na start: CBOS, roczniki 2016+, filtr ścisły, strukturyzacja
dwustopniowa (tani gate + mocny ekstraktor). Architektura pluggable pod kolejne
otwarte źródła (Eurobarometer) na później.

Wpisuje się w strukturę z `2026-07-27-nawigacja-analizy-dane-design.md`: badania
opinii to **dane referencyjne**, więc wchodzą na zakładkę **Dane** jako czwarte
źródło, równolegle do Polityków, Dziennikarzy i Programów wyborczych.

## Po co

Korpusy `docs/` cytują sondaże z IBRiS, SW Research, United Surveys, Opinia24,
Pollster — ale te instytuty nie mają otwartych archiwów (żyją za paywallem
redakcji). Jedyny z pełnym, darmowym archiwum PDF jest **CBOS**
(`/SPISKOM.POL/{rok}/K_{NNN}_{RR}.PDF`, `robots.txt` blokuje tylko `/stats/`).
Instytuty bez otwartych archiwów zostają poza crawlerem — łapiemy je istniejącą
ścieżką wzmianek/RSS, nie scrapingiem.

## Narzędzie: tools/cbos-crawler

Samodzielne narzędzie w `tools/`, wzorzec `bip-scraper` (pamięć
`bip-scraper-narzedzie`): Node 24+ zero-dep (wbudowany SQLite, fetch, natywny
TypeScript), tylko `pdfjs-dist` do PDF. Docelowo osobne repo, obecnie branch
`narzedzia/cbos-crawler`. Potok wznawialny (stan w SQLite):

`discover → crawl → extract → structure → export → upload`

- **discover** — listing `publikacje.php` oknami (`publikacje_offset`), metadane
  parsowane wprost z HTML (numer, tytuł, streszczenie z procentami, autor, data);
  filtr tematyczny (`src/topics.ts`) pod 12 tematów Argusa, dopasowanie z granicą
  słowa (rdzenie + całe słowa dla akronimów: NATO, OZE, PIT, UE).
- **crawl** — PDF tylko komunikatów dopasowanych (`matched=1`), URL wyliczony
  z numeru/roku, grzecznie (1 host, odstęp), z poszanowaniem `robots.txt`.
- **extract** — tekst z PDF przez `pdfjs`, klucz stanu sha256, skany → `needs_ocr`.
- **structure** — dwustopniowo: tani gate (`claude-haiku-4-5`) ocenia przydatność
  na tytule + streszczeniu + początku tekstu; mocny ekstraktor (`claude-sonnet-5`)
  wyciąga pola typu `Badanie` (termin, próba, zleceniodawca, pytania, rozkłady)
  tylko z przydatnych. Twarda zasada: zakaz zmyślania liczb (brak = null); thinking
  wyłączone (`thinking: {type:"disabled"}`), inaczej zjadało budżet tokenów i ucinało JSON.
- **export** — `data/export/cbos-knowledge.json`, pomija oznaczone jako nieprzydatne.
- **upload** — porcje ≤50 do `argus-ingest` (operacja `load_knowledge`). Token
  service_role/CRON_SECRET podawany ad hoc, nigdy z repo `.env`.

Stan po pełnym biegu 2016+: 1687 skatalogowanych, 208 dopasowanych, **85 przydatnych**
(519 pytań, 2605 rozkładów).

## Tabela knowledge_docs (globalna)

Migracja `20260727100000_knowledge_docs_cbos.sql`. Charakter jak `news_items`
i `journalists`: **read-only dla zalogowanych, insert/update tylko service_role**.

- Kolumny: `source`, `external_id` (unikalne w obrębie source), `title`,
  `report_url`, `pdf_url`, `pub_date`, `author`, `year`, `topic_tags[]`,
  `topic_slugs[]`, `summary`, `structured jsonb` (badanie), `content` (pełny tekst),
  `content_hash` (sha256, dedup), `embedding vector(384)`.
- RLS: `select to authenticated using (true)`; brak polityki insert (service_role
  omija RLS — celowo).
- RPC `match_knowledge_docs(p_query_embedding, p_topic_slug, p_limit)` — wyszukiwanie
  wektorowe, opcjonalnie zawężone do jednego tematu. Wzorzec `match_sejm_statements`.
- `source` przewiduje wiele instytutów (CBOS teraz, Eurobarometer później).

## Backend

- **Zasilenie**: operacja `load_knowledge` w `argus-ingest` (wzorzec
  `journalist_refresh`), przyjmuje porcję `records`, liczy embeddingi
  (Supabase.ai gte-small — wyłącznie server-side), upsert po `content_hash`.
  Kod: `_shared/knowledge.ts`. Embeddingów NIE liczy crawler (Node nie ma modelu
  edge-runtime).
- **Odczyt user-facing** (decyzja usera): nowa funkcja `argus-knowledge`, mirror
  `argus-media` (osobna domena, spójne z resztą zakładki Dane). Operacje:
  `list_knowledge_docs` (odczyt globalnej tabeli, pola odchudzone pod listę:
  source, external_id, title, pub_date, topic_slugs, liczba pytań; filtr opcjonalny
  po `topic_slug`, bez `content`) oraz `get_knowledge_doc` (pełny rekord z
  `structured` pod ekran szczegółu). Klient `src/lib/api/knowledge.ts` przez
  `edgeClient`, nowy wariant w `EdgeFunctionName`. Bez nowej migracji — tabela
  już istnieje.

## Zakładka Dane → Badania opinii

Czwarta karta `SectionCard` w `(tabs)/dane.tsx` (ikona `bar-chart-outline`,
tytuł **„Badania opinii"**, opis: badania CBOS z rozkładami odpowiedzi, do
grafiki `→ /badania-opinii`). Nazewnictwo trzyma regułę: **„Badania opinii" /
„Dane sondażowe", nigdy „korpus"** (pamięć `nazewnictwo-zagadnienia`).

Ekran wg wzorca `dziennikarze/`:

- `src/app/badania-opinii/_layout.tsx` — Stack z bramką sesji (Redirect do
  loginu), `headerShown: false`. Kopia layoutu Dziennikarzy.
- `src/app/badania-opinii/index.tsx` — lista badań grupowana po **temacie Argusa**
  (`topic_slugs`), wyszukiwarka po tytule (normalizacja bez polskich znaków jak
  w Dziennikarzach), `RefreshControl`, `BackLink`, `EyeDot`, tokeny z
  `constants/theme`. Wiersz: numer i data (np. „CBOS 74/2026, 23 lip 2026"),
  tytuł, liczba pytań.
- `src/app/badania-opinii/[id].tsx` — ekran szczegółu (decyzja usera): pytania
  i rozkłady procentowe ze `structured` (`get_knowledge_doc`), metryczka (termin,
  próba), link do `report_url` na cbos.pl jako źródło. Kluczowe odpowiedzi
  (`kluczowy`) wyróżnione. Cytowalne bez wychodzenia z apki.
- Rejestracja tras w `src/app/_layout.tsx` (root Stack), jak `dziennikarze/_layout`.

Świeżość danych (decyzja usera): **jednorazowy seed** 85 rekordów. Nowe komunikaty
dobieramy ręcznie ponownym biegiem crawlera (wznawialny), bez harmonogramu.

## RAG w asystencie Argus (zrobione)

`_shared/knowledge-search.ts` (`searchOpinionContext`, fail-soft) embedduje pytanie,
odpytuje `match_knowledge_docs` i składa cytowalny blok (źródło, data, metryczka,
rozkłady), doklejany do system promptu w `argus-assistant`. Asystent (spec
`2026-07-27-asystent-argus-design.md`) dotąd nie miał retrievalu — jechał na
skrócie w wiadomości. Fail-soft: brak trafień / niezaładowane dane / błąd → działa
dalej bez danych.

## Generator przekazu — grounding wariantów (decyzja usera)

`argus-content` przy generacji wariantów odpytuje `searchOpinionContext` (to samo
`_shared/knowledge-search.ts`) dla tematu draftu i wstrzykuje rozkłady opinii do
promptu generacji, obok stylu i wartości z profilu. Wariant treści opiera się o
realny rozkład opinii (np. „54% uważa pomoc uchodźcom za zbyt dużą"), a nie tylko
o historię wypowiedzi polityka. Zawężenie po `topic_slug` z draftu, gdy znany.
Fail-soft jak w asystencie. Najmocniejsze dla obronności/euro/energii; przy
podatkach danych mało, więc blok bywa pusty (i to w porządku).

## Temat.badania[] — zasilenie tematów (decyzja usera)

Pole `badania?: Badanie[]` w `Temat` (`knowledge/topics/types.ts`) jest dziś
kuratorowane ręcznie. Dla tematów, które CBOS pokrywa, dokładamy badania z
`knowledge_docs` **dynamicznie w runtime** (decyzja usera): ekran `/temat/[slug]`
pobiera badania CBOS dla slug przez `argus-knowledge` (`list_knowledge_docs` z
filtrem `topic_slug`) i łączy z ręcznymi w locie. Zero generowanych plików TS,
dane zawsze świeże. Sekcja badań CBOS jawnie oznaczona źródłem i datą, odrębna od
ręcznych (bez deduplikacji — inne źródła). Fail-soft: brak danych / błąd → widać
tylko ręczne. Nie ruszamy tematów, których CBOS nie pokrywa (tax-core zostaje na
ręcznych z IBRiS/SW Research).

## Pokrycie tematyczne i uczciwy caveat

CBOS jest mocny na obronności (51 przydatnych), euro (6), energetyce (18), socjalu
(11), a **cienki na podatkach** (kwota wolna/PIT/Belki — 3-4 komunikaty). Tax-core
korpusów dalej stoi na IBRiS/SW Research, których CBOS nie dubluje. Embeddingi to
gte-small (słaby dla polskiego, odnotowane w CLAUDE.md) — ten sam model wszędzie,
więc spójnie, ale wyszukiwanie będzie „dobre, nie doskonałe".

## Poza zakresem

- Adapter Eurobarometer i innych źródeł (przewidziane w `source`, osobny krok).
- Chunking długich komunikatów (na teraz jeden embedding per dokument, z tytułu +
  streszczenia + pytań).
- OCR skanów CBOS (`needs_ocr` to kolejka na przyszłość).
- Harmonogram odświeżania (na teraz jednorazowy seed, dobieranie ręczne).
- Instytuty bez otwartych archiwów (IBRiS, SW Research, United Surveys, Opinia24,
  Pollster) — poza crawlerem, ścieżką wzmianek.

## Bramki jakości (dokładane wg konwencji)

- **Eventy PostHog**: `knowledge_doc_viewed`, `badania_searched` (`src/lib/analytics/events.ts`).
- **Test RLS** `knowledge_docs`: zalogowany czyta (globalne), insert wyłącznie
  service_role — warunek zaliczenia migracji.
- **Testy jednostkowe** czystej logiki crawlera (`classify`, `parseListing`,
  formatowanie groundingu) — `npm test`.
- **CLAUDE.md**: `argus-knowledge` do rejestru funkcji, aktualizacja postępu.

## Wdrożenie (decyzja usera: jeden push)

Budujemy komplet (backend + `argus-knowledge` + sekcja Dane + wpięcie w generator
i `Temat.badania[]`), potem **jeden push** gałęzi = produkcja (pamięć
`deploy-pipeline-argus`): migracja i funkcje wjeżdżają automatycznie. Po deployu
jednorazowo `cbos-crawler upload` z tokenem service_role ładuje 85 rekordów.
Dopiero wtedy RAG, ekran Dane, grounding generatora i badania w tematach mają dane.
