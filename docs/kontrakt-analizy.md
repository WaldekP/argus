# Kontrakt API — Analizy niespójności (feature poza briefem, na życzenie usera 2026-07-24)

User wpisuje temat i wskazuje cel (konkretni posłowie albo klub). Argus zbiera ich
wystąpienia i głosowania z API Sejmu, znajduje niespójności (wypowiedź vs wypowiedź,
wypowiedź vs głosowanie) z cytatami i datami. Dodatkowo można wgrać własny dokument
(PDF / TXT / MD) z analizą — jego twierdzenia są weryfikowane względem zebranych danych.

Konwencja wywołań jak w `docs/kontrakt-task-2-3.md` (POST `/functions/v1/argus-analysis`,
`operation` w body, `{ok, data|error}`).

## Model danych (migracja)

- `analyses` (tenant, RLS per tenant): topic, target_type ('mps'|'club'), target_name,
  target_mp_ids int[], status ('collecting'|'analyzing'|'ready'|'error'), progress jsonb
  (stan porcjowania), findings jsonb, created_at/updated_at + trigger.
- `analysis_documents` (tenant): analysis_id FK cascade, filename, mime, text (wyekstrahowany,
  cap 60k znaków), chars int.
- `sejm_mp_votes` (GLOBALNA, jak sejm_votings): mp_id int, voting_id uuid FK sejm_votings,
  vote public.vote_value, unique(mp_id, voting_id); RLS: select authenticated, zapis service_role.
  Indeksy: (mp_id), (voting_id).
- Wystąpienia celów trafiają do GLOBALNEJ `sejm_statements` (mp_id, date, text, embedding)
  z dedupem — kolejne analizy tego samego posła są szybsze (dane już są).

## Operacje `argus-analysis`

### `targets_search` — wyszukiwanie celu

Req: `{ operation: "targets_search", query: string }` (min 2 znaki)
Res data: `{ mps: [{ mp_id, full_name, club, active }], clubs: [{ id: string, name: string, mp_count: number }] }`
(mps max 10 po nazwisku; clubs: wszystkie kluby pasujące do query albo wszystkie gdy query
pasuje do nazwy klubu; lista klubów agregowana z listy posłów term10)

### `create` — nowa analiza

Req: `{ operation: "create", topic: string (min 5), target: { type: "mps", mp_ids: number[] } | { type: "club", club: string } }`
- `mp_ids` 1-5 posłów. Dla `club`: serwer wybiera do 5 najaktywniejszych posłów klubu
  (najwięcej wystąpień w skanowanym oknie; fallback: pierwsi z listy) i zapisuje ich
  w `target_mp_ids`; `target_name` = nazwa klubu.
Res data: `{ analysis_id: uuid, target_mp_ids: number[], target_name: string }`
Status po create: 'collecting'.

### `add_document` — wgranie dokumentu (przed lub po analizie)

Req: `{ operation: "add_document", analysis_id, filename: string, mime: string, content_base64?: string, text?: string }`
- `.txt` / `.md`: frontend wysyła `text` wprost (odczyt po stronie klienta).
- `.pdf`: frontend wysyła `content_base64` (limit 5 MB); backend ekstrahuje tekst
  (npm:unpdf). PDF bez warstwy tekstowej (skan) → błąd po polsku.
- Tekst przycinany do 60k znaków (z adnotacją w odpowiedzi `truncated: true`).
Res data: `{ document_id: uuid, chars: number, truncated: boolean }`
Jeśli analiza była 'ready', dodanie dokumentu NIE restartuje jej automatycznie —
frontend woła `reanalyze`.

### `collect_step` — porcjowane zbieranie danych (pętla jak import w onboardingu)

Req: `{ operation: "collect_step", analysis_id }`
Res data: `{ phase: "statements"|"votes"|"embeddings"|"done", processed, total, next: boolean }`
- statements: wystąpienia targetów z ostatnich 30 dni posiedzeń → globalna `sejm_statements`
  (dedup: mp_id + date + hash tekstu); już zaimportowane dni pomijane (kolejne analizy szybkie).
- votes: głosowania targetów → `sejm_mp_votes` (upsert), `sejm_votings` uzupełniane.
- embeddings: brakujące embeddingi w `sejm_statements` porcjami po 3.
- Po done → status 'analyzing'.

### `analyze_step` — porcjowana analiza (pętla)

