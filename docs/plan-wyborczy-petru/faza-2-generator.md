# Faza 2: most tematów do generatora przekazu

Spec do zbudowania później (decyzja usera 2026-07-25: faza 1 = tematy teraz, generator potem).
Faza 1 to sześć tematów w `src/lib/knowledge/topics/` renderowanych na `/temat/[slug]`.
Ten dokument opisuje, jak w fazie 2 zasilić generator przekazu (`argus-content`, TASK 7)
stanowiskami i framingiem z tematów.

## Cel

Dziś generator dostaje temat jako wolny tekst, `core_message`, id segmentów i kanały, i nie zna
żadnego framingu. Po fazie 2 generator, gdy draft jest powiązany z tematem, ma pisać warianty
zgodne z przyjętym stanowiskiem Petru i z playbookiem per segment z tego tematu.

## Mapowanie segmentów (warunek czystego połączenia)

Wszystkie sześć tematów używa tych samych trzech segmentów, żeby zmapowały się na segmenty
tenanta w tabeli `segments`:

| id segmentu w temacie | Segment tenanta (CLAUDE.md, konfiguracja pilotażu) | Priorytet |
| --- | --- | --- |
| `wolnosciowcy-konfederacji` | wolnościowcy z Konfederacji nieakceptujący konserwatyzmu | mobilize |
| `sieroty-po-td` | sieroty po Trzeciej Drodze | mobilize |
| `rozczarowani-ko` | rozczarowani Koalicją Obywatelską | persuade |

Do zrobienia w fazie 2: potwierdzić, że id segmentów tenanta w bazie odpowiadają tym trzem,
albo dodać w temacie mapę `topicSegmentId -> tenantSegmentId`. Bez tego framing trafi do złego
wariantu.

## Zmiany w kontrakcie `argus-content`

Kontrakt bazowy: `docs/kontrakt-task-7.md` (zmiana wymaga aktualizacji tamtego pliku).

1. `create` przyjmuje opcjonalne `topic_slug`. Gdy podane, backend wyciąga z tematu:
   `rekomendacja.odpowiedz` (stanowisko), `rekomendacja.podchwycic`, `rekomendacja.zaatakowac`
   oraz dla każdego wybranego segmentu jego `SegmentOdbiorcow` (`kat`, `coDziala`,
   `czegoUnikac`, `przyklad`).
2. `generate_step` wstrzykuje ten materiał do promptu Sonneta jako twarde ramy: wariant ma być
   zgodny ze stanowiskiem, ma używać kątów z `coDziala`, unikać `czegoUnikac`, a `przyklad`
   traktować jako wzorzec tonu, nie tekst do skopiowania.
3. Strażnik spójności lite dostaje dodatkowy warunek: wariant sprzeczny z `rekomendacja.odpowiedz`
   tematu to alert (obok dotychczasowego porównania z historią wypowiedzi).

## Przekrojowe reguły framingu (punkt 8 rekomendacji: format i wiarygodność)

To nie jest temat programowy, tylko zasady, które generator ma stosować do KAŻDEGO wariantu.
Wpisać do promptu generatora w fazie 2.

1. **Konkret z kwotą na poziomie odbiorcy.** Każda obietnica ma mieć skutek w złotówkach dla
   gospodarstwa domowego albo firmy, nie tylko dla budżetu państwa. Podstawa: poparcie dla
   podatku liniowego rośnie z 20 do 60 proc., gdy pytanie zawiera przykład kwotowy (Maison
   dla ZPP 2017); 31 proc. nie ma zdania o kwocie wolnej, dopóki nie zobaczy kwoty.
2. **Koszt w przekazie z własnej inicjatywy.** Podanie kosztu obniża poparcie, ale go nie zabija
   (kwota wolna 79 do 39,9 proc.), a obietnica bez kosztorysu jest łatwa do rozbicia jednym
   pytaniem o źródło finansowania. Wariant ma z góry wskazywać pokrycie.
3. **Nazwanie kosztu ma znaczenie.** Ta sama danina zbiera 13 proc. jako „podatek wojenny"
   i 32,4 proc. jako „tymczasowy podatek na modernizację armii". Unikać etykiet odpychających,
   używać nazw opisujących cel.
4. **Oś „państwo marnuje", nie „państwo za duże".** 90 proc. uważa, że pieniądze publiczne są
   wydawane nieracjonalnie, 87 proc. że podatki są za wysokie wobec tego, co państwo daje, ale
   68-80 proc. chce państwa opiekuńczego. Przekaz „tniemy państwo" przegrywa we wszystkich trzech
   grupach.
5. **Rozliczaj cudze obietnice mocniej, niż licytujesz własne.** Sama obietnica podatkowa nie
   kupuje wdzięczności (22 proc. odczuwających korzyść po reformie z 2022 r.). 53,3 proc. uważa
   rozliczenie rządów PiS za niewystarczające. Paliwem jest niedotrzymana obietnica przeciwnika.
6. **Warunek i wzajemność, nie likwidacja.** Przy transferach język warunku ma większość, język
   likwidacji nie ma jej nigdzie.

## Format programu (do draftu programu, nie do generatora)

Struktura draftu programu, gdy do niego dojdziemy: 15-20 konkretów w każdym z dwóch obszarów
(gospodarka, polityka zagraniczna), tabela finansowania per postulat (czego nie zrobił nikt od
Lewicy 2019), dwa lub trzy gotowe projekty ustaw dla flagowych zmian, krótka lista gwarancji
negatywnych (czego nie zrobimy).
