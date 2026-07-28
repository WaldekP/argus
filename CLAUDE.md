# CLAUDE.md — Argus.ai (MVP)

## Czym jest ta aplikacja

**Argus.ai** — aplikacja dla polityka i jego asystenta/rzecznika (2 konta na klienta, wspólne dane). Pełny brief: `../briefy/14-brief-implementacja-aplikacji-mvp.md` (czytaj przed większymi zadaniami). Kontekst produktowy: `../analiza/`.

MVP robi 5 rzeczy:

1. **Profil polityka (graf kontekstu)** — onboarding: auto-import z API Sejmu (głosowania, stenogramy) + wywiad onboardingowy z AI + profil stylu językowego.
2. **Baza mediów i dziennikarzy** — karty redakcji i dziennikarzy z profilami stylu i playbookami rozmowy (dane seedowane, globalne, read-only).
3. **Brief przedwywiadowy** (serce MVP) — formularz "gdzie / kto / temat" → brief w < 5 min: profil dziennikarza, 10 przewidywanych pytań z prawdopodobieństwem, rekomendowane odpowiedzi, pułapki i mosty, 3 message'y dnia.
4. **Generator przekazu** — temat → warianty treści per segment wyborców × kanał (FB, X, TikTok skrypt, prasa lokalna), w stylu polityka.
5. **Strażnik spójności** — każdy draft i brief porównywany z historią głosowań/wypowiedzi/obietnic; alerty sprzeczności.

Plus: **brief poranny lite** (synteza RSS + stenogramy per tematy użytkownika, cron 6:30) i **tryb ćwiczenia** (chat, AI odgrywa dziennikarza).

**Poza zakresem MVP — nie buduj, nawet jeśli kusi:** tryb LIVE (ASR), nasłuch X/TikTok, analiza nagrań po wywiadzie, publikacja do social mediów, role enterprise/partia, watch, płatności, speechwriter, crisis room.

## Stack

| Warstwa | Decyzja |
| --- | --- |
| Frontend | React Native + Expo (expo-router, TypeScript **strict**). Target: iOS, Android, **Web** — web pierwszorzędny (asystent pracuje na laptopie) |
| State | Zustand |
| Backend | Supabase, projekt **"Argus"** (`jgwvtlghpkztivbhnofi`, West EU/Irlandia; osobna organizacja, NIE współdzielić z TwójPsycholog): Postgres + pgvector, Auth (e-mail; **Google OAuth odłożony na później — nie dodawać przycisku bez decyzji usera**), Edge Functions (Deno), Storage. Deploy przez Supabase CLI z `backend/` (projekt zlinkowany; `SUPABASE_ACCESS_TOKEN` i `SUPABASE_DB_PASSWORD` w `.env`). Konfiguracja klienta przez `.env` (patrz `.env.example`) |
| AI | Claude API przez **LangChain/LangGraph** (npm: specifiers w Deno) — `claude-sonnet-5` (briefy/treści), `claude-haiku-4-5` (klasyfikacja). Wywołania WYŁĄCZNIE z Edge Functions, klucz nigdy na kliencie. Moduł: `backend/supabase/functions/_shared/ai.ts`, pipeline'y (LangGraph): `_shared/pipelines/` |
| Embeddingi | pgvector + model multilingual przez Edge Function |
| Ingest | Edge Functions + pg_cron (Sejm API, RSS ~50 feedów). Bez zewnętrznego orkiestratora |
| Analytics | PostHog, osobny projekt "Argus" (`src/lib/analytics/events.ts`) |

## Struktura monorepo

```text
argus_app/
  src/app/            — ekrany (expo-router, file-based routing)
  src/components/     — komponenty współdzielone
  src/constants/      — Colors.ts (JEDYNE źródło kolorów), theme
  src/lib/            — supabase.ts, analytics/, api/
  src/store/          — story Zustand
  backend/
    supabase/
      migrations/     — migracje SQL
      functions/      — Edge Functions (Deno)
        _shared/      — wspólny kod + prompts/ (wszystkie prompty, po polsku, wersjonowane)
    scripts/          — skrypty seedujące (baza mediów itp.)
  docs/               — kontrakty API i tematyczne bazy wiedzy
```

## Kontrola jakości (uruchamiaj przed commitem)