Req: `{ operation: "analyze_step", analysis_id }`
Res data: `{ phase: "retrieval"|"findings"|"documents"|"done", processed, total, next: boolean }`
- retrieval: embedding tematu → top 12 wypowiedzi per target (match po sejm_statements,
  filtr mp_id) + głosowania w temacie (dopasowanie po tytule/topic_tags przez embedding
  tytułów albo prosty ranking Haiku) → zapis wyboru do progress.
- findings: Sonnet, jeden target na wywołanie: pary niespójności z cytatami
  (twardo: cytaty TYLKO z dostarczonych tekstów, daty przy każdym; brak niespójności
  = pusta lista, bez wymyślania).
- documents: jeśli są dokumenty — weryfikacja twierdzeń usera względem zebranych danych
  (jeden dokument na wywołanie, Sonnet).
- done: status 'ready'.

### Kształt `findings` (w `get`)

```json
{
  "items": [{
    "kind": "wypowiedz-wypowiedz" | "wypowiedz-glosowanie" | "glosowanie-glosowanie",
    "severity": 1 | 2 | 3,
    "mp_id": 123, "mp_name": "...",
    "title": "krótki opis niespójności",
    "description": "wyjaśnienie na czym polega sprzeczność",
    "evidence": [{ "type": "statement"|"vote", "quote": "dosłowny cytat albo opis głosowania", "date": "2026-03-14", "ref": "sejm_statements.id albo sejm_votings.id" }],
    "suggested_use": "jak można to wykorzystać w debacie, rzeczowo"
  }],
  "document_review": [{
    "document_id": "uuid", "filename": "...",
    "claims": [{ "claim": "twierdzenie z dokumentu", "verdict": "potwierdzone"|"sprzeczne"|"brak danych", "explanation": "..." }]
  }],
  "sources_summary": { "statements": 48, "votes": 120, "documents": 1 }
}
```

### `reanalyze` — ponowna analiza (np. po dodaniu dokumentu)

Req: `{ operation: "reanalyze", analysis_id }` → resetuje fazę analizy (status 'analyzing',
zebrane dane zostają) → frontend woła pętlę `analyze_step`.

### `get` / `list` / `delete`

- `get { analysis_id }` → pełna analiza (w tym documents: [{id, filename, chars}]).
- `list {}` → `{ analyses: [{ id, topic, target_name, status, created_at, findings_count, documents_count }] }` (desc, max 50).
- `delete { analysis_id }` → usuwa analizę i dokumenty (dane globalne zostają).

## Frontend

```text
src/app/(tabs)/index.tsx — sekcja "Analizy niespójności" (karta z opisem + CTA) → /analysis
src/app/analysis/index.tsx — lista analiz (temat serif, cel, status chip, liczba ustaleń,
  data) + CTA "Nowa analiza"; pull-to-refresh; empty state.
src/app/analysis/new.tsx — temat; przełącznik celu: Posłowie i posłanki (szukajka multi,
  max 5, chipy z usuwaniem) / Klub (targets_search po nazwie klubu, wybór jednego);
  sekcja Dokumenty (picker .pdf/.txt/.md przez expo-document-picker + expo-file-system,
  base64 dla pdf, tekst dla txt/md; lista załączników z usuwaniem przed wysłaniem);
  CTA "Analizuj" → create → add_document(y) → pętla collect_step ("Zbieram wystąpienia",
  "Zbieram głosowania", "Liczę wektory") → pętla analyze_step ("Szukam niespójności",
  "Weryfikuję dokument") → replace /analysis/[id]. Info przy starcie: pierwsza analiza
  nowego celu może potrwać kilkanaście minut, kolejne są szybsze.
src/app/analysis/[id].tsx — nagłówek (temat, cel, status), sources_summary jako meta,
  ustalenia jako karty: badge severity (3 = error "Poważna", 2 = accent "Istotna",
  1 = textSecondary "Drobna"), tytuł, opis, dowody jako cytaty (Cormorant italic, lewy
  border złoty, data + typ), "Jak wykorzystać" jako sekcja; sekcja "Weryfikacja dokumentu"
  (claim + kolorowy verdict: sprzeczne=error, potwierdzone=success, brak danych=textSecondary);
  dodanie kolejnego dokumentu (picker) + "Analizuj ponownie" (reanalyze + pętla analyze_step);
  usunięcie analizy z potwierdzeniem.
Trasy w root Stack: "analysis/index"? — katalog src/app/analysis/ z _layout nie jest
konieczny; zarejestrować w root _layout jak content/*.
Klient: src/lib/api/analysis.ts (wzorzec content.ts: normalizacje, runCollect/runAnalyze
z retry kroku do 3 razy).
```

