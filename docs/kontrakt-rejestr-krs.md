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
| Powiązania historyczne | brak | tak (plan Biznes) |
| Data urodzenia osoby | brak | tak (plan Biznes) |
| Kwoty ze sprawozdań | brak | tak, JSON (plan Biznes) |
| Biuletyn dziennych zmian | `GET /api/Krs/Biuletyn/{RRRR-MM-DD}` | brak taniego odpowiednika |

Podział ról wynika wprost z tej tabeli:

- **Otwarte API wykrywa zmiany.** Biuletyn dzienny zwraca numery KRS zmienione
  danego dnia. To jedno darmowe wywołanie na dobę zamiast odpytywania płatnego
  API o każdą obserwowaną spółkę.
- **Rejestr.io dostarcza treść.** Nazwiska i sieć powiązań. Wołane wyłącznie na
  żądanie użytkownika albo gdy cache jest starszy niż `CONNECTIONS_TTL_DAYS`.

## Zasada nadrzędna: tożsamość potwierdza człowiek

Wyszukiwanie osoby przyjmuje imię i nazwisko i zwraca **wszystkich imienników**.
Zapytanie o „Rafał Trzaskowski" zwraca trzy różne osoby, z których żadna nie musi
być politykiem. Plan Biznes dokłada datę urodzenia, więc wybór jest oparty na
danych, ale nadal należy do człowieka.

Konsekwencje, niepodlegające negocjacji:

- Żadne powiązanie nie jest przypisywane automatycznie. `match_status` startuje
  jako `candidate` i tylko jawne działanie użytkownika ustawia `confirmed`.
- Zapisujemy `confirmed_by` i `confirmed_at`. Odpowiedzialność za dopasowanie
  jest imienna.
- `get_connections` odmawia zwrócenia powiązań dla podmiotu bez potwierdzenia.
- Interfejs przy wielu wynikach pokazuje ostrzeżenie wprost: błędny wybór
  przypisze komuś cudze spółki.

Automatyczne dopasowanie do listy posłów robimy w jednym miejscu i tylko wtedy,
gdy zgadza się nazwisko ORAZ data urodzenia: przy wykrywaniu innych polityków
w spółce (patrz niżej). Nigdy nie służy ono do potwierdzenia tożsamości
użytkownika, bo koszt pomyłki to zniesławienie, nie zły rekord w bazie.

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

Migracje `20260724140000` i `20260724170000` dokładają:

