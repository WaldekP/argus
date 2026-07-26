# Kontrakt API — TASK 7 (generator przekazu)

Wiążący kontrakt między Edge Function `argus-content` a ekranami przekazu.
Konwencja wywołań identyczna jak w `docs/kontrakt-task-2-3.md`
(POST `/functions/v1/argus-content`, `operation` w body, `{ok, data|error}`).

## Kanały

`"fb" | "x" | "tiktok" | "prasa"` — etykiety w UI: Facebook, X, TikTok (skrypt), Prasa lokalna.

## Operacje `argus-content`

### `list_segments` — segmenty tenanta do wyboru w formularzu

Req: `{ operation: "list_segments" }`
Res data: `{ segments: [{ id: uuid, name: string, priority: "mobilize"|"persuade"|"ignore" }] }`
(może być pusta lista, gdy onboarding pominięty)

### `create` — utworzenie draftu

Req: `{ operation: "create", topic: string, core_message?: string, segments?: SegmentInput[], segment_ids?: uuid[], channels: string[], topic_slug?: string, topic_framing?: TopicFraming, topic_ref?: string }`
- `topic` wymagany (min 5 znaków), `channels` min 1.
- Segmenty przez `segments` (tryb "z tematu") albo legacy `segment_ids`. `segments` ma
  pierwszeństwo, gdy niepuste. Puste w obu = jeden wariant "ogólny" (segment_id: null,
  segment_name: "Ogólny").
- `SegmentInput = { id: string, name: string }`. `id` to UUID segmentu tenanta ALBO id segmentu
  korpusu tematycznego z prefiksem `corpus:` (grupa wyborców z bazy wiedzy, nie ma wiersza w
  tabeli `segments`). Nazwę segmentu tenanta bierzemy z bazy (autorytatywna), nazwę segmentu
  korpusu z requestu. Segmenty korpusu (`corpus:`) są pomijane w zapytaniach do tabeli `segments`
  (kolumna `id` jest typu uuid), więc nie mają profilu stylu segmentu — tylko framing.
- `segment_ids` (legacy): wyłącznie UUID segmentów tenanta.
- `topic_slug` i `topic_framing` opcjonalne (most z zakładki Tematy). Gdy podane, framing
  zapisywany jest w `content_drafts.consistency_check._framing` i wstrzykiwany do promptu generacji
  oraz do kontroli spójności. `topic_framing.segments` jest kluczowane tym samym `id` co plan
  (UUID tenanta oraz `corpus:<id>`).
- `topic_ref` opcjonalny: wiąże draft z tematem dla listy per temat. Slug korpusu (np.
  `kwota-wolna`) albo `dossier:<uuid>`. Zapisywany w kolumnie `content_drafts.topic_ref`.
Res data: `{ draft_id: uuid, total_variants: number }` (total = max(1, |segments|) × |channels|)
Draft w `content_drafts` ze status 'draft', variants '[]'.

`TopicFraming` (klient buduje z modelu `Temat`, patrz `docs/plan-wyborczy-petru/faza-2-generator.md`):
```
{
  slug?: string,
  stanowisko?: string,          // rekomendacja.odpowiedz; wariant nie może być z nią sprzeczny
  podchwycic?: string[],         // katy do wykorzystania
  zaatakowac?: string[],         // kontry wobec przeciwników
  segments?: { [tenantSegmentId: uuid]: {
    kat?: string, coDziala?: string[], czegoUnikac?: string[], przyklad?: string
  } }
}
```
Wpływ na generację: `generate_step` wstrzykuje stanowisko, podchwycić, zaatakować i framing per
segment do promptu wariantu; kontrola spójności lite oznacza jako sprzeczność także wariant
sprzeczny z `stanowisko` (nawet gdy brak historii wypowiedzi). `regenerate_variant` używa tego
samego framingu z draftu.

### `generate_step` — porcjowana generacja wariantów (pętla jak przy imporcie)

Req: `{ operation: "generate_step", draft_id: uuid }`
Res data: `{ processed: number, total: number, next: boolean, consistency_done: boolean }`
- Jedno wywołanie generuje do 2 wariantów (Sonnet, styl z `style_profile`,
  wartości/granice z profilu, opis segmentu z `segments.profile`).