Eventy PostHog: użyj istniejącej unii — dodaj `analysis_created`, `analysis_viewed`,
`analysis_document_added` do `src/lib/analytics/events.ts`.

---

# Rozjazdy z klubem (dodane 2026-09-18)

Osobna ścieżka w tej samej funkcji, bo pracuje na tych samych tabelach globalnych
(`sejm_votings`, `sejm_mp_votes`), ale nie tworzy analizy w tabeli `analyses`.
Silnik: `_shared/vote-divergence.ts` (arytmetyka czysta, bez modelu i bez sieci).

## Po co

Pomiar z 17 września 2026 na rzeczniku Konfederacji: **4 wystąpienia sejmowe
i 935 głosów** w pół roku. Karta polityka medialnego oparta na wystąpieniach
byłaby pusta dokładnie dla tych osób, dla których ma powstać. Materiał jest
w głosowaniach.

## Punkt odniesienia: stanowisko większości klubu (decyzja usera 2026-09-18)

Nie lider klubu. API Sejmu nie zna pojęcia lidera, lista liderów wymagałaby
ręcznego utrzymania, a lider bywa nieobecny (Mentzen opuścił 263 z 935 głosowań).
Przy trójwartościowym głosie mediana sprowadza się do dominanty, dlatego w kodzie
mowa o stanowisku większości.

Pomiar pokazał, że to nie jest kosmetyczna różnica. Wawer kontra Mentzen daje
**45 rozjazdów**, Wawer kontra stanowisko klubu daje **1 na 853**. Pierwsza liczba
mierzyła odchylenie Mentzena, nie Wawra.

Dwa parametry w `vote-divergence.ts`:

- `MIN_CLUB_SHARE` = 0,75. Bez progu podział klubu 9 do 7 produkowałby „rozjazd"
  dla siedmiu posłów naraz. Czułość sprawdzona na Konfederacji: próg 0,6 daje
  3 rozjazdy Wawra, 0,75 daje 1, 0,9 daje 0.
- `MIN_CLUB_CASTING` = 3. Kluby kilkuosobowe nie mają „większości".

Stanowisko klubu liczymy **bez głosu badanego posła**. Inaczej pojedynczy
odszczepieniec obniżałby próg sam sobie i w małym klubie chował własny rozjazd.

## `divergence_collect_step` — porcjowane zbieranie głosów klubu

Req: `{ operation: "divergence_collect_step", mp_id: number, months?: 1-12 (domyślnie 6), member_index?: number }`
Res data: `{ club, members, member_index, member_mp_id, days_processed, days_skipped, votes, next, next_member_index }`

Jeden poseł klubu na wywołanie, klient woła w pętli aż `next` będzie fałszywe.
`importGlobalMpVotesForDays` pomija dni już pokryte, więc drugi przebieg tego
samego klubu jest niemal darmowy. Dane globalne: raz zebrany klub służy każdemu
tenantowi i każdemu swojemu członkowi.

Dlaczego per poseł, a nie przez pełne wyniki głosowań (`/votings/{sitting}/{nr}`):
pełny wynik to około 200 kB na głosowanie (460 posłów), czyli ~187 MB na pół roku.
Zapytania per poseł to 18 × 76 lekkich odpowiedzi, około 6 MB. Dwa rzędy wielkości.

## `divergence_get` — wynik

Req: `{ operation: "divergence_get", mp_id: number, months?: 1-12 }`
Res data (status `ready`):
`{ status, mp, window, club_size, votings, comparable, club_split, mp_absent,
   attendance: { total, cast, absent, share }, divergences, groups[] }`

`groups[]` to rozjazdy **zwinięte do spraw** (`collapseByBill`): jedna ustawa to
jedno ustalenie, nie kilkadziesiąt. 17 lipca 2026 rzecznik wstrzymał się przy
28 kolejnych poprawkach do jednego druku; to jedna decyzja polityczna.

Status `needs_collect` oznacza, że głosy klubu nie są jeszcze zebrane. Bez tego
bezpiecznika funkcja zwracałaby „zero rozjazdów", co wygląda jak wynik, a jest
brakiem danych.

**Mianownik jest częścią wyniku.** Liczba rozjazdów bez `comparable` nie znaczy nic:
1 na 853 to informacja o żelaznej dyscyplinie, nie o odszczepieństwie, i UI musi
umieć pokazać jedno i drugie.
