# Baza wiedzy: program podatkowy Konfederacji (wybory 2023)

Korpus tematyczny dla Argusa. Sześć postulatów podatkowych z programu „Konstytucja Wolności”,
analizowanych pod kątem strategii Ryszarda Petru: gdzie podebrać wyborców Konfederacji, a gdzie
uderzyć w niespójności. Stan na 24 lipca 2026.

Powiązany kontrakt produktowy: [kontrakt-tematy.md](../kontrakt-tematy.md).
Powiązany korpus: [kwota-wolna/](../kwota-wolna/) (szersza debata o kwocie wolnej 60 tys.).

## Rola

Analityk polityki fiskalnej i socjologii politycznej. Każdy postulat ma odpowiedzieć na jedno
pytanie decyzyjne: jak Petru ma się wobec niego ustawić, skoro celuje w elektorat Konfederacji.

## Mapa tematów

| Temat (slug) | Postulat | Rekomendacja w skrócie |
| --- | --- | --- |
| `kwota-wolna-12x` | Kwota wolna = 12× płaca minimalna | Przejąć mechanizm indeksacji, wypunktować wpadkę legislacyjną |
| `pit-liniowy` | Likwidacja II progu, PIT liniowy 12% | Nie przejmować, przejąć hasło prostoty, atakować regresywność |
| `podatek-belki` | Zwolnienie lokat i obligacji z podatku Belki | Wejść od strony oszczędzających, rozliczyć rząd z obietnicy |
| `dobrowolny-zus` | Dobrowolny ZUS dla przedsiębiorców | Nie popierać, przejąć problem bez pułapki emerytalnej |
| `uproszczenia-przedsiebiorcy` | Uproszczenia podatkowe dla przedsiębiorców | Zająć najmocniej, Konfederacja ma hasło bez treści |

Dane każdego tematu żyją w `src/lib/knowledge/topics/<slug>.ts` i są renderowane w zakładce
Tematy aplikacji. Ten katalog trzyma pełny materiał źródłowy z deep researchu.

## Rekomendacja dwuwarstwowa

Decyzja usera (2026-07-24): każda rekomendacja ma dwie warstwy taktyczne:

- **Co podchwycić** — postulaty nośne i realne, warte przejęcia we własnej, lepszej wersji.
- **Gdzie uderzyć** — postulaty niespójne, groźne albo nierealne fiskalnie, do wypunktowania.

Zgodne ze strategią Petru z transkrypcji spotkania: chce jednocześnie podbierać wyborców
Konfederacji i wyłapywać jej niespójności.

## Kluczowe ustalenia przekrojowe

1. **Elektorat Konfederacji nie jest spójnie wolnorynkowy.** 68 proc. jego wyborców popiera
   opiekuńcze funkcje państwa, 57 proc. chce utrzymania własności państwowej, prywatyzację popiera
   tylko 20 proc. (CBOS 43/2025). Radykalny program „likwidacji podatków i ZUS” wyprzedza poglądy
   własnej bazy poza samą stawką liniową. To najważniejszy wniosek dla całej strategii.
2. **Postulaty różnią się bezpieczeństwem.** Od najbezpieczniejszego do najbardziej ryzykownego:
   uproszczenia (konsensus 78 proc.) → podatek Belki (67,5 proc. za likwidacją) → kwota wolna 12×
   (dobra idea, zła realizacja) → PIT liniowy (mniejszościowy, kosztowny) → dobrowolny ZUS
   (0 z 25 ekonomistów za, ubóstwo emerytalne).
3. **Cały pakiet jest niedopięty fiskalnie.** FOR szacuje koszt programu na ok. 182 mld zł,
   CenEA na ok. 86 mld zł ubytku rocznie. Ciężar leży w PIT liniowym (60,5 mld) i kwocie wolnej.

## Zasady pracy z bazą wiedzy

1. Przed odpowiedzią przeszukaj pliki w tym katalogu. Nie odpowiadaj z pamięci modelu.
2. Każda liczba z przypisem: instytucja, data, link.
3. Dane oznaczone `[do weryfikacji]` nie nadają się do publikacji.
4. Cytat zawsze z datą, miejscem i znacznikiem wiarygodności (`[stenogram]`, `[relacja]`, `[wideo]`).
5. Nie mieszaj szacunków z różnych instytucji jako jednego szeregu (FOR i CenEA liczą inaczej).

## Pliki źródłowe

- [01_kwota_wolna_12x_pit_liniowy.md](01_kwota_wolna_12x_pit_liniowy.md)
- [02_podatek_belki.md](02_podatek_belki.md)
- [03_dobrowolny_zus_uproszczenia.md](03_dobrowolny_zus_uproszczenia.md)
- [04_cbos_i_sondaze.md](04_cbos_i_sondaze.md)
- [05_cytaty_politykow.md](05_cytaty_politykow.md)

## Luki całej bazy

- Brak świeżego, reprezentatywnego sondażu ogółu wprost o dobrowolnym ZUS.
- Szacunki kosztów (FOR 182 mld, CenEA 86 mld) pochodzą z relacji medialnych, nie z odczytanych
  raportów pierwotnych.
- Status legislacyjny projektów Konfederacji (skierowane do I czytania w komisjach) wymaga
  potwierdzenia na stronach Sejmu.