| Komenda | Co sprawdza |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` na `src/` (strict) |
| `npm run lint` | ESLint na `src/` i `backend/` |
| `npm test` | testy jednostkowe logiki czystej |
| `npm run check` | wszystkie trzy po kolei |

Te same bramki chodzą w CI (`.github/workflows/check.yml`), plus `deno check` na
Edge Functions i kontrola, czy `_shared/prompts/index.ts` zgadza się z plikami `.md`.
**To jedyne zabezpieczenie przed wdrożeniem błędu typu**: ani Metro, ani
`supabase functions deploy` nie sprawdzają typów, a push na main wdraża produkcję.

**Testy** stoją na wbudowanym runnerze Node (`node --test`, Node 24 sam zdejmuje typy),
bez jednej zależności deweloperskiej. Pliki `*.test.ts` obok kodu, resolver aliasu `@/`
i importów bez rozszerzeń: `test/setup.mts`. Testujemy logikę czystą (formatowanie,
normalizacja odpowiedzi API, spójność bazy wiedzy); komponentów RN nie renderujemy.

**Backend (typy Deno) sprawdza CI, nie sprawdzaj go lokalnie w repo.**
`deno check --node-modules-dir=auto` uruchomione gdziekolwiek w drzewie projektu
przebudowuje `node_modules` na strukturę z symlinkami do `.deno/` (jak pnpm).
Działa, ale potem zwykłe `rm -rf node_modules/.deno` albo operacja npm zrywa
symlink `typescript` i psuje `tsc`. Jeśli musisz sprawdzić backend lokalnie,
skopiuj `backend/supabase/functions` do katalogu tymczasowego poza repo, dodaj
tam `deno.json` z `{ "nodeModulesDir": "auto" }` i uruchom `deno check` na kopii.

**Pułapka:** `expo start` generuje `.expo/types/router.d.ts` z zaśmieconą listą tras
(trafiają tam pliki spoza `src/app`, np. `/../lib/knowledge/...`), po czym `tsc` zgłasza
fałszywe błędy tras. `expo export` generuje ten plik poprawnie. Jeśli widzisz błędy
`TS2345` na `router.push`, usuń `.expo/types/router.d.ts` i sprawdź ponownie.

## Tematyczne bazy wiedzy (`docs/`)

Korpusy merytoryczne pod briefy przedwywiadowe i generator przekazu. Każdy korpus ma własny
katalog z `README.md` (rola, mapa dokumentów, zasady pracy, audyt źródeł).

- `docs/kwota-wolna/` — kwota wolna od podatku: finanse i budżet, sondaże, elektoraty,
  benchmarking CEE i UE, seria badań CBOS, cytaty Konfederacji, Tuska i Polski 2050.
- `docs/konfederacja-podatki/` — program podatkowy Konfederacji 2023 (5 postulatów): kwota wolna
  12×, PIT liniowy 12%, podatek Belki, dobrowolny ZUS, uproszczenia dla przedsiębiorców.
  Rekomendacje dwuwarstwowe (co podchwycić / gdzie uderzyć).
- `docs/programy-wyborcze/` — korpus surowców: oficjalne PDF-y programów wyborczych partii
  sejmowych z wyborów 2011, 2015, 2019, 2023 (bez Mniejszości Niemieckiej, decyzja usera).
  Indeks źródeł w README. Surowiec pod analizy programowe i plan wyborczy dla Petru.

Zasada: przed odpowiedzią na pytanie merytoryczne z danego tematu przeszukaj korpus, nie
odpowiadaj z pamięci modelu. Liczby oznaczone `[do weryfikacji]` nie nadają się do publikacji.

Ekrany „Tematy”: dane tematów w `src/lib/knowledge/topics/<slug>.ts` (typy w `types.ts`,
rejestr w `index.ts`), renderowane w zakładce Tematy i na `/temat/[slug]`. Kontrakt produktowy:
`docs/kontrakt-tematy.md`. Docelowo źródłem będzie tabela `knowledge_topics` z bazy.

## Auth i multi-tenancy (krytyczne)

- **Auth pattern**: klient wysyła token Supabase w nagłówku `Authorization` → Edge Function weryfikuje `supabase.auth.getUser(token)` → operacje na `user.id`. `service_role` tylko w Edge Functions. Klucz serwisowy i klucz Claude NIGDY na kliencie.
- **Multi-tenancy**: `tenant_id` (= konto klienta, "biuro") na każdej tabeli z danymi klienta. Polityk + asystent = ten sam tenant (tabela `memberships`, role: `politician`/`assistant`). RLS: `tenant_id` musi zgadzać się z tenantem usera.
- **Dane globalne** (dziennikarze, redakcje, dane Sejmu, news_items): read-only dla zalogowanych, insert/update tylko `service_role`.
- **RLS na KAŻDEJ tabeli** + testy RLS (tenant A nie widzi danych tenanta B) — warunek zaliczenia migracji.
- 2FA (TOTP) wymuszone dla roli `politician`.

## Migracje bazy danych

Migracje to pliki SQL w `backend/supabase/migrations/`, wersjonowane w gicie.
Na produkcję nakłada je integracja Supabase↔GitHub przy merge do `main`
(albo narzędzie `apply_migration` konektora Supabase MCP).

**Zasada nadrzędna (decyzja Waldka): nigdy nie migruj bez pytania.** Kiedy zadanie
wymaga zmiany schematu, napisz plik migracji i od razu zapytaj usera, czy go
nałożyć. Nie nakładaj migracji po cichu i nie zostawiaj utworzonej migracji bez
zadania pytania „migrować?". User zatwierdza, Claude wykonuje. Migracje na żywo
w bazie (poza plikami) tworzą dryft, dlatego jedynym źródłem prawdy są pliki.

Jedna funkcja per domena, pole `operation` w body. Każda: CORS preflight → weryfikacja tokena → walidacja tenant_id → operacja. Funkcje: `argus-onboarding`, `argus-brief`, `argus-content`, `argus-consistency`, `argus-practice`, `argus-media`, `argus-morning-brief`, `argus-registry` (powiązania z KRS), `argus-mentions` (wzmianki prasowe), `argus-ingest` (cron, service-only), `argus-segments`, `argus-tenant` (eksport / twarde usunięcie danych), `argus-knowledge` (badania opinii publicznej / CBOS, read-only).

**Zasada, którą łatwo złamać:** operacja działająca na danych WSZYSTKICH tenantów
(przebiegi cronowe) nie może istnieć w funkcji użytkownika, nawet „do testów".
Takie operacje mieszkają wyłącznie w `argus-ingest`. Klient Edge Functions po
stronie apki: `src/lib/api/client.ts` (jeden transport, `edgeClient<Operation>()`
per domena). Błąd 500 zwracaj przez `serverErrorResponse()` z `_shared/types.ts`,
nigdy z treścią wyjątku: do UI trafiały surowe komunikaty Postgresa.

### Rejestr sądowy (KRS)

Kontrakt: `docs/kontrakt-rejestr-krs.md`. Dwa źródła rozdzielone kosztem: otwarte API Ministerstwa Sprawiedliwości (darmowe, wykrywa zmiany, ale maskuje dane osób fizycznych) i Rejestr.io (płatne z salda w PLN, daje nazwiska i sieć powiązań). Klucz: sekret `REJESTRIO_API_KEY`, nigdy na kliencie. Zasada nadrzędna: tożsamość osoby potwierdza człowiek, bo wyszukiwanie po nazwisku zwraca imienników bez pola rozróżniającego.

Saldo Rejestr.io jest **wspólne dla wszystkich tenantów**, więc płatne wywołania
mają dwa bezpieczniki w `_shared/rejestrio.ts`: próg salda (`MIN_BALANCE_PLN`)
i dzienny limit per tenant (`MAX_PAID_CALLS_PER_TENANT_PER_DAY`, liczony
z `registry_api_calls`). Dodając nowy płatny endpoint, przepuść go przez
`assertBudget()`, bo tam siedzą oba.

### Badania opinii publicznej (CBOS)

Spec: `docs/superpowers/specs/2026-07-27-badania-opinii-cbos-design.md`. Globalna
tabela `knowledge_docs` (read-only dla zalogowanych, insert tylko service_role,
`vector(384)`, RPC `match_knowledge_docs`) trzyma badania opinii z komunikatów
CBOS. Zasilanie: narzędzie `tools/cbos-crawler` (osobny branch, wzorzec
bip-scraper) kataloguje, rozczytuje i strukturyzuje komunikaty, a operacja
`load_knowledge` w `argus-ingest` liczy embeddingi (server-side) i wstawia.
Odczyt: `argus-knowledge` (`list_knowledge_docs`, `get_knowledge_doc`), ekran
Dane → Badania opinii. Grounding: `_shared/knowledge-search.ts`
(`searchOpinionContext`, fail-soft) wpięty w `argus-assistant` i `argus-content`,
oraz dynamicznie na `/temat/[slug]`. CBOS mocny na obronności/euro/energii/socjalu,
cienki na podatkach (tax-core zostaje na IBRiS/SW Research). Tylko CBOS ma otwarte
archiwum; inne instytuty poza crawlerem.

### Zasady promptów

- Wszystkie prompty po polsku, w `backend/supabase/functions/_shared/prompts/`, wersjonowane w gicie.
- Styl polityka (`style_profile`) wstrzykiwany do każdej generacji treści.
- Twarde zasady: zakaz zmyślania cytatów i liczb (brak danych = napisz "brak danych"), zakaz treści dezinformacyjnych, warianty przekazu nie mogą być merytorycznie sprzeczne.

## Design system

**Źródło prawdy: `../briefy/15-mini-brief-design-argus.md`** (mini brief designu — przeczytaj przed każdą pracą nad UI). Spójność wizualna z prezentacją (brief 13). Klimat: "quiet power" — antyczna powaga + nowoczesny produkt, "muzeum nocą, nie startup". Motyw oka Argusa (logo, empty states, loader, kropka-oko zamiast bulletów) — subtelnie.

**Motyw: jasny domyślnie, ciemny na przełącznik (decyzja usera, 2026-07-26.**
Zmiana wobec wcześniejszego "dark mode first"). Wybór należy do użytkownika, nie
do systemu: store `src/store/theme.ts` (trwały per urządzenie, klucz
`argus.theme.mode`), przełącznik w zakładce Profil, paleta przez `useTheme()`.
Nie czytamy `useColorScheme()` z systemu, bo nadpisywałby wybór usera.
Uwaga: jasna paleta w `Colors.ts` nie była nigdy zweryfikowana z deckiem, a jest
teraz domyślna, więc przy pracy nad UI sprawdzaj OBA motywy.

**Korekta dla aplikacji (decyzja usera, 2026-07-23):** tła w apce są jaśniejsze niż w decku, a CTA ma własne złoto. Dark: tło `#161D45`, karty `#1F2755`, panel alt `#1A214C`, tło głębsze `#0F1535`, przyciski CTA `#E3B93C` (token `cta`) z tekstem `#10173A`. Wartości z tabeli poniżej dotyczą prezentacji; w apce zawsze bierz kolory z `src/constants/Colors.ts`.