- Wariant zapisywany do `content_drafts.variants`: `{ segment_id: uuid|null, segment_name: string, channel: string, text: string }`.
- Po wygenerowaniu wszystkich wariantów ostatnie wywołanie robi kontrolę
  spójności lite: wyszukiwanie wektorowe `match_statements` po temacie,
  ocena sprzeczności (Haiku), wynik do `consistency_check`
  (`{ alerts: [{ description: string, conflict_statement_id: uuid|null, suggested_response: string }] }`)
  + insert do `consistency_alerts` (source_type 'draft', source_id = draft_id).
  Dopiero wtedy `next: false, consistency_done: true`.
- Kroki idempotentne, błąd kroku można ponowić tym samym wywołaniem.

### `get` — pełny draft

Req: `{ operation: "get", draft_id: uuid }`
Res data: `{ draft: { id, topic, core_message: string|null, status: "draft"|"accepted"|"rejected", created_at, variants: [...jak wyżej], consistency_check: { alerts: [...] } } }`

### `list` — lista draftów tenanta

Req: `{ operation: "list", topic_ref?: string }`
- `topic_ref` opcjonalny: zwraca tylko przekazy powiązane z danym tematem (slug korpusu albo `dossier:<uuid>`). Bez niego wszystkie przekazy tenanta.
Res data: `{ drafts: [{ id, topic, topic_ref: string|null, status, created_at, variants_count: number, alerts_count: number }] }` (sort: created_at desc, max 50)

### `regenerate_variant` — nowa wersja jednego wariantu

Req: `{ operation: "regenerate_variant", draft_id: uuid, segment_id: uuid|null, channel: string, feedback?: string }`
Res data: `{ variant: { segment_id, segment_name, channel, text } }` (nadpisany w drafcie)

### `set_status` — akcept / odrzucenie draftu

Req: `{ operation: "set_status", draft_id: uuid, status: "accepted"|"rejected" }`
Res data: `{ ok: true }`

## Frontend — ekrany

Generacja przeniesiona z osobnej zakładki do wnętrza tematu. Wejście: przycisk
"Wygeneruj przekaz" na ekranie zagadnienia (`temat/[slug].tsx`) i dossieru
(`topics/[id].tsx`). Zapisane przekazy widać wyłącznie per temat (na ekranie
danego zagadnienia/dossieru), bez globalnej listy.

```text
src/app/(tabs)/content.tsx — zakładka "Dane": katalog materiałów referencyjnych
  (na razie Programy wyborcze). Bez listy draftów i wolnego generatora.
src/app/content/new.tsx    — generacja "z tematu" (params: topicSlug zagadnienia
  ALBO dossierId + topicName). Temat i stanowisko z kontekstu; formularz: kluczowy
  komunikat (opcjonalny), grupy wyborców w dwóch chipach — "Twoje segmenty"
  (list_segments) i "Segmenty tematu" (segmenty zagadnienia, tylko dla topicSlug) —
  wybór kanałów (4 pigułki) → create (segments[] + topic_ref + topic_framing) +
  pętla generate_step z paskiem postępu → replace do content/[id].
src/app/content/[id].tsx   — draft: baner alertów spójności (lewy border w kolorze
  error, tło rgba error .14) gdy są, warianty grupowane per segment, karta wariantu:
  etykieta kanału, tekst, przyciski Kopiuj (expo-clipboard, zainstalowany,
  track('content_variant_copied')) i Wygeneruj ponownie (opcjonalne pole uwag),
  na dole Akceptuj / Odrzuć (set_status).
src/components/saved-drafts-list.tsx — wspólna lista zapisanych przekazów danego
  tematu (topicRef wymagany w praktyce); używana na ekranie zagadnienia i dossieru.
Rejestracja tras: app/content/new.tsx, app/content/[id].tsx w root Stack.
```

Klient API: `src/lib/api/content.ts` (wzorzec z `onboarding.ts`, w tym normalizacja
odpowiedzi — defaulty na brakujące pola). Event `content_generated` po zakończeniu
pętli generacji.
