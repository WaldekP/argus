# Kontrakt API — TASK 2 (ingest Sejmu + embeddingi) i TASK 3 (onboarding)

Wiążący kontrakt między backendem (Edge Functions) a frontendem (ekrany onboardingu).
Zmiany kontraktu wymagają aktualizacji tego pliku.

## Konwencja wywołań

- `POST {SUPABASE_URL}/functions/v1/argus-onboarding`
- Nagłówki: `Authorization: Bearer <access_token usera>`, `apikey: <klucz publishable>`, `Content-Type: application/json`
- Body: `{ "operation": "<nazwa>", ...parametry }`
- Odpowiedź: `{ "ok": true, "data": {...} }` albo `{ "ok": false, "error": "komunikat po polsku" }`

## Operacje `argus-onboarding`

### `search_mp` — wyszukiwanie posła (ekran importu)

Req: `{ operation: "search_mp", query: string }` (fragment nazwiska, min 2 znaki)
Res data: `{ mps: [{ mp_id: number, full_name: string, club: string, district_name: string, active: boolean }] }` (max 10)

### `import_sejm_data` — import danych posła (pętla porcjowana)

Req: `{ operation: "import_sejm_data", mp_id: number }`
Res data: `{ phase: "votings"|"statements"|"embeddings"|"done", processed: number, total: number, next: boolean, imported?: { votings, votes, statements }, profile?: {...} }`

Jedno wywołanie wykonuje JEDEN mały krok importu (limit zasobów workera Edge
Functions uniemożliwia import w jednym wywołaniu). Frontend woła operację
w pętli z tym samym `mp_id`, aż dostanie `next: false`; `processed/total`
służy do paska postępu w ramach bieżącej fazy.

Przebieg:

1. Pierwsze wywołanie inicjalizuje import: upsert `politician_profiles`
   (mp_id, full_name, district, `onboarding_status='importing'`), czyści
   poprzednie `statements` z source='sejm' i zapisuje stan importu.
2. `phase: "votings"` — głosowania posła (do 200): upsert `sejm_votings`
   globalnie + `politician_votes` tenanta, po ok. 3 dni posiedzeń na wywołanie.
3. `phase: "statements"` — wystąpienia posła (do 100, skan do 60 dni posiedzeń
   wstecz): insert do `statements` (source='sejm') bez embeddingów.
4. `phase: "embeddings"` — uzupełnianie kolumny `embedding` w porcjach po ~10
   tekstów na wywołanie (wiersze z `embedding IS NULL` = jeszcze nieprzetworzone).
5. `phase: "done"`, `next: false` — koniec; odpowiedź zawiera `imported`
   ({ votings, votes, statements }) i `profile`; `onboarding_status='interview'`.

Stan postępu importu trzymany w `tenants.settings.sejm_import` (mp_id, faza,
kursory dni, liczniki). Wywołanie z innym `mp_id` albo po `done` zaczyna import
od zera. Błąd pojedynczego kroku można bezpiecznie ponowić tym samym wywołaniem
(kroki są idempotentne: upserty + deduplikacja wystąpień po url).

### `get_status` — stan onboardingu i profil

Req: `{ operation: "get_status" }`
Res data: `{ has_profile: boolean, onboarding_status: "not_started"|"importing"|"interview"|"style"|"segments"|"done", profile: {...}|null, counts: { votes: number, statements: number } }`

### `interview_turn` — wywiad założycielski z AI

Req: `{ operation: "interview_turn", answer?: string }` (bez `answer` = pierwsze pytanie / wznowienie)
Res data: `{ question: string|null, done: boolean, progress: number (0-1), transcript_length: number }`
Po `done: true` backend zapisał `values`, `boundaries`, `bio`, `goals` w profilu
i ustawił `onboarding_status='style'`.
Stan wywiadu trzymany po stronie backendu (kolumna `settings` tenanta, klucz `onboarding_interview`).

### `generate_style_profile` — profil stylu językowego

Req: `{ operation: "generate_style_profile" }`
Res data: `{ style_profile: { ton: string, dlugosc_zdan: string, slownictwo: string[], zwroty_charakterystyczne: string[], czego_unika: string[], przyklad_wypowiedzi: string } }`
Generowany z próbki `statements` posła. Zapisywany w profilu.

### `update_style_profile` — kalibracja stylu

Req: `{ operation: "update_style_profile", feedback: string }` (uwagi usera po polsku)
Res data: `{ style_profile: {...} }` (poprawiony). Po akceptacji frontend woła `finalize_style`.

### `finalize_style` — akceptacja stylu

Req: `{ operation: "finalize_style" }`
Res data: `{ ok: true }`. Ustawia `onboarding_status='segments'`.

### `suggest_segments` — propozycja segmentów wyborców

Req: `{ operation: "suggest_segments" }`
Res data: `{ segments: [{ name: string, size_estimate: number|null, priority: "mobilize"|"persuade"|"ignore", profile: { opis: string, tematy: string[], jezyk_dziala: string[], jezyk_odrzuca: string[], kanaly: string[] } }] }` (5 sztuk, AI na bazie okręgu i profilu)

### `finalize` — zapis segmentów i koniec onboardingu

Req: `{ operation: "finalize", segments: [<segmenty jak wyżej, po edycji usera>] }`
Res data: `{ ok: true }`. Insert do `segments`, `onboarding_status='done'`.

### `debug_search` — pomocnicza weryfikacja wyszukiwania wektorowego (dev only)

Req: `{ operation: "debug_search", query: string, limit?: number }`
Res data: `{ query: string, results: [{ id, date, similarity, excerpt }] }`
Liczy embedding zapytania (gte-small) i woła RPC `match_statements` dla tenanta.
Nie jest częścią UI onboardingu; służy do testów i debugowania.

## Embeddingi (TASK 2)

- Model: `gte-small` przez wbudowane `Supabase.ai.Session` w Edge Functions (bez zewnętrznego
  klucza). Wymiar: **384** — migracja 002 zmienia `vector(1024)` na `vector(384)`.
- Ograniczenie: gte-small jest słabszy dla polskiego; wybór odnotowany w CLAUDE.md,
  wymiana modelu = nowa migracja + re-embed (tabele wciąż małe).
- Migracja 002 dodaje też funkcje RPC wyszukiwania wektorowego (security definer,
  z filtrem tenanta tam, gdzie dotyczy):
  - `match_statements(p_tenant_id uuid, p_query_embedding vector(384), p_limit int)`
  - `match_sejm_statements(p_query_embedding vector(384), p_mp_id int, p_limit int)`
  - `match_news_items(p_query_embedding vector(384), p_limit int)`

## Frontend — ekrany (TASK 3)

```text
src/app/onboarding/
  _layout.tsx   — Stack; wymaga sesji (Redirect do logowania gdy brak)
  index.tsx     — powitanie, opis kroków, CTA "Zaczynamy"
  import.tsx    — szukajka posła (search_mp) → potwierdzenie → import_sejm_data z loaderem → podsumowanie liczb
  interview.tsx — chat wywiadu (interview_turn), pasek postępu
  style.tsx     — pokazany style_profile, pole uwag (update_style_profile), akcept (finalize_style)
  segments.tsx  — lista 5 segmentów (suggest_segments), edycja nazw/priorytetów, akcept (finalize)
```

Gating: `(tabs)/_layout.tsx` — po zalogowaniu pobierz `get_status`; gdy
`onboarding_status != 'done'` → Redirect na właściwy krok onboardingu.
Stan w `src/store/onboarding.ts` (Zustand). Wywołania API w `src/lib/api/onboarding.ts`.