Skrót palety (dark, deck):

| Token | HEX | Użycie |
| --- | --- | --- |
| Tło | `#0A0F2C` | główne tło ekranów |
| Tło głębsze | `#080C22` | krawędzie, gradienty, cień |
| Karta / panel | `#0E1436` | karty, modale, pola |
| Panel alt | `#0B1026` | drugi ton kart, wiersze |
| Złoto (akcent) | `#C9A227` | linie, akcenty, kluczowe liczby, CTA. Zasada: złoto = biżuteria, oszczędnie |
| Złoto jasne | `#E6C65A` | hover, podświetlenia, iris, tekst chipów |
| Teal (pawi) | `#14857A` | dane, drugi akcent, wykresy, info |
| Tekst | `#F4F1E8` | nigdy czysta biel; akapity 80%, meta 50% opacity |
| Alert | `#E0483A` | ostrzeżenia, kryzys |

- Karty: tło `#0E1436`, border `1px rgba(201,162,39,.25)`, radius 14–18. Alerty: lewy border 2px w kolorze roli (alert czerwony, info teal, sukces złoto), tło `rgba(koloru,.14)`. Chipy: border `rgba(201,162,39,.4)`, radius pełny, tekst `#E6C65A`.
- Zakaz: fiolet/róż "AI", neon, czysta biel/czerń.
- Nagłówki i kluczowe liczby: **Cormorant Garamond** 600 (`@expo-google-fonts/cormorant-garamond`); liczby kluczowe duże, złote; cytaty/akcenty emocjonalne Cormorant *italic*. UI/treść/dane: **Inter** (400/500/600). Kickery/etykiety: Inter UPPERCASE, letter-spacing .24em, złote, min 14px.
- Skala: tytuł ekranu 28–34, sekcja 20–24, body 15–16, meta 13, line-height 1.5.
- Layout: jedna myśl na widok, duże marginesy, spacing w skoku 8px, radiusy 12–18.
- `src/constants/Colors.ts` — jedyne źródło kolorów. Zero hardkodowanych hexów w komponentach.

