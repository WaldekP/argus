# Kontrakt: powiązania z Krajowym Rejestrem Sądowym

Wiążący kontrakt integracji z rejestrem sądowym. Decyzje podjęte 2026-07-24.
Zmiana zachowania wymaga aktualizacji tego pliku.

## Po co to jest

Dziennikarz przed wywiadem sprawdza, w jakich spółkach siedzi polityk. Jeżeli
polityk mówi o rynku mieszkaniowym, a jest wspólnikiem w spółce deweloperskiej,
to pytanie padnie i musi być przygotowana odpowiedź. Argus ma to wiedzieć
wcześniej niż dziennikarz.

## Dwa źródła, świadomie rozdzielone

| | Otwarte API KRS (MS) | Rejestr.io API |
| --- | --- | --- |
| Adres | `api-krs.ms.gov.pl` | `rejestr.io/api/v2` |
| Koszt | darmowe | ok. 0,03 zł za wywołanie z salda konta |
| Klucz | brak | nagłówek `Authorization: <klucz>` |
| Dane osób fizycznych | **zamaskowane** (`K*******`, PESEL `7**********`) | pełne imiona i nazwiska |
| Wyszukiwanie osoby po nazwisku | brak | `GET /osoby?imie=&nazwisko=` |
| Powiązania osoba - spółka | brak | `GET /osoby/{id}/krs-powiazania` |
| Powiązania historyczne | brak | wymagają abonamentu premium (u nas 403) |
| Biuletyn dziennych zmian | `GET /api/Krs/Biuletyn/{RRRR-MM-DD}` | brak taniego odpowiednika |

Podział ról wynika wprost z tej tabeli:

- **Otwarte API wykrywa zmiany.** Biuletyn dzienny zwraca numery KRS zmienione
  danego dnia. To jedno darmowe wywołanie na dobę zamiast odpytywania płatnego
  API o każdą obserwowaną spółkę.
- **Rejestr.io dostarcza treść.** Nazwiska i sieć powiązań. Wołane wyłącznie na
  żądanie użytkownika albo gdy cache jest starszy niż `CONNECTIONS_TTL_DAYS`.

## Zasada nadrzędna: tożsamość potwierdza człowiek

Wyszukiwanie osoby przyjmuje imię i nazwisko. Zwraca **wszystkich imienników**,
a jedyne pole pozwalające ich rozróżnić (data urodzenia) wymaga abonamentu
premium, którego nie mamy. Zapytanie o „Rafał Trzaskowski" zwraca trzy różne
osoby, z których żadna nie musi być politykiem.

Konsekwencje, niepodlegające negocjacji:

- Żadne powiązanie nie jest przypisywane automatycznie. `match_status` startuje
  jako `candidate` i tylko jawne działanie użytkownika ustawia `confirmed`.
- Zapisujemy `confirmed_by` i `confirmed_at`. Odpowiedzialność za dopasowanie
  jest imienna.
- `get_connections` odmawia zwrócenia powiązań dla podmiotu bez potwierdzenia.
- Interfejs przy wielu wynikach pokazuje ostrzeżenie wprost: błędny wybór
  przypisze komuś cudze spółki.

Nie budujemy automatycznego dopasowania po nazwisku z listy posłów Sejmu.
Kuszące i tanie, ale koszt pomyłki to zniesławienie, nie zły rekord w bazie.

## Model danych

Migracja: `backend/supabase/migrations/20260724120000_registry_krs.sql`.

```text
registry_orgs         — cache organizacji (globalne, read-only dla zalogowanych)
registry_persons      — cache osób z Rejestr.io (globalne)
registry_connections  — powiązania osoba -> organizacja (globalne)
registry_subjects     — potwierdzone tożsamości, per tenant
registry_watches      — obserwowane numery KRS, per tenant
registry_events       — zdarzenia z biuletynu, per tenant
registry_api_calls    — audyt kosztów płatnego API, tylko service_role
```

Cache organizacji i osób jest globalny, bo to dane publiczne z KRS i dwa tenanty
pytające o tę samą spółkę nie powinny płacić dwa razy. To, **kto kogo
obserwuje**, jest już informacją wrażliwą biznesowo i siedzi per tenant z RLS.

## Edge Function `argus-registry`

