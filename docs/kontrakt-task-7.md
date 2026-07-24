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

Req: `{ operation: "create", topic: string, core_message?: string, segment_ids: uuid[], channels: string[] }`
- `topic` wymagany (min 5 znaków), `channels` min 1.
- `segment_ids` może być puste: wtedy generujemy warianty "ogólne" (segment_id: null, segment_name: "Ogólny").
Res data: `{ draft_id: uuid, total_variants: number }` (total = max(1, |segments|) × |channels|)
Draft w `content_drafts` ze status 'draft', variants '[]'.

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

Req: `{ operation: "list" }`
Res data: `{ drafts: [{ id, topic, status, created_at, variants_count: number, alerts_count: number }] }` (sort: created_at desc, max 50)

### `regenerate_variant` — nowa wersja jednego wariantu

Req: `{ operation: "regenerate_variant", draft_id: uuid, segment_id: uuid|null, channel: string, feedback?: string }`
Res data: `{ variant: { segment_id, segment_name, channel, text } }` (nadpisany w drafcie)

### `set_status` — akcept / odrzucenie draftu

Req: `{ operation: "set_status", draft_id: uuid, status: "accepted"|"rejected" }`
Res data: `{ ok: true }`

## Frontend — ekrany

```text
src/app/(tabs)/content.tsx — lista draftów (status, temat, data, liczba wariantów
  i alertów) + CTA "Nowy przekaz"; pull-to-refresh; empty state zachęcający.
src/app/content/new.tsx    — formularz: temat, kluczowy komunikat (opcjonalny),
  wybór segmentów (chips z list_segments; brak segmentów = informacja o trybie
  ogólnym), wybór kanałów (4 pigułki) → create + pętla generate_step z paskiem
  postępu ("Wariant X z Y", potem "Sprawdzam spójność") → replace do content/[id].
src/app/content/[id].tsx   — draft: baner alertów spójności (lewy border w kolorze
  error, tło rgba error .14) gdy są, warianty grupowane per segment, karta wariantu:
  etykieta kanału, tekst, przyciski Kopiuj (expo-clipboard, zainstalowany,
  track('content_variant_copied')) i Wygeneruj ponownie (opcjonalne pole uwag),
  na dole Akceptuj / Odrzuć (set_status).
Rejestracja tras: app/content/new.tsx i app/content/[id].tsx w root Stack.
```

Klient API: `src/lib/api/content.ts` (wzorzec z `onboarding.ts`, w tym normalizacja
odpowiedzi — defaulty na brakujące pola). Event `content_generated` po zakończeniu
pętli generacji.