## Konwencje tekstów UI (copy)

- Wszystkie teksty UI **po polsku**, z polskimi znakami. Rzeczowo, spokojnie, pełne zdania.
- **Bez półpauz** (—): osobne zdania lub przecinki. **Zero emoji i wykrzykników**, zero słów typu "rewolucja/innowacyjny/game-changer".
- **Pisownia inkluzywna z podkreślnikiem** (np. "gotowy_a").
- Głos marki: doradca w dobrze skrojonym garniturze, nie gadżet. Tagline: „Sto oczu. Jeden przekaz."

## Analytics (PostHog, obowiązkowe od początku)

Eventy: `onboarding_started/completed`, `sejm_import_completed`, `brief_created`, `brief_viewed`, `brief_rated`, `brief_question_feedback`, `content_generated`, `content_variant_copied`, `consistency_alert_shown/resolved`, `practice_session_started/finished`, `morning_brief_read`, `journalist_viewed`, `media_searched`, `knowledge_doc_viewed`, `badania_searched`. North star: liczba briefów tygodniowo per tenant.

## Bezpieczeństwo i RODO

- Żadnych tabel z danymi pojedynczych wyborców — segmenty to wyłącznie agregaty.
- Dane dziennikarzy: tylko zawodowe, z publicznych źródeł; pole `takedown_requested` + proces usunięcia.
- Eksport i twarde usunięcie danych tenanta (`argus-tenant` operation `delete_all`) — od MVP.
- Logi dostępu do danych tenanta w tabeli `access_logs`.
- Klucze: lokalny `.env` (nigdy nie commitować) trzyma `CLAUDE_API_KEY` i klucze publiczne Expo (`EXPO_PUBLIC_*`). Sekrety Edge Functions (klucz Claude, service_role) ustawiane przez `supabase secrets set` — nigdy w kodzie klienta.