| Operacja | Koszt | Opis |
| --- | --- | --- |
| `balance` | darmowa | Saldo konta Rejestr.io i licznik wywołań |
| `search_person` | płatna | Kandydaci po imieniu i nazwisku, do ręcznego wyboru |
| `link_person` | płatna | Potwierdzenie tożsamości plus pobranie powiązań |
| `list_subjects` | darmowa | Podmioty tenanta z rejestru |
| `unlink` | darmowa | Odpięcie tożsamości |
| `get_connections` | zwykle darmowa | Z cache, płatna tylko gdy dane nieświeże |
| `refresh_connections` | płatna | Wymuszone odświeżenie |
| `search_org` | płatna | Wyszukiwanie spółek po nazwie, NIP, REGON |
| `link_org` | płatna | Przypięcie spółki, np. wydawcy do redakcji |
| `list_events` | darmowa | Zdarzenia w obserwowanych spółkach |
| `mark_event_seen` | darmowa | Oznaczenie zdarzenia jako przeczytane |
| `check_conflicts` | darmowa | Pokrycie tematu z branżami powiązanych spółek |
| `scan_changes` | darmowa | Ręczny skan biuletynu (normalnie robi to cron) |

Cron: `argus-ingest` operation `registry_scan`, raz dziennie. Domyślnie skanuje
wczorajszy dzień, bo biuletyn za dzień bieżący jest niepełny.

## Bezpieczniki kosztowe

Konto ma saldo w złotówkach, nie limit zapytań, więc pętla z błędem zamienia się
w rachunek. Zabezpieczenia:

- `MIN_BALANCE_PLN = 5`. Poniżej tego progu płatne wywołania są blokowane
  i użytkownik dostaje czytelny komunikat zamiast błędu 402 ze źródła.
- Każde wywołanie ląduje w `registry_api_calls` z endpointem, statusem, czasem
  i saldem po operacji. To jedyny sposób, żeby odpowiedzieć na pytanie, gdzie
  poszły pieniądze.
- Powiązania mają TTL 30 dni. Wpisy w KRS zmieniają się rzadko, a odświeżenie
  poza TTL wymaga jawnego `refresh_connections`.
- Wykrywanie zmian jest w całości darmowe. Płatne API nie bierze udziału
  w monitoringu.

## Gdzie to wchodzi w produkt

1. **Profil polityka.** Panel „Powiązania z rejestrem sądowym", wyszukanie
   i potwierdzenie tożsamości. Zbudowane.
2. **Strażnik spójności (TASK 6).** `check_conflicts` na treści draftu. Jeśli
   temat pokrywa się z branżą spółki polityka, alert o możliwym konflikcie
   interesów. Heurystyka leksykalna jest wejściem dla modelu, nie werdyktem.
3. **Brief przedwywiadowy (TASK 5).** Dwie sekcje: pułapki (temat wywiadu vs
   powiązania polityka) oraz profil rozmówcy (kto jest wydawcą redakcji
   i do kogo należy kapitałowo).
4. **Baza mediów (TASK 4).** `link_org` przypina wydawcę do redakcji. Karta
   redakcji odpowiada na pytanie, z kim polityk naprawdę rozmawia.
5. **Brief poranny (TASK 9).** Zdarzenia z `registry_events`: zmiana w zarządzie
   spółki polityka albo jej likwidacja to ryzyko medialne na ten sam dzień.

## Ograniczenia, o których trzeba pamiętać

- Brak powiązań historycznych. Spółka, z której polityk wyszedł rok temu, nie
  pojawi się, a dziennikarz o nią zapyta. To jest luka do zamknięcia
  abonamentem premium, jeśli pilot pokaże, że jest potrzebna.
- Brak daty urodzenia oznacza brak twardego rozróżnienia imienników.
- Regulamin API Rejestr.io (`rejestr.io/regulamin/api`) nie był analizowany pod
  kątem prawa do trwałego cache'owania i redystrybucji danych. Przed
  wypuszczeniem poza pilota trzeba to sprawdzić.
- Dane osób fizycznych z KRS to dane osobowe. Obowiązuje ta sama zasada, co przy
  dziennikarzach: tylko dane zawodowe z publicznych źródeł, plus proces usunięcia
  na żądanie.
