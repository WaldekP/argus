# zamowienia — roadmapa i handoff

Dokument dla kolejnej sesji: co już jest, jakie są ograniczenia danych, co budować
dalej i jakich narzędzi OSINT użyć. Narzędzie jest samodzielne (Node 24+, SQLite),
branch `narzedzia/zamowienia`, docelowo do osobnego repo.

Cel produktu: analiza zamówień publicznych (pilotaż Gdańsk) pod kątem
nieprawidłowości — kto wygrywa, za ile, u kogo, i jakie powiązania (osoby, adresy,
firmy) mogą wskazywać na konflikt interesów. **Zasada nadrzędna: wyniki to tropy
do weryfikacji przez człowieka, nie zarzuty.** Każdy trop z dowodem źródłowym.

## Co już działa (komendy)

- `ingest` — ogłoszenia BZP (ContractNotice + TenderResultNotice) dla Gdańska.
  Tabele `notices`, `contractors` (NIP zwycięzcy), `ingest_windows`.
- `osoby` — indeks urzędników z oświadczeń majątkowych BIP Gdańska
  (rok → kategoria → osoba). Tabele `people`, `person_files` (linki PDF).
- `ocr-decl` — OCR skanów oświadczeń (tesseract pol) → `declaration_text`.
- `match` — powiązania deklaracja ↔ firma-zwycięzca → `leads` (SZUMNE, patrz niżej).
- `serve` — lokalny frontend (http://localhost:4319): Szukaj krzyżowo,
  Urzędnicy, Zwycięzcy, Powiązania.
- `status` — skala danych, najczęstsi zwycięzcy.

Dane pilotażu (test 2024): 3895 ogłoszeń, 1917 firm-zwycięzców, 81 urzędników,
158 deklaracji OCR.

## KRYTYCZNE ograniczenia danych (must-know)

1. **BZP (to API) ma dane dopiero od 2021-01.** Nowa ustawa Pzp + platforma
   e-Zamówienia od 1.01.2021. Sprawdzone: 2018-2020 → 0 rekordów. Starsze
   ogłoszenia są na starym portalu UZP (osobno).
2. **Model progowy** decyduje, gdzie szukać:
   - `< 130 000 zł netto` → poza ustawą Pzp, NIE ma w BZP. To „kilkadziesiąt
     tysięcy". Szukać: rejestr umów CRU (tylko JSFP), platforma zakupowa podmiotu,
     wniosek o informację publiczną.
   - `130 tys. – progi UE` → **BZP**.
   - `> progi UE` → **TED**.
3. **Duże kontrakty są w TED, nie BZP.** Przykład: GIWK ma 5 ogłoszeń w BZP,
   a **779 w TED** (od 2016). Port Lotniczy Gdańsk: 0 w BZP (wszystko w TED).
   Bez TED analiza spółek miejskich jest ślepa na najdroższe kontrakty.
4. **Spółki prawa handlowego (GIWK, lotnisko, PKM) są poza sektorem finansów
   publicznych** → prawdopodobnie poza CRU, cienki BIP. Trudniejsze niż urzędy.
5. **Match deklaracja↔zwycięzca jest szumny** (OCR skanów + nazwy firm zawierają
   słowa z szablonu formularza). Pewna ścieżka to wyszukiwarka krzyżowa (termin
   wybiera człowiek). Do poprawy: parser sekcji VII oświadczenia (realne spółki).

## Integracja Rejestr.io (płatna, DZIAŁA)

Kod referencyjny w Argusie: `backend/supabase/functions/_shared/rejestrio.ts`
(klient API v2, bezpieczniki `assertBudget`: próg salda 5 zł, dzienny limit per
tenant, audyt `registry_api_calls`). Klucz: sekret `REJESTRIO_API_KEY`.

Co daje (potwierdzone na przykładzie Marcina Dawidowskiego, id 895315):
- `/osoby?imie=&nazwisko=` → kandydaci (imiennicy! potwierdzić tożsamość przez
  zbieżność z zadeklarowanymi spółkami).
- `/osoby/{id}` → **data urodzenia** (na naszym planie dostępna, np. 1975-12-07).
- `/osoby/{id}/krs-powiazania?aktualnosc=aktualne|historyczne` → spółki, role
  (KRS_BOARD/SUPERVISION), daty od-do.
- `/org?nip=` + `/org/{krs}/krs-powiazania` → zarząd, wspólnicy, **beneficjenci
  rzeczywiści (BENEFICIARY)** firmy — z nazwiskami.

Zademonstrowany łańcuch konfliktu: urzędnik → jego spółka (GIWK, zarząd od
2023-09) → przetargi tej spółki → zwycięzcy → ich zarządy/beneficjenci → zbieżność
nazwiska. Wynik dla GIWK/BZP: PRO-WAM Sp. z o.o. (Burzak, Las) — bez „Dawidowskiego".
Negatyw, ale ograniczony do BZP (brak TED).

WAŻNE: w narzędziu Rejestr.io musi iść przez te same bezpieczniki (saldo + limit
+ audyt), inaczej łatwo w pętli nadszarpnąć wspólne saldo.

## Następne kroki (priorytety)

1. **Adapter TED** (NAJWAŻNIEJSZE, darmowe). `POST https://api.ted.europa.eu/v3/
   notices/search`, expert query (`FT~"nazwa nabywcy"` działa; pola eForms do
   dostrojenia), bez klucza. Zwraca ogłoszenia + linki do XML źródłowego. Pobrać
   award notices per nabywca (zwycięzca, kwota, data), zarchiwizować XML, tabele
   `ted_notices`/`ted_awards` spójne z BZP. Zamyka lukę: duże kontrakty + historia
   od 2016.
2. **Komenda `konflikt <nazwisko>`** — automatyczny łańcuch: urzędnik → spółki
   (Rejestr.io) → przetargi tych spółek (BZP+TED) → zwycięzcy → beneficjenci →
   zbieżności nazwisk. Z bezpiecznikami salda.
3. **CRBR** (Centralny Rejestr Beneficjentów Rzeczywistych, `crbr.podatki.gov.pl`)
   — darmowe, realne nazwiska właścicieli + rok urodzenia, obchodzi maskowanie
   KRS. Endpoint do namierzenia (JSON API istnieje, path do ustalenia).
4. **Wzbogacanie firm biała lista VAT** (`wl-api.mf.gov.pl/api/search/nip/{nip}`,
   darmowe) — NIP → KRS, adres, data rejestracji. Odblokowuje:
   - **klaster adresowy** (firmy pod tym samym adresem = wydmuszki),
   - **wiek spółki vs pierwsza wygrana** (młoda firma + duży kontrakt).
5. **Parser sekcji VII oświadczenia** — realne spółki urzędnika + siedziby
   (zamiast szumnego full-textu). Tabela `declared_companies`.
6. **Ingest po organizacji** (`--org "<nazwa>"`) — cała historia jednego
   zamawiającego (filtr OrganizationName działa; API ignoruje PageNumber, więc
   iterować po dniach/latach). Szybsze pod analizę konkretnej spółki.
7. **Pełny wieloletni ingest BZP** (2021-teraz) + **archiwum starego BZP UZP**
   (przed 2021).

## Toolkit OSINT (do wdrożenia stopniowo)

Rejestry: TED, BZP/e-Zamówienia, archiwum UZP, CRU, KRS (MS, maskuje), CRBR
(beneficjenci), biała lista VAT, GUS BIR/REGON, Rejestr.io (płatne), księgi
wieczyste EKW, geoportal.

Techniki: klaster adresowy, interlocki osobowe (graf), wiek-spółki-vs-wygrana,
firma wędrująca za urzędnikiem, single-bidder, koncentracja zwycięzców, wzorce
kwot (okrągłe / tuż-pod-progiem = dzielenie zamówień), korelacja czasowa (zmiany
KRS wokół przetargu), zbieżność nazwisk (przez CRBR, nie samo nazwisko).

Web: Wayback Machine (usunięta treść BIP/przetargów), WHOIS/historia domen,
Portal Orzeczeń Sądów, sprawozdania finansowe (eKRS/Rejestr.io), media/wzmianki
(Argus ma narzędzie), OpenCorporates, OpenSanctions (PEP/sankcje), OCCRP Aleph.

Granice: dane publiczne o osobach publicznych = OK do kontroli; RODO —
minimalizacja i celowość; osoby prywatne (rodzina) tylko przy konkretnej,
uzasadnionej podstawie (np. krewny w zarządzie zwycięzcy przetargu spółki, którą
urzędnik zarządza — to konflikt interesów, nie fiszing); publikacja wyłącznie
zweryfikowanego, z dowodem źródłowym.

## Pułapki techniczne (nauczki z tej sesji)

- **Windows + SQLite WAL**: NIE czytać bazy (nawet SELECT) z drugiego procesu
  node w trakcie zapisu przez ingest/OCR — zawiesza writer. Czytać po zakończeniu.
- **BZP API ignoruje `PageNumber`** (strona 1 == 50) → oknem jest pojedynczy
  dzień, nie paginacja. Filtr `OrganizationCity` łapie po fragmencie (dokładne
  dopasowanie w kodzie). Filtr `OrganizationName` działa i mieści małe zbiory
  w jednej odpowiedzi. NoticeType wyniku = `TenderResultNotice`.
- Restarty sesji cofają HEAD — commituj pracę na branchu, bez commita ląduje
  na złym branchu.
