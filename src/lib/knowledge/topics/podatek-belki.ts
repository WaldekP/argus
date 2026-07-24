/**
 * Temat: zwolnienie lokat i obligacji z podatku Belki (program Konfederacji 2023).
 * Najbezpieczniejszy społecznie postulat pakietu: dwie trzecie Polaków za likwidacją.
 */

import type { Temat } from '../types';

export const podatekBelki: Temat = {
  slug: 'podatek-belki',
  nazwa: 'Zwolnienie lokat i obligacji z podatku Belki',
  zajawka:
    'Najbezpieczniejszy postulat pakietu: 67,5 proc. Polaków za likwidacją. Rząd obiecał to samo i nie dowiózł.',
  aktualizacja: '24 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 15,
  doWeryfikacji: 2,

  rekomendacja: {
    pytanie: 'Czy wchodzić w temat podatku Belki, skoro robią to wszyscy?',
    odpowiedz:
      'Tak, ale wejść od strony oszczędzających i rozliczyć rząd z niedowiezionej obietnicy, zamiast licytować się na pełną likwidację.',
    uzasadnienie: [
      'To najszerzej popierany postulat z całego pakietu: 67,5 proc. Polaków za likwidacją przy 9,2 proc. przeciw. Ryzyko wizerunkowe minimalne.',
      'Rząd Tuska sam obiecał zniesienie podatku Belki w „100 konkretach” i przez kilkanaście miesięcy tego nie zrobił. To gotowa linia rozliczenia, nie trzeba przejmować tematu.',
      'To postulat, w którym można stać po stronie drobnego ciułacza, nie giełdowego spekulanta, jeśli dobrze dobierze się ramę.',
    ],
    ryzyko: [
      'Pełne zwolnienie lokat i obligacji bez limitu premiuje też najzamożniejszych. Sami inwestorzy indywidualni wolą reformę niż całkowitą likwidację.',
      'To rekordowe i rosnące źródło dochodu (ponad 10 mld zł rocznie). Obietnica likwidacji bez wskazania, skąd wziąć te pieniądze, jest łatwa do skontrowania.',
    ],
    podchwycic: [
      'Rama „podatek od oszczędzania”: przy oprocentowaniu niższym od inflacji to de facto podatek od realnej straty. To trafia do zwykłego posiadacza lokaty, nie do inwestora.',
      'Kwota wolna w podatku Belki zamiast pełnej likwidacji: chroni drobnych ciułaczy, jest tańsza i odporna na zarzut prezentu dla bogatych. Konfederacja sama proponowała 100 tys. zł jako etap.',
    ],
    zaatakowac: [
      'Rząd Tuska: obietnica z „100 konkretów”, seria przesuwanych terminów (100 dni, marzec 2025, kwiecień 2025), a ostatecznie Domański: „zlikwidowany nie zostanie, zostanie ograniczony”. Klasyczny przykład rozjazdu obietnicy z realizacją.',
      'Wersja Konfederacji (pełne, bezwarunkowe zwolnienie) premiuje dużych inwestorów bez limitu. To da się pokazać jako niespójność z ich hasłem obrony zwykłego człowieka.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '67,5%',
      opis: 'Tylu Polaków za likwidacją podatku Belki (UCE Research/SYNO, IX 2022). Przeciw 9,2 proc.',
      doPublikacji: true,
    },
    {
      wartosc: '10,6 mld zł',
      opis: 'Wpływy z podatku Belki w 2024 r. Rekordowe i rosnące (9,07 mld w 2023).',
      doPublikacji: true,
    },
    {
      wartosc: '19%',
      opis: 'Stawka podatku Belki od zysków kapitałowych: odsetek z lokat, obligacji, zysków giełdowych.',
      doPublikacji: true,
    },
    {
      wartosc: '100 tys. zł',
      opis: 'Kwota wolna w podatku Belki proponowana przez Konfederację jako etap (projekt z lutego 2024).',
      doPublikacji: true,
    },
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
        'Najwyższe poparcie z całego pakietu Konfederacji. Silniejsze wśród mężczyzn (71,9 proc.) niż kobiet (63,5 proc.). Uwaga: pytanie dotyczy oszczędności, nie zysków giełdowych, gdzie nastroje są ostrożniejsze.',
      zrodlo: {
        tytul: 'Większość Polaków chce likwidacji podatku Belki',
        url: 'https://www.money.pl/podatki/wiekszosc-polakow-chce-likwidacji-podatku-belki-6808075249351168a.html',
        wydawca: 'money.pl',
        data: 'wrzesień 2022',
      },
    },
  ],

  syntezaOpinii: [
    'Podatek Belki jest wyjątkowo niepopularny: 67,5 proc. ogółu za jego likwidacją, przy zaledwie 9,2 proc. przeciw (UCE Research/SYNO, wrzesień 2022).',
    'Poparcie silniejsze wśród mężczyzn (71,9 proc.) niż kobiet (63,5 proc.) i najwyższe w wieku 36-55 lat oraz przy dochodach 3-5 tys. zł netto.',
    'Rozjazd między ogółem a inwestorami: sami inwestorzy indywidualni (badanie SII OBI 2025) wolą rozwiązania celowane, jak konta oszczędnościowe i ulgi, niż pełne zniesienie podatku.',
    'To najbezpieczniejszy komunikacyjnie postulat całego pakietu Konfederacji.',
  ],

  politycy: [
    {
      id: 'mentzen',
      imieNazwisko: 'Sławomir Mentzen',
      funkcja: 'poseł, lider Nowej Nadziei',
      ugrupowanie: 'Konfederacja',
      stanowisko: 'Podatek Belki jako „podatek od oszczędzania” i relikt rządów lewicy do zniesienia.',
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
      stanowisko: 'Rząd obiecał zniesienie, ostatecznie mówi o ograniczeniu, nie likwidacji.',
      slabyPunkt: 'Obietnica z „100 konkretów”, seria niedotrzymanych terminów, na końcu obniżenie ambicji z likwidacji do ograniczenia.',
      wypowiedzi: [
        {
          id: 'domanski-ograniczony',
          cytat: 'Będzie wprowadzone ograniczenie podatku Belki, ale w cztery dni tego się nie dało zrobić.',
          miejsce: 'Debata w Sejmie nad projektem budżetu na 2024 r.',
          data: '21 grudnia 2023',
          poCo: 'Pierwsze cofanie się z obietnicy: z „zniesienia” na „ograniczenie”, kilka tygodni po objęciu władzy. Gotowy materiał na rozliczenie rządu.',
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
      podstawa: 'UCE Research/SYNO 2022: najwyższe poparcie dla likwidacji w wieku 36-55 lat i przy dochodach 3-5 tys. zł netto.',
      kat: 'Podatek od oszczędzania, nie od spekulacji. Bohaterem jest ciułacz, nie gracz giełdowy.',
      coDziala: [
        'Rama realnej straty: gdy lokata daje mniej niż inflacja, państwo i tak bierze 19 proc.',
        'Kwota wolna zamiast pełnej likwidacji: chroni zwykłych ludzi, nie rekinów.',
      ],
      czegoUnikac: [
        'Języka rynku kapitałowego i „inwestorów”. Ta grupa myśli o lokacie, nie o portfelu akcji.',
      ],
      kanaly: ['Facebook', 'Prasa lokalna', 'Radio', 'Newsletter'],
      przyklad:
        'Odkładasz na lokacie, inflacja i tak zjada odsetki, a państwo na koniec bierze jeszcze swoje 19 procent. Rząd obiecał to znieść w sto dni. Minęły dwa lata.',
    },
    {
      id: 'wolnosciowcy',
      nazwa: 'Wolnościowe skrzydło Konfederacji',
      opis: 'Wyborcy Konfederacji, dla których Belka to symboliczny relikt lewicy.',
      podstawa: 'Postulat jest w programie Konfederacji od 2023 r.; ich elektorat wyróżnia poparcie dla niskich podatków.',
      kat: 'Rozliczenie rządu, nie przejęcie postulatu. Konfederacja już go ma, ale rząd go nie dowiózł.',
      coDziala: [
        'Wypunktowanie, że rząd obiecał zniesienie i skończył na „ograniczeniu”.',
      ],
      czegoUnikac: [
        'Licytowania się z Konfederacją na pełną, bezwarunkową likwidację. To ich pole i pełne zwolnienie jest merytorycznie słabsze.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze'],
      przyklad:
        'Wszyscy obiecali znieść podatek Belki. Konfederacja chce znieść nawet dużym graczom, rząd nie zniósł w ogóle. Ja bym chronił oszczędności zwykłych ludzi kwotą wolną, bez prezentu dla największych.',
    },
  ],

  luki: [
    'Dokładne odsetki z badania inwestorów SII OBI 2025 niedostępne (strona blokuje pobranie). Wniosek jakościowy potwierdzony, liczby nie.',
    'Brak danych o wpływach z podatku Belki za pełny 2025 r.',
    'Cytat Mentzena z 9 IX 2023 jest wtórny (Wikicytaty za Onet). Przed publikacją zweryfikować u źródła.',
  ],
};
