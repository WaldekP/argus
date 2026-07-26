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
