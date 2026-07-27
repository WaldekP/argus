# zamowienia

Narzędzie do analizy zamówień publicznych Gdańska pod kątem nieprawidłowości:
kto wygrywa przetargi, za ile, u kogo, i jakie wzorce mogą wskazywać na
nieprawidłowe wydawanie publicznych pieniędzy. Samodzielne, docelowo do
osobnego repo (branch `narzedzia/zamowienia`).

Faza 1 (obecna): ingest ogłoszeń z **BZP** (Biuletyn Zamówień Publicznych) dla
zamawiających z Gdańska — darmowe API, bez konta. Kolejne fazy: złączenie
zwycięzców z KRS, graf powiązań, sygnały ryzyka; opcjonalnie Centralny Rejestr
Umów (wymaga klucza API) i Rejestr.io (płatna sieć powiązań).

Rdzeń działa na samym **Node 24+** (wbudowany SQLite, fetch, natywny TypeScript),
bez `npm install`.

**Kontynuacja w kolejnej sesji: [ROADMAP.md](ROADMAP.md)** — stan, krytyczne
ograniczenia danych (BZP tylko od 2021; duże kontrakty w TED), integracja
Rejestr.io, następne kroki (adapter TED, komenda `konflikt`, CRBR, klaster
adresowy) i pełny toolkit OSINT z granicami prawnymi.

## Użycie

```bash
node src/cli.ts ingest --from-year 2020
```

Pobiera z BZP ogłoszenia o zamówieniu (`ContractNotice`) i o wyniku
(`TenderResultNotice`) dla zamawiających z Gdańska. Iteruje oknami miesięcznymi
(API wymaga zakresu dat), filtruje dokładne `organizationCity == "Gdańsk"`
(API łapie po fragmencie, wpuszczając „Starogard Gdański"). Wznawialne: każde
ukończone okno ląduje w `ingest_windows`, ponowny bieg pomija zrobione, a
bieżący miesiąc odświeża. `--force` pobiera wszystko od nowa.

```bash
node src/cli.ts osoby --from-year 2020
```

Buduje indeks urzędników z **oświadczeń majątkowych** BIP Gdańska (drzewo
rok → kategoria → osoba). Nazwiska są strukturalne (w URL/linku), więc indeks
powstaje bez OCR: tabela `people` (nazwisko, rola, rok) + `person_files` (PDF-y
pod przyszły OCR zadeklarowanych spółek). Role: Prezydent, Zastępcy, Sekretarz,
Skarbnik, Radni, Osoby zarządzające i członkowie organów spółek miejskich.
Kategorie grupowane przez jednostki (Kierownicy jednostek, część Osób wydających
decyzje) mają głębszy poziom, na razie niedobrany.

```bash
node src/cli.ts ocr-decl
node src/cli.ts match
node src/cli.ts serve
```

`ocr-decl` rozczytuje skany oświadczeń (person_files) do `declaration_text`
(tesseract pol, wolne). `match` liczy powiązania deklaracja ↔ firma-zwycięzca do
tabeli `leads`. `serve` uruchamia lokalny frontend (http://localhost:4319,
`--port N`) do przeglądania: **Szukaj krzyżowo** (wpisz firmę/nazwisko → gdzie
występuje w oświadczeniach i wśród zwycięzców — najpewniejsza ścieżka),
**Urzędnicy** (deklaracje z tekstem OCR i linkiem do skanu), **Zwycięzcy**
(ranking + postępowania), **Powiązania** (auto-leady, eksperymentalne).

Uczciwe ograniczenie: automatyczne parowanie deklaracja ↔ zwycięzca z OCR skanów
jest szumne (nazwy firm zawierają słowa ze wzorca formularza), więc auto-leady
to surowe tropy. Precyzyjne łączenie daje wyszukiwarka krzyżowa (termin wybiera
człowiek) plus lektura oświadczenia i skanu źródłowego. Zasada: sygnały do
weryfikacji, nie zarzuty.

```bash
node src/cli.ts ted --org "Gdańska Infrastruktura Wodociągowo-Kanalizacyjna" --xml
```

Ogłoszenia z **TED** (Tenders Electronic Daily, UE) dla danego nabywcy — duże
kontrakty powyżej progów UE i historia sprzed 2021, których BZP nie ma (GIWK:
5 w BZP vs 404 w TED, od 2016). Darmowe API, bez klucza, paginacja kursorowa.
Zapisuje `ted_notices`; `--xml` pobiera pliki źródłowe XML do `data/ted`.
Zwycięzca i kwota z XML to faza 2 (schematy TED 2016 vs eForms 2024 różne).

```bash
node src/cli.ts status
```

Skala danych, rozkład wg roku, najczęstsi zwycięzcy (punkt wyjścia do drążenia).

## Dane z BZP

Endpoint `ezamowienia.gov.pl/mo-board/api/v1/notice` (GET, darmowy, bez klucza).
Kluczowe pola: `organizationName`/`organizationNationalId` (zamawiający + NIP),
`orderObject`, `cpvCode`, `procedureResult`, `tenderId` (łączy ogłoszenie z
wynikiem) oraz `contractors[]` z **`contractorNationalId`** — NIP zwycięzcy,
czyli klucz do złączenia z KRS w kolejnej fazie.

Model bazy (`data/zamowienia.sqlite`): `notices` (ogłoszenia), `contractors`
(zwycięzcy per wynik), `ingest_windows` (stan wznawiania).

## Plan (kolejne fazy)

2. **KRS**: NIP zwycięzcy → dane firmy (zarząd, adres, PKD) z darmowego API MS.
3. **Graf**: firma ↔ osoby ↔ inne firmy ↔ przetargi ↔ zamawiający;
   Rejestr.io dopina sieć osobową (płatne, punktowo).
4. **Sygnały ryzyka**: jeden oferent, powtarzalny zwycięzca u jednego urzędu,
   wspólny adres/zarząd, spółki założone tuż przed wygraną, dzielenie pod próg.
   Wynik: czerwone flagi z dowodami źródłowymi (do weryfikacji przez człowieka).
5. **CRU** (Centralny Rejestr Umów): wszystkie umowy, gdy będzie klucz API.

## Zasada

Wyniki analizy to **sygnały do weryfikacji przez człowieka, nie zarzuty**.
Dane publiczne, analiza kontrolna; przy publikacji konieczna ostrożność
(zniesławienie). Narzędzie produkuje tropy z linkami do źródeł, nie oskarżenia.

## Dane i przenaszalność

Wszystko w `data/` (poza gitem). Kod samodzielny w `tools/zamowienia`, bez
zależności od reszty repo — przeniesienie = skopiowanie katalogu.