## Konfiguracja pilotażu (decyzje usera, 2026-07-24)

- **Onboarding wyłączony na ten moment**: profil polityka ustawiony na sztywno w bazie
  (`onboarding_status='done'`), apka wchodzi prosto do zakładek. Ekrany onboardingu
  zostają w kodzie (powrót przez Profil), nie kierować do nich domyślnie.
- **Polityk tenanta pilotażowego: Ryszard Petru** (mp_id 286, klub Centrum, okręg
  Warszawa). Dane sejmowe zaimportowane, strategia zapisana w `politician_profiles`
  (`goals`/`values`/`boundaries`): budowa nowej partii wolnościowo-liberalnej.
- **Elektoraty docelowe** (tabela `segments`, wstrzykiwane do generatora przekazu):
  wolnościowcy z Konfederacji nieakceptujący konserwatyzmu światopoglądowego (mobilize),
  sieroty po Trzeciej Drodze (mobilize), rozczarowani Koalicją Obywatelską (persuade).
  Boundaries: bez pogardy wobec wyborców tych formacji — to potencjalny elektorat.

## Nawigacja (przebudowa 2026-07-27)

Pasek zakładek: Pulpit | Analizy | Asystent (środkowy przycisk) | Dane | Profil.
**Analizy** (`(tabs)/analizy.tsx`) to hub typów analiz: niespójności (`/analysis`),
zagadnień (`/topics`, dawna zakładka Tematy), przekazu (`/content`, globalna lista
draftów generatora) oraz zaślepki „Wkrótce" (wystąpienia, sentyment; wystąpienia
świadomie nieaktywne, bo YouTube blokuje transkrypty z centrów danych jak Google News).
**Dane** (`(tabs)/dane.tsx`) to katalog danych referencyjnych: Politycy (`/politycy`,
pełna lista posłów na żywo z API Sejmu, operation `list_mps` w argus-onboarding),
Dziennikarze (`/dziennikarze`, `argus-media`), Programy wyborcze. Zakładki Tematy,
Briefy i Media nie istnieją. Spec: `docs/superpowers/specs/2026-07-27-nawigacja-analizy-dane-design.md`.

## Analizy niespójności (feature poza briefem, 2026-07-24)

