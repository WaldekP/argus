# Kontrakt: teczka oponenta

## Po co

Petru chce przed debatą albo wywiadem dostać wszystkie dostępne wypowiedzi
przeciwnika z ostatniego roku, zwłaszcza kontrowersyjne, sprzeczne z programem
jego partii albo z tym, co wydarzyło się później, żeby móc wytykać błędy.

Brief przedwywiadowy tego nie dawał. Oponenta znał tylko wtedy, gdy był posłem,
i tylko z API Sejmu (głosowania, rozjazdy z klubem, wystąpienia z mównicy).
Politycy medialni prawie nie mówią z mównicy, a osoba spoza Sejmu dostawała
„brak danych". Teczka zbiera wypowiedzi z sieci przez narzędzie web search API Claude.

Decyzje usera (2026-10-08): osobna teczka z linkiem z briefu, lista wypowiedzi
z dowodami, do ok. 1-2 USD na teczkę, zapis per tenant z ręcznym odświeżaniem.

## Model danych

Tabela `opponent_dossiers` (dane tenanta, RLS „pełny dostęp w tenancie",
migracja `20261008100000_opponent_dossiers.sql`):

| Kolumna | Znaczenie |
| --- | --- |
| `full_name`, `role_hint`, `party`, `mp_id`, `notes` | identyfikacja osoby; funkcja i partia odsiewają imienników |
| `status` | `collecting` / `done` / `error` |
| `pass_index` | indeks następnego przebiegu w `PASSES` |
| `items` | pozycje teczki (jsonb, kształt niżej) |
| `summary` | w trakcie: `identity_notes`, `failed_passes`; po syntezie także `linia`, `punkty_ataku`, `czego_unikac`, `luki` |
| `sources` | pula adresów zwróconych przez wyszukiwarkę, przeciw której walidujemy pozycje |
| `search_count` | liczba wykonanych wyszukiwań (koszt) |

Pozycja (`items[]`): `id` („w1"), `date` (RRRR-MM-DD, RRRR-MM albo null), `quote`
(dosłownie albo z prefiksem „[parafraza]"), `context`, `source_url`, `source_title`,
`category` (`kontrowersja` | `sprzecznosc-z-programem` | `zmiana-zdania` |
`zweryfikowane-przez-fakty` | `wypowiedz`), `why_it_matters`, `later_facts`,
`later_facts_url`, `pass`.

## Edge Function `argus-opponents`

| Operacja | Wejście | Wyjście |
| --- | --- | --- |
| `create` | `full_name`, opcjonalnie `role_hint`, `party`, `mp_id`, `notes` | `{ id }` |
| `step` | `id` | `{ phase, processed, total, next, items_count }` |
| `get` | `id` | teczka + `passes` (lista przebiegów z etykietami) |
| `list` | brak | teczki tenanta z `items_count`, bez pozycji |
| `refresh` | `id` | `{ id }`; przebiegi od zera, dotychczasowe pozycje zostają jako „już zebrane" |
| `delete` | `id` | `{ deleted: true }` |

Klient woła `step` w pętli aż do `next: false` (`runDossier` w `src/lib/api/opponents.ts`).

## Przebiegi

`PASSES` w `_shared/opponent-research.ts`: wywiady w radiu i TV, prasa/portale/podcasty,
kontrowersje, media społecznościowe (przez relacje mediów), program partii i zmiany
zdania, „co wydarzyło się później" (uzupełnia `later_facts` istniejących pozycji),
synteza bez wyszukiwania. Każdy przebieg z wyszukiwaniem to jedno wywołanie
`claude-sonnet-5` z `web_search_20250305` (`max_uses` 4-5) i narzędziem
`zapisz_wyniki` ze `strict: true`. Synteza idzie przez structured outputs.

Pomiar 2026-10-08 (Michał Wawer): przebieg 38-79 s, 5-11 pozycji, pełna teczka ok.
40 pozycji w ok. 7 minut. `web_search_20260209` (dynamiczne filtrowanie) trwało
ponad 300 s i nie mieści się w limicie workera.

## Zasady, które pilnuje kod (nie prompt)

- **Źródło z puli.** Pozycja, której `source_url` nie pojawił się w wynikach wyszukiwania
  (`web_search_tool_result`), jest odrzucana (`mergeItems` w `_shared/opponent-dossier.ts`).
  To samo dotyczy `later_facts_url`. W próbie odrzuciło to 1 pozycję na 40.
- **Punkt ataku bez pozycji nie istnieje.** `normalizeSummary` usuwa punkty, których
  `item_ids` nie wskazują istniejących pozycji.
- **Nieudany przebieg to luka, nie awaria.** Trafia do `summary.failed_passes` i na ekran
  („czego teczka nie obejmuje"). Wyjątek: trwała odmowa API (4xx poza 408 i 429, np.
  brak środków na koncie) zatrzymuje teczkę ze statusem `error`, żeby pusta teczka nie
  udawała, że nic nie znaleziono.
- **Bezpiecznik kosztów:** najwyżej 10 uruchomień (nowa albo odświeżona teczka)
  na tenanta na dobę (`MAX_RUNS_PER_TENANT_PER_DAY`).

## Powiązanie z briefem

`argus-brief` przy generacji szuka gotowej teczki tenanta dla osoby z obsady
(po `mp_id` albo znormalizowanym nazwisku) i dokleja do kontekstu oponenta linię,
punkty ataku, do 12 pozycji (najpierw kontrowersje i sprzeczności) oraz luki.
Dla osoby spoza Sejmu teczka zastępuje dotychczasowe „brak danych". Operacja `get`
zwraca `opponent_dossiers`, a ekran briefu pokazuje przycisk „Teczka oponenta"
albo „Przygotuj teczkę" (formularz wypełniony imieniem, klubem i `mp_id`).

## Granice

- Brak dostępu do samych platform (X, Facebook, TikTok): wpisy tylko przez relacje mediów.
  Nasłuch X/TikTok jest poza zakresem MVP.
- Cytat pochodzi z wyszukiwarki, nie z pobranej strony, więc brzmienie trzeba sprawdzić
  w źródle przed użyciem na antenie. Ekran mówi to wprost.
- Teczka nie pobiera wystąpień sejmowych; dla posłów brief łączy ją z danymi z sond.
