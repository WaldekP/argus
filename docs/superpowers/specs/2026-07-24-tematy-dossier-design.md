# Spec: Feature „Tematy" — dossier tematyczny do self-briefingu

**Data:** 2026-07-24
**Status:** projekt do implementacji
**Decyzja usera:** osobny feature, niezależny od „Analiz niespójności".

## 1. Problem i cel

Polityk (tenant, np. Ryszard Petru) potrzebuje szybko zbriefować się na temacie
przekrojowym (np. „Kwota wolna 60 tys. vs obniżka składki zdrowotnej"). Gruba analiza
powstaje poza aplikacją (NotebookLM, deep research). Argus przyjmuje ten dokument i
zamienia go w **dossier gotowe do użycia**: podsumowanie, kluczowe liczby, przewidywane
pytania z odpowiedziami oraz linie ataku i obrony. Dodatkowo asystent może dopytać AI
o pojedyncze rzeczy z tego tematu.

To NIE jest brief przedwywiadowy (TASK 5) ani analiza niespójności przeciwnika
(`docs/kontrakt-analizy.md`). To własne, statyczne dossier tematyczne.

### Zakres (MVP)
- Wgranie jednego lub wielu dokumentów (.pdf / .md / .txt) do tematu.
- Wygenerowanie dossier: podsumowanie egzekutywne, kluczowe liczby, przewidywane
  pytania (dziennikarze + rywale) z rekomendowanymi odpowiedziami, linie ataku i obrony.
- Pojedyncze dopytanie AI o temat (bez zapisywanej historii rozmowy).
- Lista tematów, podgląd, ponowne wygenerowanie po dodaniu dokumentu, usunięcie.

### Poza zakresem (świadomie)
- Czat z historią rozmowy (wybrano „pojedyncze pytania bez historii").
- Dociąganie danych z API Sejmu i z korpusów `docs/` — grounding wyłącznie z wgranych
  dokumentów.
- Ustawianie perspektywy per temat — perspektywa = styl polityka tenanta.

## 2. Decyzje projektowe (zatwierdzone przez usera)

1. **Grounding = tylko wgrany dokument.** Bez API Sejmu, bez korpusów `docs/`. NotebookLM
   robi grubą robotę merytoryczną; Argus streszcza i porządkuje jego wynik. Twarda zasada
   promptów: cytaty i liczby wyłącznie z dostarczonych dokumentów; brak danych = „brak
   danych w źródle", zero zmyślania.
2. **Perspektywa = automatycznie `style_profile` polityka tenanta** (nie ustawiana per temat).
   Styl wstrzykiwany do tonu podsumowania, odpowiedzi na pytania i przekazów.
3. **Pojedyncze pytania bez historii** — operacja `ask` zwraca jednorazową odpowiedź,
   nic nie zapisujemy.

## 3. Model danych (nowa migracja)

Wzorzec jak `20260724100000_analysis_inconsistency.sql`: RLS per tenant, trigger `updated_at`.

### `topics` (per tenant, RLS)
| Kolumna | Typ | Uwagi |
| --- | --- | --- |
| `id` | uuid PK | |
| `tenant_id` | uuid | FK, RLS: zgodny z tenantem usera |
| `title` | text | temat, min 5 znaków |
| `status` | text | `generating` \| `ready` \| `error` |
| `progress` | jsonb | stan porcjowania (faza, offset) |
| `dossier` | jsonb | wynik generacji (kształt niżej) |
| `source_chars` | int | suma znaków źródeł (meta) |
| `created_at` / `updated_at` | timestamptz | trigger na updated_at |

### `topic_documents` (per tenant, RLS)
| Kolumna | Typ | Uwagi |
| --- | --- | --- |
| `id` | uuid PK | |
| `tenant_id` | uuid | RLS |
| `topic_id` | uuid | FK `topics` ON DELETE CASCADE |
| `filename` | text | |
| `mime` | text | |
| `text` | text | wyekstrahowany tekst, cap 60k znaków |
| `chars` | int | |
| `created_at` | timestamptz | |

Indeksy: `topic_documents(topic_id)`, `topics(tenant_id)`.
RLS na obu tabelach + test tenant A nie widzi danych tenanta B (warunek zaliczenia migracji,
jak w CLAUDE.md).

### Kształt `dossier` (jsonb)
```json
{
  "summary": "podsumowanie egzekutywne, 5-8 zdań",
  "key_numbers": [
    {
      "label": "Koszt kwoty wolnej 60k",
      "value": "45-56 mld zł/rok",
      "status": "zweryfikowane" | "do weryfikacji",
      "context": "krótki kontekst / źródło z dokumentu"
    }
  ],
  "questions": [
    {
      "asker": "dziennikarz" | "rywal",
      "asker_detail": "np. Konfederacja / prowadzący TVN24",
      "question": "treść pytania",
      "answer": "rekomendowana odpowiedź w stylu polityka",
      "trap": "opcjonalna pułapka / na co uważać (może być pusty string)"
    }
  ],
  "attack_defense": {
    "attack": [
      {
        "target": "np. Konfederacja",
        "claim": "mocny punkt",
        "evidence": "cytat/liczba z dokumentu + data",
        "message": "gotowy przekaz",
        "caution": "uwaga na kontrę / co uczciwie zaznaczyć (może być pusty)"
      }
    ],
    "defense": [
      {
        "attack": "zarzut, który mogą postawić nam",
        "response": "jak się bronić",
        "bridge": "most z powrotem do naszego przekazu"
      }
    ]
  }
}
```
Puste sekcje = puste tablice (nie null). `status` liczby zależy od oznaczeń w źródle
(np. `[do weryfikacji]` w dokumencie → `"do weryfikacji"`).

## 4. Edge Function `argus-topics`

Konwencja jak reszta (`docs/kontrakt-task-2-3.md`): POST `/functions/v1/argus-topics`,
CORS preflight → weryfikacja tokena `supabase.auth.getUser` → walidacja `tenant_id` →
operacja. Odpowiedź `{ ok: true, data } | { ok: false, error }`. Klucz Claude i
`service_role` tylko po stronie funkcji.

### Operacje

**`create { title }`** → `{ topic_id }`. Status `generating`. Waliduje `title` min 5 znaków.

**`add_document { topic_id, filename, mime, content_base64?, text? }`**
→ `{ document_id, chars, truncated }`.
- `.md` / `.txt`: frontend wysyła `text` (odczyt po stronie klienta).
- `.pdf`: `content_base64` (limit 5 MB); backend ekstrahuje tekst (npm:unpdf).
  PDF bez warstwy tekstowej (skan) → błąd po polsku.
- Tekst przycinany do 60k znaków (`truncated: true` w odpowiedzi).
- Jeśli temat był `ready`, dodanie dokumentu NIE restartuje generacji; frontend woła
  `regenerate`.

**`generate_step { topic_id }`** → `{ phase, processed, total, next }`.
Porcjowana pętla (limit workera Edge Functions). Wejście: konkatenacja `text` wszystkich
dokumentów tematu. Fazy:
- `summary` — Sonnet: podsumowanie egzekutywne (5-8 zdań), ton w stylu polityka.
- `numbers` — Sonnet: wyciągnięcie kluczowych liczb wyłącznie z dokumentu; `status`
  z oznaczeń w źródle.
- `questions` — Sonnet: przewidywane pytania z odpowiedziami. Dwa przebiegi (najpierw
  `dziennikarz`, potem `rywal`), reprezentowane przez `processed/total`; odpowiedzi w stylu
  polityka, pułapki gdy zasadne.
- `attack_defense` — Sonnet: linie ataku (wobec przeciwników z dokumentu, z `caution`)
  i obrony (zarzuty wobec nas + most).
- `done` — status `ready`.

**`ask { topic_id, question }`** → `{ answer }`. Sonnet, kontekst = dokumenty tematu +
`style_profile`. Ugruntowane w dokumentach; brak danych = „brak danych w źródle". Nic nie
zapisujemy.

**`regenerate { topic_id }`** — reset fazy generacji (status `generating`, dokumenty zostają),
frontend woła pętlę `generate_step`.

**`get { topic_id }`** → pełny temat + `documents: [{ id, filename, chars }]` + `dossier`.

**`list {}`** → `{ topics: [{ id, title, status, created_at, questions_count, documents_count }] }`
(desc, max 50).

**`delete { topic_id }`** — usuwa temat i dokumenty (cascade).

### Prompty
Po polsku, w `backend/supabase/functions/_shared/prompts/`, wersjonowane. Wstrzykiwany
`style_profile`. Twarde zasady: zakaz zmyślania cytatów/liczb, brak danych = „brak danych",
linie przekazu nie mogą być merytorycznie sprzeczne z dokumentem.

## 5. Frontend

Umiejscowienie (korekta po odkryciu kodu): w projekcie istnieje już zakładka **„Tematy"**
(`src/app/(tabs)/topics.tsx`), która przeglądała statyczne korpusy (`lib/knowledge`,
trasa `/temat/[slug]`). Feature nie dostaje osobnej zakładki — rozbudowujemy istniejącą:
u góry sekcja „Twoje tematy" (dossiery z uploadu) + CTA „Nowy temat", niżej bez zmian
„Korpusy tematyczne". Ekrany `new` i `[id]` to trasy Stack (jak `content/*`), zarejestrowane
w root `_layout` jako `topics/new` i `topics/[id]`.

- **`src/app/(tabs)/topics.tsx`** — rozbudowana zakładka: lista dossierów (tytuł Cormorant,
  status chip, liczba dokumentów/pytań, data), CTA „Nowy temat" → `/topics/new`,
  pull-to-refresh, empty state (oko Argusa); pod spodem zachowane korpusy tematyczne.
- **`src/app/topics/new.tsx`** — pole `title`; sekcja Dokumenty (picker .pdf/.md/.txt przez
  `expo-document-picker` + `expo-file-system`, base64 dla pdf, tekst dla md/txt; lista
  załączników z usuwaniem przed wysłaniem); CTA „Wygeneruj dossier" → `create` →
  `add_document(y)` → pętla `generate_step` z etykietami („Streszczam", „Wyciągam liczby",
  „Układam pytania", „Szykuję linie ataku i obrony") → `replace /topics/[id]`. Info przy
  starcie: generacja może potrwać do minuty.
- **`src/app/topics/[id].tsx`** — nagłówek (tytuł, status, meta: liczba dokumentów/znaków);
  sekcje:
  - **Podsumowanie egzekutywne** — body.
  - **Kluczowe liczby** — karty: `label`, `value` (Cormorant, złote), chip `status`
    (zweryfikowane = success, do weryfikacji = warning), `context`.
  - **Przewidywane pytania** — karty: badge kto pyta (dziennikarz = teal, rywal = złoto)
    + `asker_detail`, `question`, `answer`, `trap` (gdy niepusty, jako uwaga). Grupowane
    lub filtrowane po `asker`.
  - **Linie ataku i obrony** — dwie podsekcje: ataki (akcent złoty: `target`, `claim`,
    `evidence`, `message`, `caution`) i obrona (akcent teal: `attack`, `response`, `bridge`).
  - **„Zapytaj o ten temat"** — pole + przycisk → `ask` → jednorazowa odpowiedź pod polem.
  - dodanie kolejnego dokumentu (picker) + „Wygeneruj ponownie" (`regenerate` + pętla);
    usunięcie tematu z potwierdzeniem.
- **Klient `src/lib/api/topics.ts`** — wzorzec `content.ts` / `analysis.ts`: typy, normalizacje
  odpowiedzi AI, `runGenerate` z retry pojedynczego kroku do 3 razy.

Kolory wyłącznie z `src/constants/Colors.ts`. Teksty UI po polsku, bez półpauz, bez emoji,
pisownia inkluzywna z podkreślnikiem (CLAUDE.md „Konwencje tekstów UI").

## 6. Analytics (PostHog)

Dodać do unii w `src/lib/analytics/events.ts`:
`topic_created`, `topic_viewed`, `topic_document_added`, `topic_question_asked`.

## 7. Ponowne użycie istniejących wzorców

- Picker dokumentów + ekstrakcja PDF: jak `src/app/analysis/new.tsx` + `add_document`
  z kontraktu analiz.
- Porcjowana pętla generacji: jak `argus-content` / `runCollect`/`runAnalyze` w kliencie.
- Moduł AI: `backend/supabase/functions/_shared/ai.ts`; pipeline'y w `_shared/pipelines/`
  jeśli zasadne; prompty w `_shared/prompts/`.

## 8. Kryteria akceptacji

1. Nowy temat: wgranie briefu 16 (jako .md) → dossier z sensownym podsumowaniem, liczbami
   ze `[do weryfikacji]` poprawnie oznaczonymi, pytaniami dziennikarzy i rywali oraz liniami
   ataku na Konfederację i obrony.
2. `ask` odpowiada z dokumentu i mówi „brak danych w źródle", gdy pytanie wykracza poza treść.
3. RLS: tenant B nie widzi tematów ani dokumentów tenanta A (test).
4. Dodanie dokumentu + `regenerate` odświeża dossier.
5. Eventy PostHog lecą dla create/viewed/document_added/question_asked.
6. Kolory z Colors.ts, teksty zgodne z konwencją copy.
