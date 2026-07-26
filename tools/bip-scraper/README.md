# bip-scraper

Lokalne narzędzie do mapowania stron BIP i archiwizacji publikowanych tam
dokumentów. Test pilotażowy: wszystkie podmioty gdańskie ze spisu `gov.pl/web/bip`
(TERC 2261, 86 podmiotów). Docelowo zasila korpusy wiedzy Argusa; na razie jest
w pełni samodzielne.

Jedyna zależność npm to `pdfjs-dist` (rozczytywanie PDF); poza tym wyłącznie
Node 24+ (wbudowany SQLite, natywny fetch, natywne uruchamianie TypeScriptu).
Przed pierwszym `extract` trzeba raz odpalić `npm install`; pozostałe komendy
działają bez niego.

## Użycie

Kolejność przy pierwszym uruchomieniu:

```bash
node src/cli.ts registry
```

Pobiera spis podmiotów BIP (ZIP z `subjects.xml`, ~13 tys. wierszy) i zapisuje
podmioty gdańskie do bazy. Inny teren: `--terc <prefiks TERC>` albo
`--place <miejscowość>`.

```bash
node src/cli.ts probe
```

Odcisk palca każdego podmiotu: strona główna (platforma CMS, meta generator,
linki RSS), `robots.txt`, `sitemap.xml`. Wynik steruje crawlem i mówi, ile
dedykowanych parserów miałoby sens w przyszłości. `--force` bada ponownie.

```bash
node src/cli.ts crawl
```

Właściwy crawl. Chodzi długo; w każdej chwili można przerwać przez Ctrl+C i
wznowić tą samą komendą, stan jest w SQLite. Podgląd z drugiego terminala:

```bash
node src/cli.ts status
```

```bash
node src/cli.ts extract
```

Rozczytuje tekst z archiwum do `data/texts/<sha>.txt`: PDF przez `pdfjs-dist`,
DOCX własnym czytnikiem ZIP, HTML przez zdjęcie znaczników. Stan w tabeli
`extractions`, kluczowanej po sha256 treści, więc duplikat rozczytuje się raz.
PDF-y będące skanami (strony są, tekstu prawie nie ma) dostają status
`needs_ocr` i czekają na przyszły etap OCR. Podmiana silnika ekstrakcji =
podbicie `EXTRACT_VERSION` w `src/extract.ts`; komenda przeliczy różnicę sama.

```bash
node src/cli.ts index
node src/cli.ts search "zamowienia publiczne" --limit 20
```

Wyszukiwarka pełnotekstowa (SQLite FTS5, tokenizer trigram z
`remove_diacritics`): "zamowienia" znajduje "zamówienia publicznego",
polska odmiana działa bez stemmera, zapytanie musi mieć co najmniej 3 znaki.
Kilka słów to koniunkcja, fraza w cudzysłowie szuka dosłownie. Wyniki niosą
podmiot, tytuł z linku, URL i fragment trafienia. `index` przebudowuje indeks
od zera; odpalaj go po każdym `crawl` + `extract`. Dokumenty bez rozczytanego
tekstu (skany przed OCR, formaty binarne) są szukalne po tytule.

Przydatne flagi crawla: `--entity <id>` (jeden podmiot), `--max-pages N`
(domyślnie 300 stron na podmiot), `--max-depth N` (domyślnie 4),
`--delay ms` (domyślnie 1500 na host), `--include-old` (bez filtra wieku).

## Jak to działa

- **Jednostka pracy: podmiot** ze spisu gov.pl, z zakresem = host + prefiks
  ścieżki jego adresu BIP (część podmiotów to podstrona wspólnego serwisu,
  np. `bip.gdansk.pl/gdanski-zarzad-zieleni`).
- **Współbieżność**: hosty równolegle (domyślnie 4), w obrębie hosta zawsze
  szeregowo z odstępem 1,5 s; `Crawl-delay` z robots.txt jest honorowany,
  reguły `Disallow` też.
- **Kolejka w SQLite** (`data/bip.sqlite`): tabele `pages` i `documents` ze
  statusem `pending` są jednocześnie kolejką i archiwum metadanych. Każdy krok
  commituje od razu, stąd bezpieczne wznawianie.
- **Priorytet dokumentów**: worker hosta najpierw pobiera oczekujące pliki,
  dopiero potem chodzi po kolejnych stronach.
- **Archiwum oryginałów** w `data/blobs/<2 znaki sha>/<sha256>.<ext>`:
  deduplikacja po treści, plik nigdy nie jest nadpisywany. Metadane (URL,
  strona źródłowa, tekst linku, Last-Modified) w tabeli `documents`.
- **Filtr wieku**: dokumenty z `Last-Modified` starszym niż 730 dni dostają
  status `skipped_old`, metadane zostają, plik nie jest składowany. Serwery
  bez `Last-Modified` nie są filtrowane, bo nie ma na czym.
- **Zasiewanie**: strona główna + sitemapa + RSS, jeśli podmiot je ma; reszta
  to BFS po linkach w zakresie podmiotu.

## Granice wersji 0.1 (świadome)

- Dokumenty pobieramy z dowolnego hosta (załączniki notorycznie leżą na
  osobnych domenach, np. `download.cloudgdansk.pl`), ale crawl stron nigdy
  nie wychodzi poza zakres podmiotu.
- OCR skanów: poza zakresem; kolejka czeka w `extractions.status = 'needs_ocr'`.
- Formaty xls/doc (stare, binarne): status `unsupported`, oryginały w archiwum.
- Brak dat publikacji innych niż `Last-Modified`; daty ze struktury stron
  wymagają parserów per platforma (patrz rozkład CMS w `status --verbose`).
- Strony renderowane wyłącznie JavaScriptem nie są widoczne (brak przeglądarki).
- `robots.txt`: reguły dla `User-agent: *`, wildcardy tylko `*` i `$`.

## Dane

Wszystko w `data/` (poza gitem): `bip.sqlite` (stan i metadane), `blobs/`
(oryginały), `crawl.log`. Usunięcie katalogu `data/` zeruje narzędzie.
