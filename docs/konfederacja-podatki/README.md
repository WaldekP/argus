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
3. **Cały pakiet jest niedopięty fiskalnie.** Relacje z analiz FOR podają koszt programu w widełkach
   182-189 mld zł (TVN24: 182,1; money.pl: 189), CenEA ok. 86 mld zł ubytku rocznie. Ciężar leży
   w PIT liniowym (60,5 mld) i kwocie wolnej.

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

## Audyt źródeł i wniosków (25 lipca 2026)

Pełny przegląd: weryfikacja twierdzeń nośnych u źródeł, spójność między modułami a korpusem,
ocena zasadności rekomendacji. Wyniki:

| Ustalenie | Status po audycie |
| --- | --- |
| Ustawa o OKI (3 VII 2026, limity 100/25 tys.) | **Potwierdzona w 6+ redakcjach.** Korekta: głosowanie 427:5, ustawa w Senacie, data 1 I 2027 warunkowa. Rekomendacja o Belce uzupełniona o ryzyko ataku na niemal jednomyślną ustawę |
| Koszt programu Konfederacji wg FOR | **Rozbieżność relacji:** 182,1 mld (TVN24) vs 189 mld (money.pl); jednej oficjalnej kwoty nie potwierdzono. Prezentować jako widełki `[do weryfikacji]` |
| Trend CBOS progresja/liniowy | **Dwie różne serie pomiarowe** (binarna 1998-2016: 77/17, 66/24; skala 7-pkt od 1997: 72/18, 65/25). Kierunek zgodny, liczb nie mieszać. Ostrzeżenie dopisane do kwota-wolna/05 |
| Atrybucja 51/35 proc. | Skorygowana z „CBOS 2023” na „CBOS 2025” (w 2023 było 50/35) |
| Dotacja budżetu do FUS 2024 | Uzgodniona: 65 mld = wykonanie, 72,7 mld = plan ustawy budżetowej. Oba opisane |
| „5 krajów regionu” przy liniowym PIT | Doprecyzowane: 4 kraje regionu (SK, LV, LT, CZ) oraz Rosja |
| Wycofanie się Słowacji z liniowego (2013) | Potwierdzone (LSE); rdzeń argumentu przeciw liniowemu stoi |
| Dobrowolny ZUS bez odpowiednika w krajach rozwiniętych | Potwierdzone wielostronnie (OECD PaG, IRS, modele DE/NL); Niemcy i Holandia rozszerzają obowiązek |
| Estonia 50h vs Polska 334h | Kierunkowo pewne; wartość 334h wymaga podawania z rokiem (metodologia Paying Taxes wygaszona po 2020) |
| Sondaże SII | Dwie edycje rozdzielone: OBI 2024 (54 proc., pełna metodologia) vs OBI 2025 (strona 403, odsetki nieznane) |

Ograniczenie transparentności: pola `liczbaZrodel` w modułach (28-54) liczą bibliografie zebrane
przez agentów badawczych; w repo zmaterializowany jest wybór najmocniejszych źródeł (pliki 01-06),
a pełne listy pozostają w transkryptach sesji badawczej. Przy cytowaniu liczby źródeł na zewnątrz
mówić o „bazie badawczej”, nie o plikach w repo.

## Luki całej bazy

- Brak świeżego, reprezentatywnego sondażu ogółu wprost o dobrowolnym ZUS.
- Szacunki kosztów pochodzą z relacji medialnych, nie z odczytanych raportów pierwotnych.
  Relacje rozjeżdżają się co do kwoty FOR: 182,1 mld zł (TVN24) vs 189 mld zł (money.pl);
  jednej oficjalnej łącznej kwoty FOR nie udało się potwierdzić `[do weryfikacji]`.
- Status legislacyjny projektów Konfederacji (skierowane do I czytania w komisjach) wymaga
  potwierdzenia na stronach Sejmu.
