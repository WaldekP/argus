# Plan wyborczy dla Petru (obszar gospodarka + polityka zagraniczna)

## Cel i ustalenia z userem (2026-07-25)

Przygotowanie konkretnego planu wyborczego dla Ryszarda Petru pod elektorat
wolnościowo-liberalny (wolnościowi wyborcy Konfederacji odrzucający konserwatyzm,
centrum liberalno-wolnościowe; por. segmenty tenanta pilotażowego w CLAUDE.md).

- **Dwa obszary**, w których Petru ma najmocniejsze kompetencje: **gospodarka**
  (podatki, finanse publiczne, deregulacja) i **polityka zagraniczna**.
- W każdym obszarze **15-20 konkretów**: obietnica, sposób realizacji, finansowanie.
  Wzorzec konkretności: program ma na każdy temat odpowiadać "jak" i "za co".
- Fundament analityczny: programy wyborcze partii sejmowych 2011-2023
  (`docs/programy-wyborcze/`) plus kierunkowe zmiany w budżetach państwa 2022-2026.
- Rama światopoglądowa: wolność osobista jako zasada ("państwo nie wtrąca się w życie
  prywatne"), bez flagowania najostrzejszych sporów.
- Proces: najpierw analiza porównawcza, przegląd z userem, dopiero potem draft programu.

## Mapa dokumentów

- `zrodla/programy-2011.md` … `zrodla/programy-2023.md` — ekstrakcja obszarów
  gospodarka i polityka zagraniczna z programów każdego roku, z oceną konkretności.
- `zrodla/budzety-2022-2026.md` — kierunkowe zmiany w budżetach państwa, przestrzeń
  fiskalna, procedura nadmiernego deficytu.
- `zrodla/elektorat-konfederacji.md` — postawy elektoratu Konfederacji 2023-2026: profil
  socjodemograficzny, podziały wewnętrzne (typologia CBOS: 52% „aspirujących liberałów"),
  podatki i koszt fiskalny, transfery, UE i Ukraina, klimat, motywacje głosowania.
  Na końcu 10 wniosków pod ofertę dla wolnościowców plus lista luk w danych.
- `zrodla/sondaze-tematyczne-2024-2026.md` — sondaże opinii publicznej pod osiem decyzji
  programowych (euro, dług, 800 plus, kwota wolna, składka zdrowotna i ZUS, obronność,
  klimat i energia, zaufanie do obietnic), z przekrojami elektoratowymi tam, gdzie
  je opublikowano.
- `analiza-porownawcza.md` — synteza: trendy 2011-2023, luki na rynku idei, shortlist 28
  elementów do przejęcia, nisza pozycjonowania, 8 pytań decyzyjnych do usera.
- `rekomendacja-elektoraty.md` — odpowiedź na 8 pytań decyzyjnych na podstawie badań opinii:
  rekomendowane stanowisko per kwestia, napięcia między grupami docelowymi, synteza strategiczna.
- `draft-programu.md` — draft programu: 19 konkretów gospodarczych i 17 zagranicznych, każdy
  z obietnicą, realizacją, finansowaniem i terminem, plus tabela finansowania i 8 gwarancji
  negatywnych. Reguły framingu z fazy 2 zastosowane.
- `program-petru-sample.pptx` — prezentacja (sample dla Petru) złożona z draftu, estetyka
  Argus (granat + złoto), czcionki Office-safe. Plik do przeglądu, nieopublikowany publicznie.
- `faza-2-generator.md` — spec mostu tematów do generatora przekazu (wdrożony) i przekrojowe
  reguły framingu (punkt 8: format i wiarygodność).

Powiązane w aplikacji: 6 tematów w `src/lib/knowledge/topics/` (euro, konsolidacja-fiskalna,
transfery-800plus, skladka-zdrowotna, obronnosc, klimat-energia) renderowanych w zakładce
Tematy, oraz most do generatora przekazu w `argus-content` (kontrakt: `docs/kontrakt-task-7.md`).

## Zasady pracy

- Liczby wyłącznie ze źródeł (PDF programu z podaniem strony, dokument budżetowy z URL).
  Liczby niepewne oznaczaj `[do weryfikacji]`, nie nadają się do publikacji.
- Przy postulatach cudzych programów zawsze podawaj partię, rok i dokument, żeby draft
  nie przypisał Petru cudzych obietnic bez świadomej decyzji.
- Boundaries tenanta: bez pogardy wobec wyborców Konfederacji, Trzeciej Drogi i KO,
  to potencjalny elektorat.