Kontrakt: `docs/kontrakt-analizy.md`. Edge Function `argus-analysis`: temat + cel
(1-5 posłów albo klub → 5 najaktywniejszych) → porcjowane zbieranie wystąpień
i głosowań z API Sejmu do tabel globalnych (`sejm_statements` z dedupem po hashu,
`sejm_mp_votes`) → ustalenia z dosłownymi cytatami (walidowane w kodzie przeciw
źródłom — niedosłowny cytat odrzuca ustalenie) i wagą 1-3. Dokumenty usera
(PDF przez `npm:unpdf`, TXT, MD) → werdykty twierdzeń: potwierdzone / sprzeczne /
brak danych. Wejście: karta na ekranie Dziś. Brak niespójności to poprawny wynik.

**UWAGA, historia migracji rozjechana**: zdalna baza ma migracje z innych sesji
(registry/mentions), których nie ma w tym repo — `supabase db push` odmawia.
Migracja analiz nałożona przez Management API + wpis do `schema_migrations`.
Do uporządkowania (`supabase db pull` w repo z kompletem migracji).

## Postęp (TASK 0–10 z briefu, sekcja 9)

- [x] TASK 0 — szkielet: Expo + backend/supabase + Colors.ts + auth (ekrany gotowe; wymaga konfiguracji `.env` z kluczami Supabase)
- [x] TASK 1 — migracja 001: pełny model danych + RLS + testy RLS (przechodzą na żywej bazie: `backend/scripts/run-rls-tests.sh`). Embeddingi: `vector(1024)` — model embeddingowy do wyboru w TASK 2, wymiar można zmienić dopóki tabele puste. Konta pilotażowe: `waldek.pieniak@gmail.com` (politician) + `skokowski@gmail.com` (assistant), wspólny tenant "Biuro pilotażowe". Ekran logowania nosi motto "Sto oczu. Jeden przekaz."
- [x] TASK 2 — ingest Sejm API + embeddingi. Embeddingi: **gte-small (384 wymiary)** przez wbudowane `Supabase.ai.Session` (bez zewnętrznego klucza; słabszy dla polskiego — ewentualna wymiana modelu = migracja + re-embed). Funkcje RPC wyszukiwania wektorowego: `match_statements`, `match_sejm_statements`, `match_news_items`. Import działa w **pętli porcjowanej** (limit zasobów workera Edge Functions; patrz kontrakt `docs/kontrakt-task-2-3.md`).
- [x] TASK 3 — onboarding (import, wywiad AI, profil stylu, segmenty). **Żaden krok onboardingu nie jest obowiązkowy** (decyzja usera 2026-07-23): każdy ekran ma link pominięcia, całość można pominąć z ekranu startowego (trwała flaga na urządzeniu, powrót z zakładki Profil). Odpowiedzi AI normalizowane po stronie klienta (`normalizeStyleProfile`, `normalizeSegment`). Prompty: źródło w `.md`, ale bundlowane jako moduł TS (`_shared/prompts/index.ts`) — deploy nie pakuje luźnych plików. Zdjęcia posłów: wprost z API Sejmu (`/MP/{id}/photo`, `photo-mini`), URL liczony z `mp_id` w `src/lib/sejm-photo.ts`, bez kopii w Storage (decyzja usera 2026-07-24; API odbija CORS, ale nie daje ETag, więc fallbackiem są inicjały). **Zdjęcie pokazujemy wyłącznie na karcie mandatu w zakładce Profil** (decyzja usera 2026-07-24), nigdzie indziej: ani na liście posłów w onboardingu, ani na pasku w zakładce Dziś. Karta mandatu (`MpMandateCard`) bierze pełne dane osobowe z operacji `mp_details` na żywo z API Sejmu; licznik wystąpień prowadzi do ekranu `src/app/wystapienia/` (operacje `list_statements` i `get_statement`).
- [~] TASK 4 — baza mediów CZĘŚCIOWO (2026-07-27): globalna baza dziennikarzy budowana scrapingiem publicznych stron autorów. Adaptery w `_shared/media/` (onet.ts, wp.ts, rmf24.ts; czysty fetch+regex, robots.txt sprawdzone, maile ze wzorca jawnie `pattern`), orkiestracja `refresh.ts`, wywołanie: `argus-ingest` operation `journalist_refresh` z `source` ("onet"|"wp"|"rmf24") — service role albo nagłówek crona. UWAGA: `persistJournalists` celowo NIE używa `.upsert(onConflict)`, bo indeks unikalny (outlet_id, outlet_author_slug) jest częściowy i ON CONFLICT go nie widzi (cichy brak zapisu); jest select→update/insert. Odczyt dla UI: Edge Function `argus-media` (operation `list_journalists`, filtruje `takedown_requested`), ekran Dane → Dziennikarze. Profile stylu, playbooki i pełny seed redakcji nadal otwarte.
- [ ] TASK 5 — brief przedwywiadowy (pipeline + ekrany + push)
- [ ] TASK 6 — strażnik spójności (pełny; wersja lite działa w generatorze przekazu)
- [x] TASK 7 — generator przekazu (wyciągnięty przed TASK 4-6 na życzenie usera). Edge Function `argus-content` (kontrakt: `docs/kontrakt-task-7.md`): draft → porcjowana generacja wariantów per segment × kanał (Sonnet, styl + wartości z profilu; max 2 warianty na wywołanie), na końcu kontrola spójności lite (embedding tematu → `match_statements` → Haiku ocenia sprzeczności → `consistency_alerts`). Limity kanałów: X twardo ≤ 280 znaków, reszta promptem. Ekrany: lista draftów, formularz (segmenty opcjonalne — tryb ogólny), widok wariantów z kopiowaniem i regeneracją. Segmenty z danych PKW/GUS — nadal otwarte (obecnie suggest AI z onboardingu)
- [ ] TASK 8 — tryb ćwiczenia
- [ ] TASK 9 — brief poranny lite. Wzmianki prasowe z **Bing News RSS** (darmowe, bez klucza; Google News zapasowo, bo odpowiada 503 na ruch z centrów danych) pod hasła tenanta, ekrany `brief-poranny/` w zakładce Dziś. Płatny monitoring mediów (Brand24 i podobne) świadomie odrzucony, uzasadnienie w `docs/kontrakt-wzmianki.md`. Klasyfikacja tonu przez Haiku odłożona, kolumny w bazie czekają puste. **Warstwa syntezy dodana (2026-07-26):** brief dnia — syntetyczny przegląd polskiej polityki pod strategię polityka (cele/wartości/granice + segmenty), sekcja „Przegląd dnia" nad wzmiankami. Edge Function `argus-morning-brief` (operacje `generate`/`get`/`list`, cron albo user), collectory `_shared/daily-brief.ts` (Bing News ogólne zapytania + Sejm z bazy, modularne pod przyszły Twitter), synteza Sonnet z walidacją anty-halucynacyjną (każde wydarzenie prasowe musi cytować URL z puli). Tabela `daily_briefs` (jsonb `items`), migracja `20260726100000` nałożona przez Management API + wpis do `schema_migrations`. **Pulpit pokazuje klocki briefu w karuzelach (2026-07-27):** sekcja „Brief poranny" na Pulpicie (`src/components/morning-brief-section.tsx`) z karuzelami wydarzeń przeglądu dnia i nieprzeczytanych wzmianek; link „Wszystkie" prowadzi do archiwum `brief-poranny/archiwum.tsx` (+ `brief-poranny/[date].tsx`). Zakładka Briefy usunięta z paska (decyzja usera 2026-07-27). Zakładka Media skasowana (2026-07-27): dziennikarze weszli do zakładki Dane. Cron 6:30 gotowy w `backend/cron/daily-brief-630.sql`, świadomie NIE wpięty (pg_cron nie włączony w projekcie, jak przy mentions_sync); przycisk „Wygeneruj przegląd" działa bez crona. Projekt: `docs/superpowers/specs/2026-07-26-brief-dnia-synteza-design.md`.
- [ ] TASK 10 — polish (states, PostHog komplet, eksport/usunięcie, E2E)

## Definition of Done MVP

1. Nowy użytkownik przechodzi onboarding i ma działający graf kontekstu z realnymi danymi z Sejmu.
2. Brief przedwywiadowy dla realnego wywiadu powstaje w < 5 min, ocena pilotów 4+/5.
3. Generator daje warianty per segment, które brzmią jak polityk, nie jak chatbot.
4. Strażnik spójności łapie podstawione sprzeczności.
5. RLS szczelny (testy), 2FA działa, eksport/usunięcie danych działa.
6. 5 kont pilotażowych używa aplikacji tydzień bez asysty developera.