```text
registry_org_financials  — sprawozdania: okres, data złożenia, przychód, wynik
registry_org_people      — skład osobowy spółki plus dopasowanie do posłów
registry_company_context — podsumowanie AI per tenant i spółka
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
| `get_org_details` | pierwsze wejście płatne | Karta spółki: kapitał, PKD, sprawozdania z kwotami, skład osobowy, posłowie |
| `company_context` | wywołanie modelu | Zestawienie branży spółki z głosowaniami polityka |
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

## Plan Rejestr.io Biznes

Wykupiony 2026-07-24 (decyzja usera). Odblokował datę urodzenia, powiązania
historyczne i treść sprawozdań finansowych w JSON.

Data urodzenia jest z nich najważniejsza, bo zamienia zgadywanie w dane.
Rozstrzyga imienników przy potwierdzaniu tożsamości i pozwala wiarygodnie
wykrywać innych polityków w tych samych spółkach: API Sejmu podaje `birthDate`
posłów, więc dopasowanie nazwisko plus data urodzenia jest faktem, a nie
poszlaką.

## Sprawozdania finansowe

Podział źródeł: darmowe API MS daje **historię okresów** (za jaki rok i kiedy
złożono, dział 3 odpisu), Rejestr.io daje **kwoty** z rachunku zysków i strat.
Sama historia bywa odpowiedzią: „nie złożyła sprawozdania od trzech lat" to
gotowe pytanie od dziennikarza.

Kwoty pobieramy tylko dla trzech ostatnich okresów, bo dokument w JSON kosztuje
więcej niż zwykłe wywołanie. Każdy dokument zawiera też rok poprzedni, więc trzy
pobrania dają cztery lata historii.

Parsowanie rachunku zysków i strat: dokument to drzewo ze schem Ministerstwa
Finansów, a schem jest kilka i różnią się literami węzłów (`RZiSJednostkaInna`,
`RZiSJednostkaOp`, `RZiSJednostkaMala`). Dlatego dopasowujemy po **etykiecie
księgowej**, nie po literze węzła, i bierzemy węzły najpłycej położone w drzewie,
żeby złapać sumę zamiast jej składowej. Dla organizacji pozarządowych przychody
statutowe i gospodarcze leżą na tym samym poziomie, więc są sumowane, a etykieta
mówi, co dokładnie zsumowano. Etykieta trafia do bazy i na ekran, bo „przychód"
znaczy co innego w każdej ze schem.

Sprawdzone na trzech wariantach: spółka z realnymi kwotami, organizacja
pozarządowa i spółka z samymi zerami.

Czego nadal nie ma: spółki raportujące według MSSF składają jedno PDF-owe
„Roczne sprawozdanie finansowe" bez wersji JSON. Wtedy `has_json` jest fałszem
i interfejs mówi wprost, że kwot nie odczytaliśmy. Kolumna `source` odróżnia to
od sytuacji „kwot jeszcze nie pobieraliśmy", bo dla użytkownika to dwie różne
informacje.

Pole `zaOkresOdDo` w odpisie MS jest tekstem swobodnym w co najmniej trzech
wariantach zapisu, więc parser nie zakłada struktury, tylko wyciąga dwie pierwsze
daty z tekstu. Sprawdzone na 50 wzmiankach czterech podmiotów.

## Spółka a dorobek parlamentarny

Operacja `company_context` zestawia branżę spółki z głosowaniami i wypowiedziami
polityka, a wynik podsumowuje model.

- **Wypowiedzi** mają embeddingi, więc szukamy semantycznie (`match_statements`).
- **Głosowania** embeddingów nie mają (`sejm_votings` to tytuł i opis), więc
  dopasowanie jest leksykalne, na rdzeniach wyrazów. Wymagamy co najmniej dwóch
  wspólnych rdzeni, bo jeden to zbieg okoliczności, i odsiewamy rdzenie
  biurokratyczne (`ustawa`, `projek`, `prowad`, `dziala`), które inaczej
  dopasowują każdą debatę do każdej spółki.
- Prompt zabrania budowania narracji na braku danych i każe nazywać zbieżność
  zbieżnością, a nie konfliktem interesów. Poziomy ryzyka: `brak`, `pytanie`,
  `ryzyko`, w razie wątpliwości niższy. Zawyżony alarm zużywa uwagę potrzebną
  przy prawdziwych kryzysach.
- Wynik jest cache'owany per tenant i spółka, bo generacja kosztuje wywołanie
  modelu, a korpus zmienia się rzadko.

## Inni politycy w spółce

`get_org_details` zwraca skład osobowy spółki oraz pole `politicians`: osoby,
które udało się dopasować do posłów. Podstawa dopasowania jest w `match_basis`:

- `birth_date` — zgadza się nazwisko i data urodzenia. Pokazujemy jako fakt.
- `name_only` — zgadza się samo nazwisko, a w Sejmie jest dokładnie jeden poseł
  o tym nazwisku. Pokazujemy z adnotacją, że wymaga weryfikacji.

Zgodne nazwisko przy niezgodnej dacie urodzenia to imiennik i nie trafia na listę
w ogóle.

## Atrybucja

Dane pochodzą z Krajowego Rejestru Sądowego, pobierane przez Rejestr.io
(Fundacja ePaństwo) i przez otwarte API Ministerstwa Sprawiedliwości. Komponent
`RegistryAttribution` pokazuje to pod listą powiązań i na karcie spółki. Powód
jest podwójny: uczciwość wobec źródła oraz to, że użytkownik ma prawo wiedzieć,
skąd wzięła się informacja, którą za chwilę powtórzy dziennikarzowi.

## Ograniczenia, o których trzeba pamiętać

- Spółki raportujące według MSSF nie mają sprawozdań w JSON, więc dla nich kwot
  nie znamy (patrz sekcja wyżej).
- Dopasowanie głosowań do branży jest leksykalne, nie semantyczne. Embeddingi
  dla `sejm_votings` to naturalny następny krok, gdyby jakość okazała się słaba.
- Regulamin API Rejestr.io (`rejestr.io/regulamin/api`) nie był analizowany pod
  kątem prawa do trwałego cache'owania i redystrybucji danych. Przed
  wypuszczeniem poza pilota trzeba to sprawdzić.
- Dane osób fizycznych z KRS to dane osobowe. Obowiązuje ta sama zasada, co przy
  dziennikarzach: tylko dane zawodowe z publicznych źródeł, plus proces usunięcia
  na żądanie.
