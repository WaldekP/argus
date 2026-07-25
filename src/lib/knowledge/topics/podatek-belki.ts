/**
 * Temat: zwolnienie lokat i obligacji z podatku Belki (program Konfederacji 2023).
 * Aktualizacja lipiec 2026: rząd uchwalił ustawę o OKI (3 VII 2026), więc oś sporu
 * przesunęła się z „czy znieść” na „czy model OKI jest sprawiedliwy”.
 */

import type { Temat } from '../types';

export const podatekBelki: Temat = {
  slug: 'podatek-belki',
  nazwa: 'Zwolnienie lokat i obligacji z podatku Belki',
  zajawka:
    'Najbezpieczniejszy postulat pakietu: 67,5 proc. za likwidacją. Rząd odpowiedział ustawą o OKI, która chroni ciułacza słabiej niż inwestora.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 54,
  doWeryfikacji: 4,

  rekomendacja: {
    pytanie: 'Jak ustawić się wobec podatku Belki, skoro rząd uchwalił już ustawę o OKI?',
    odpowiedz:
      'Poprzeć kierunek, ale uderzyć w asymetrię OKI: drobny ciułacz z lokatą chroniony jest słabiej niż inwestor giełdowy.',
    uzasadnienie: [
      'To najszerzej popierany postulat z całego pakietu: 67,5 proc. Polaków za likwidacją przy 9,2 proc. przeciw. Ryzyko wizerunkowe minimalne.',
      'Rząd uchwalił ustawę o OKI (3 lipca 2026), więc argument „nie dowieźli” jest już nieaktualny. Nowe pole to jakość rozwiązania, nie jego brak.',
      'OKI ma wbudowaną niesprawiedliwość, którą łatwo pokazać: aktywa oszczędnościowe (lokaty, obligacje) zwolnione tylko do 25 tys. zł, a inwestycyjne (akcje, fundusze) do 100 tys. To premiuje rynek kapitałowy kosztem zwykłego oszczędzającego.',
      'Porównanie z zagranicą daje mocną amunicję: Niemcy, Wielka Brytania, Francja i USA chronią drobnego ciułacza prostą kwotą wolną albo kontem preferencyjnym.',
    ],
    ryzyko: [
      'Pełne zwolnienie lokat i obligacji bez limitu (wersja Konfederacji) premiuje też najzamożniejszych. Sami inwestorzy indywidualni wolą reformę niż całkowitą likwidację.',
      'To rekordowe źródło dochodu (10,6 mld zł w 2024). Obietnica dalszych zwolnień bez wskazania, skąd wziąć pieniądze, jest łatwa do skontrowania.',
      'Rząd już działa, więc licytowanie się na „szybciej i więcej” może brzmieć jak spóźniona konkurencja.',
    ],
    podchwycic: [
      'Rama „podatek od oszczędzania”: przy oprocentowaniu niższym od inflacji to de facto podatek od realnej straty. Trafia do zwykłego posiadacza lokaty, nie do inwestora.',
      'Wyrównanie limitów OKI: skoro inwestor giełdowy ma zwolnione 100 tys. zł, drobny ciułacz z lokatą powinien mieć co najmniej tyle samo, a nie 25 tys.',
      'Kwota wolna dla oszczędności wzorem Niemiec (Sparerpauschbetrag) albo konto jak brytyjskie ISA: prosty, sprawdzony mechanizm, tańszy niż pełna likwidacja.',
    ],
    zaatakowac: [
      'Asymetria OKI: rząd chroni akcje i fundusze (100 tys. zł) lepiej niż lokaty i obligacje (25 tys. zł), czyli faworyzuje inwestora nad zwykłym oszczędzającym. Gotowy zarzut o wsłuchiwanie się w rynek, nie w ludzi.',
      'Nowy podatek od wartości aktywów ponad limit (ok. 0,85-1 proc.) strukturalnie przypomina holenderski box 3, który tamtejsze sądy uznały za niezgodny z prawem własności. To ryzyko konstytucyjne wpisane w ustawę.',
      'Rząd Tuska obiecywał zniesienie podatku Belki w „100 konkretach”, a Domański cofnął się do „ograniczenia”. OKI to ograniczenie z haczykiem, nie obiecane zniesienie.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '67,5%',
      opis: 'Tylu Polaków za likwidacją podatku Belki (UCE Research/SYNO). Przeciw 9,2 proc.',
      doPublikacji: true,
    },
    {
      wartosc: '10,6 mld zł',
      opis: 'Wpływy z podatku Belki w 2024 r. Rekordowe, o 15 proc. wyższe od prognozy MF. Ok. 2/3 z lokat.',
      doPublikacji: true,
    },
    {
      wartosc: '25 vs 100 tys.',
      opis: 'Limity zwolnienia w OKI: lokaty i obligacje do 25 tys. zł, akcje i fundusze do 100 tys. Asymetria na niekorzyść ciułacza.',
      doPublikacji: true,
    },
    {
      wartosc: '19%',
      opis: 'Polska stawka od pierwszej złotówki, bez kwoty wolnej. Nieco powyżej średniej UE (18,6 proc.).',
      doPublikacji: true,
    },
    {
      wartosc: '1 stycznia 2027',
      opis: 'Wejście w życie ustawy o OKI, uchwalonej przez Sejm 3 lipca 2026.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Podatek Belki jest wyjątkowo niepopularny: 67,5 proc. ogółu za jego likwidacją, przy zaledwie 9,2 proc. przeciw (UCE Research/SYNO). Silniej wśród mężczyzn (71,9 proc.) niż kobiet (63,5 proc.).',
    'Wśród aktywnych inwestorów podatek Belki to najczęściej wskazywana słabość polskiego rynku: 54 proc. w Ogólnopolskim Badaniu Inwestorów 2024 (SII, N=4374).',
    'Rozjazd między ogółem a inwestorami: ogół chce likwidacji, inwestorzy wolą rozwiązania celowane (konta preferencyjne, ulgi) niż pełne zniesienie.',
    'To najbezpieczniejszy komunikacyjnie postulat całego pakietu Konfederacji, ale po uchwaleniu OKI debata przeniosła się na jakość rozwiązania, nie jego brak.',
  ],

  badania: [
    {
      id: 'uce-belka-2022',
      instytut: 'UCE Research i SYNO Poland',
      zleceniodawca: 'badanie komercyjne',
      termin: 'wrzesień 2022',
      proba: '1034 osoby, CAWI, reprezentatywna',
      pytanie: 'Czy jest Pan(i) za zniesieniem podatku Belki od zysku z oszczędności?',
      wyniki: [
        { etykieta: 'Za likwidacją', procent: 67.5, kluczowy: true },
        { etykieta: 'Przeciw', procent: 9.2 },
        { etykieta: 'Za czasowym zawieszeniem', procent: 4 },
        { etykieta: 'Brak zdania', procent: 19.3 },
      ],
      jakCzytac:
        'Najwyższe poparcie z całego pakietu Konfederacji. Pytanie dotyczy oszczędności, nie zysków giełdowych, gdzie nastroje są ostrożniejsze. Dokładna data i próba do potwierdzenia u źródła.',
      zrodlo: {
        tytul: 'Większość Polaków chce likwidacji podatku Belki',
        url: 'https://www.money.pl/podatki/wiekszosc-polakow-chce-likwidacji-podatku-belki-6808075249351168a.html',
        wydawca: 'money.pl',
        data: 'wrzesień 2022',
      },
    },
    {
      id: 'sii-obi-2024',
      instytut: 'Stowarzyszenie Inwestorów Indywidualnych',
      zleceniodawca: 'Ogólnopolskie Badanie Inwestorów 2024 (22. edycja)',
      termin: '2 września - 3 listopada 2024',
      proba: '4374 inwestujących Polaków, ankieta online',
      pytanie: 'Co jest największą słabością polskiego rynku kapitałowego?',
      wyniki: [
        { etykieta: 'Podatek Belki', procent: 54, kluczowy: true },
        { etykieta: 'Inne bariery (łącznie)', procent: 46 },
      ],
      jakCzytac:
        'Najmocniejsze drugie źródło, z pełną metodologią. To badanie aktywnych inwestorów, nie ogółu, więc 54 proc. wskazań Belki jako głównej bariery nie jest tym samym co 67,5 proc. ogółu za likwidacją. Cytuj z rozróżnieniem grup.',
      zrodlo: {
        tytul: 'Podatek Belki to dopiero początek. Takich reform chcą polscy inwestorzy (OBI 2024)',
        url: 'https://www.sii.org.pl/17891/aktualnosci/badania-i-rankingi/podatek-belki-to-dopiero-poczatek-takich-reform-chca-polscy-inwestorzy-obi-2024.html',
        wydawca: 'SII',
        data: 'grudzień 2024',
      },
    },
  ],

  zagranica: [
    {
      kraj: 'Niemcy',
      opis: 'Kwota wolna od zysków kapitałowych (Sparerpauschbetrag) 1000 EUR na osobę, 2000 EUR dla małżeństw, obejmuje odsetki, dywidendy i zyski ze sprzedaży. Powyżej: podatek zryczałtowany 26,38 proc. (25 proc. plus dodatek solidarnościowy).',
      wniosek:
        'Niemiec ma prostą kwotę wolną, poniżej której jego oszczędności są nieopodatkowane. Polak do 2027 płacił od pierwszej złotówki. To najprostszy wzorzec osłony drobnego ciułacza.',
      zrodlo: {
        tytul: 'Understanding Capital Gains Tax in Germany',
        url: 'https://n26.com/en-de/blog/capital-gains-tax',
        wydawca: 'N26',
        data: '2024',
      },
    },
    {
      kraj: 'Wielka Brytania',
      opis: 'Konto ISA: roczny limit wpłat 20 tys. GBP, w ramach którego odsetki, dywidendy i zyski są całkowicie i bezterminowo zwolnione z podatku. Można dzielić limit między konto gotówkowe i inwestycyjne.',
      wniosek:
        'Model, w którym oszczędzający i inwestor mają ten sam, wysoki limit zwolnienia, bez faworyzowania rynku kapitałowego. Odwrotność asymetrii polskiego OKI (25 tys. vs 100 tys.).',
      zrodlo: {
        tytul: 'ISAs and other tax-efficient ways to save',
        url: 'https://www.moneyhelper.org.uk/en/savings/types-of-savings/isas-and-other-tax-efficient-ways-to-save-or-invest',
        wydawca: 'MoneyHelper',
        data: '2025',
      },
    },
    {
      kraj: 'Czechy i Słowacja',
      opis: 'Pełne zwolnienie zysków ze sprzedaży papierów wartościowych trzymanych długoterminowo: w Czechach ponad 3 lata (bez limitu, po krótkiej przerwie w 2025 przywrócone od 2026), na Słowacji akcje giełdowe trzymane ponad rok.',
      wniosek:
        'U bezpośrednich sąsiadów zysk z inwestycji długoterminowej bywa w ogóle nieopodatkowany. To argument, że polskie 19 proc. od pierwszej złotówki odstaje od regionu.',
      zrodlo: {
        tytul: 'Czech Republic, individual income determination',
        url: 'https://taxsummaries.pwc.com/czech-republic/individual/income-determination',
        wydawca: 'PwC Tax Summaries',
        data: '2025',
      },
    },
    {
      kraj: 'Holandia (przestroga)',
      opis: 'Podatek od majątku (box 3): stawka liczona od zakładanego, a nie realnego zysku. Holenderski Sąd Najwyższy wielokrotnie uznawał ten model za niezgodny z prawem własności, gdy fikcyjny zwrot przewyższa realny. Planowane przejście na opodatkowanie realnych zysków.',
      wniosek:
        'Polski nowy podatek od wartości aktywów ponad limit OKI strukturalnie przypomina box 3. To gotowy argument o ryzyku konstytucyjnym wpisanym w ustawę.',
      zrodlo: {
        tytul: 'Supreme Court rules the Dutch box 3 wealth tax is still discriminatory',
        url: 'https://www.loyensloeff.com/insights/news--events/news/supreme-court-rules-the-dutch-box-3-wealth-tax-is-still-discriminatory/',
        wydawca: 'Loyens & Loeff',
        data: '2024',
      },
    },
  ],

  politycy: [
    {
      id: 'mentzen',
      imieNazwisko: 'Sławomir Mentzen',
      funkcja: 'poseł, lider Nowej Nadziei',
      ugrupowanie: 'Konfederacja',
      stanowisko: 'Podatek Belki jako „podatek od oszczędzania” i relikt rządów lewicy do zniesienia. Projekt: kwota wolna 100 tys. zł (druk 690).',
      slabyPunkt: 'Proponuje pełne zwolnienie bez limitu, co premiuje także dużych inwestorów.',
      wypowiedzi: [
        {
          id: 'mentzen-belka',
          cytat: 'To ciekawe, że gdy ja mówię o likwidacji podatku Belki, to jest to populizm.',
          miejsce: 'Wypowiedź cytowana przez Onet',
          data: '9 września 2023',
          poCo: 'Mentzen ustawia się jako pierwszy, który podniósł temat. Cytat wtórny, przed publicznym użyciem zweryfikować u źródła (onet.pl).',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Sławomir Mentzen, cytaty (za onet.pl)',
            url: 'https://pl.wikiquote.org/wiki/S%C5%82awomir_Mentzen',
            wydawca: 'Wikicytaty za Onet',
            data: '9 września 2023',
          },
        },
      ],
    },
    {
      id: 'domanski',
      imieNazwisko: 'Andrzej Domański',
      funkcja: 'minister finansów',
      ugrupowanie: 'Koalicja Obywatelska',
      stanowisko: 'Obietnica zniesienia z „100 konkretów” zamieniona na ograniczenie przez ustawę o OKI.',
      slabyPunkt: 'Obietnica z „100 konkretów”, seria niedotrzymanych terminów, na końcu OKI z asymetrycznymi limitami i nowym podatkiem od wartości aktywów.',
      wypowiedzi: [
        {
          id: 'domanski-ograniczony',
          cytat: 'Będzie wprowadzone ograniczenie podatku Belki, ale w cztery dni tego się nie dało zrobić.',
          miejsce: 'Debata w Sejmie nad projektem budżetu na 2024 r.',
          data: '21 grudnia 2023',
          poCo: 'Pierwsze cofanie się z obietnicy: z „zniesienia” na „ograniczenie”, kilka tygodni po objęciu władzy. OKI to spełnienie tej okrojonej wersji.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Podatek Belki do zmiany. Jest zapowiedź rządu',
            url: 'https://www.money.pl/podatki/podatek-belki-do-zmiany-jest-zapowiedz-rzadu-6976265156922336a.html',
            wydawca: 'money.pl',
            data: '21 grudnia 2023',
          },
        },
      ],
    },
  ],

  segmenty: [
    {
      id: 'oszczedzajacy',
      nazwa: 'Drobni oszczędzający',
      opis: 'Posiadacze lokat i obligacji detalicznych, nie inwestorzy giełdowi.',
      podstawa: 'UCE Research/SYNO: najwyższe poparcie dla likwidacji w wieku 36-55 lat i przy dochodach 3-5 tys. zł netto.',
      kat: 'Podatek od oszczędzania, nie od spekulacji. Bohaterem jest ciułacz, nie gracz giełdowy, a OKI go krzywdzi limitem 25 tys.',
      coDziala: [
        'Rama realnej straty: gdy lokata daje mniej niż inflacja, państwo i tak bierze 19 proc.',
        'Wyrównanie limitu OKI: dlaczego akcje mają zwolnione 100 tys., a Twoja lokata tylko 25 tys.',
        'Wzorzec niemiecki: prosta kwota wolna dla oszczędności, jak Sparerpauschbetrag.',
      ],
      czegoUnikac: [
        'Języka rynku kapitałowego i „inwestorów”. Ta grupa myśli o lokacie, nie o portfelu akcji.',
      ],
      kanaly: ['Facebook', 'Prasa lokalna', 'Radio', 'Newsletter'],
      przyklad:
        'Rząd zwolnił z podatku akcje do stu tysięcy, a Twoją lokatę tylko do dwudziestu pięciu. W Niemczech oszczędzający ma prostą kwotę wolną. Dlaczego polski ciułacz jest traktowany gorzej niż gracz giełdowy?',
    },
    {
      id: 'wolnosciowcy',
      nazwa: 'Wolnościowe skrzydło Konfederacji',
      opis: 'Wyborcy Konfederacji, dla których Belka to symboliczny relikt lewicy.',
      podstawa: 'Postulat jest w programie Konfederacji od 2023 r.; ich elektorat wyróżnia poparcie dla niskich podatków.',
      kat: 'Krytyka jakości OKI, nie przejęcie postulatu. Rząd uchwalił namiastkę z haczykiem.',
      coDziala: [
        'Wypunktowanie, że OKI wprowadza nowy podatek od wartości aktywów, czyli w miejsce jednego podatku wchodzi drugi.',
        'Porównanie z Czechami i Słowacją, gdzie inwestycja długoterminowa jest w ogóle nieopodatkowana.',
      ],
      czegoUnikac: [
        'Licytowania się z Konfederacją na pełną, bezwarunkową likwidację. Pełne zwolnienie bez limitu jest merytorycznie słabsze i drogie.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze'],
      przyklad:
        'OKI nie znosi podatku Belki, tylko zamienia go na podatek od wartości aktywów, wzorem holenderskiego box 3, który tamtejsze sądy uznały za niekonstytucyjny. To nie jest reforma, to zamiana haczyka na haczyk.',
    },
  ],

  luki: [
    'Brak trzeciego reprezentatywnego sondażu ogólnopolskiego o podatku Belki z pełną metodologią. Nie podawać liczb z pamięci.',
    'Dokładna data i próba badania UCE Research do potwierdzenia u źródła (w obiegu jako 2022, cytowane też w 2024).',
    'Dane MF o wpływach pochodzą ze źródeł wtórnych; do publikacji sięgnąć do komunikatów Ministerstwa Finansów.',
    'Doniesienia o poparciu prezydenta Nawrockiego dla likwidacji podatku Belki pochodzą ze źródła publicystycznego, do weryfikacji.',
  ],
};
