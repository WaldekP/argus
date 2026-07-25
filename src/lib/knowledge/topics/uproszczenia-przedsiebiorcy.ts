/**
 * Temat: uproszczenia podatkowe dla przedsiębiorców (program Konfederacji 2023).
 * Hasło bez rozpisanych szczegółów, ale trafiające w realny konsensus:
 * polski system jest za skomplikowany. Najbezpieczniejszy do przejęcia.
 */

import type { Temat } from '../types';

export const uproszczenia: Temat = {
  slug: 'uproszczenia-przedsiebiorcy',
  nazwa: 'Uproszczenia podatkowe dla przedsiębiorców',
  zajawka:
    'Hasło bez szczegółów, ale w punkt: 334 godziny rocznie na rozliczenia wobec 50 w Estonii. Najłatwiejszy do przejęcia postulat pakietu.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 31,
  doWeryfikacji: 3,

  rekomendacja: {
    pytanie: 'Czy to pole warto zająć, skoro Konfederacja mówi o nim ogólnikami?',
    odpowiedz:
      'Tak, i to najmocniej z całego pakietu. Konfederacja ma hasło bez treści, więc konkretny plan uproszczeń wzorem Estonii przejmuje temat w całości.',
    uzasadnienie: [
      'To jedyny postulat pakietu, który jest tani, popularny i bezpieczny naraz. Nie rozsadza budżetu i nie ma groźnego dna jak dobrowolny ZUS.',
      'Konsensus jest szeroki: 78 proc. Polaków uważa system za zbyt skomplikowany, a organizacje przedsiębiorców (Rada reprezentująca ok. 380 organizacji) od lat domagają się uproszczeń.',
      'Estonia daje gotowy, mierzalny wzorzec: rozliczenie w minuty, 50 godzin rocznie zamiast polskich 334. To konkret, którego Konfederacja nie ma.',
    ],
    ryzyko: [
      'Uproszczenia to temat mało chwytliwy medialnie, bo pozytywny i techniczny. Trudno na nim zbudować emocję.',
      'Wiarygodność wymaga konkretów. Samo hasło „uproszczę podatki” brzmi jak każde inne.',
    ],
    podchwycic: [
      'Wzorzec estoński: rozliczenie PIT w kilka minut, 99 proc. deklaracji online, wstępnie wypełnione formularze. Estonia jest numerem 1 rankingu konkurencyjności podatkowej Tax Foundation od 11 lat.',
      'Konkret liczbowy: polski przedsiębiorca traci 334 godziny rocznie na rozliczenia (PwC), wobec 50 w Estonii i ok. 164 średniej unijnej. To gotowy, mocny obraz.',
      'Stabilność przepisów: w 2024 r. przybyło 14 tys. stron nowych przepisów (Grant Thornton). Obietnica końca chaosu pokroju Polskiego Ładu trafia w zmęczenie ciągłymi zmianami.',
    ],
    zaatakowac: [
      'Konfederacja mówi o „prostych podatkach”, a sama złożyła projekt kwoty wolnej z błędem, który dawał 500 tys. zł. Trudno uchodzić za mistrza prostoty, gdy nie umie się napisać jednej ustawy.',
      'Hasło bez treści: „szeroki wachlarz uproszczeń” bez wskazania, których. Można to zderzyć z pytaniem, co konkretnie i jak, oraz z gotowym planem estońskim.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '334 godz.',
      opis: 'Tyle rocznie polski przedsiębiorca poświęca na obowiązki podatkowe (PwC). W Estonii ok. 50 godzin.',
      doPublikacji: true,
    },
    {
      wartosc: '3 minuty',
      opis: 'Tyle zajmuje rozliczenie PIT online w Estonii. 99 proc. deklaracji składanych cyfrowo.',
      doPublikacji: true,
    },
    {
      wartosc: '78%',
      opis: 'Tylu Polaków uważa system podatkowy za zbyt skomplikowany (CBOS 85/2016).',
      doPublikacji: true,
    },
    {
      wartosc: '31 / 38',
      opis: 'Pozycja Polski w rankingu konkurencyjności podatkowej Tax Foundation (2024). Estonia jest pierwsza.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Uproszczenie systemu ma najszersze możliwe poparcie: 78 proc. Polaków uważa system za zbyt skomplikowany, 82 proc. za nieszczelny (CBOS 85/2016).',
    'Organizacje przedsiębiorców są zgodne co do diagnozy: Lewiatan zgłosił 24 postulaty podatkowe, Rzecznik MŚP domaga się m.in. odliczenia 75 proc. składki zdrowotnej i uproszczenia ryczałtu.',
    'Skala problemu rośnie: w 2024 r. przybyło 14 158 stron nowych aktów prawnych (Grant Thornton, „Barometr prawa”).',
    'To temat pozytywny i konsensualny, więc mniej nośny medialnie, ale najbezpieczniejszy politycznie z całego pakietu.',
  ],

  badania: [
    {
      id: 'cbos-85-2016',
      instytut: 'CBOS',
      zleceniodawca: 'badanie statutowe, komunikat 85/2016',
      termin: 'maj 2016',
      proba: '1100 osób, CAPI, reprezentatywna',
      pytanie: 'Jak ocenia Pan(i) polski system podatkowy?',
      wyniki: [
        { etykieta: 'Podatki za wysokie wobec tego, co daje państwo', procent: 87, kluczowy: true },
        { etykieta: 'System nieszczelny', procent: 82 },
        { etykieta: 'System zbyt skomplikowany', procent: 78, kluczowy: true },
      ],
      jakCzytac:
        'Najszerszy konsensus z całego pakietu. Uproszczenie trafia w realny, mierzony nastrój. To najmocniejszy fundament pod obietnicę uproszczeń, bo nie wymaga przekonywania nikogo, że problem istnieje.',
      zrodlo: {
        tytul: 'Komunikat z badań 85/2016: Postawy wobec płacenia podatków',
        url: 'https://cbos.pl/SPISKOM.POL/2016/K_085_16.PDF',
        wydawca: 'CBOS',
        data: 'czerwiec 2016',
      },
    },
  ],

  zagranica: [
    {
      kraj: 'Estonia',
      opis: 'Rozliczenie PIT online zajmuje średnio kilka minut, jednym kliknięciem. 99 proc. deklaracji składanych cyfrowo, formularze wstępnie wypełnione, zwrot podatku w 5 dni. Estonia jest numerem 1 rankingu konkurencyjności podatkowej Tax Foundation od 11 lat z rzędu.',
      wniosek:
        'To dowód, że prosty system nie jest utopią, tylko decyzją. Estonia zbudowała go na cyfryzacji i wstępnym wypełnianiu deklaracji, nie na jednej stawce. Prostotę da się przejąć bez liniowego PIT.',
      zrodlo: {
        tytul: 'e-Tax: filing taxes in Estonia',
        url: 'https://e-estonia.com/solutions/ease_of_doing_business/e-tax/',
        wydawca: 'e-Estonia',
        data: '2024',
      },
    },
    {
      kraj: 'Czas rozliczeń w UE',
      opis: 'Według metryki PwC czasu potrzebnego na obowiązki podatkowe: Polska ok. 334 godziny rocznie, Węgry 277, Estonia ok. 50. Średnia unijna to ok. 164 godziny, czyli połowa polskiego wyniku.',
      wniosek:
        'Polska nie odstaje wysokością podatków, tylko czasochłonnością ich rozliczania. To argument techniczny, nie ideologiczny, więc trudniejszy do zbicia dla przeciwnika.',
      zrodlo: {
        tytul: 'Paying Taxes: czas rozliczeń w regionie',
        url: 'https://www.pwc.com/sk/en/current-press-releases/studia-paying-taxes-2019.html',
        wydawca: 'PwC',
        data: '2019',
      },
    },
    {
      kraj: 'OECD (cyfryzacja)',
      opis: 'W krajach OECD ok. 90 proc. deklaracji PIT składanych jest elektronicznie, a 85 proc. administracji wstępnie wypełnia deklaracje podatnika. Polska ma tu wyraźne pole do nadrobienia.',
      wniosek:
        'Kierunek reformy jest sprawdzony i mierzalny: cyfryzacja plus prefill. To plan, który można obiecać konkretnie, a nie hasłem.',
      zrodlo: {
        tytul: 'Tax Administration 2025',
        url: 'https://www.oecd.org/en/publications/tax-administration-2025_cc015ce8-en.html',
        wydawca: 'OECD',
        data: '2025',
      },
    },
  ],

  politycy: [
    {
      id: 'mentzen',
      imieNazwisko: 'Sławomir Mentzen',
      funkcja: 'poseł, lider Nowej Nadziei',
      ugrupowanie: 'Konfederacja',
      stanowisko: 'Firmuje hasło „najprostszych podatków w Europie”, bez rozpisanych mechanizmów.',
      slabyPunkt: 'Obiecuje prostotę, a jego klub złożył wadliwie napisany projekt ustawy podatkowej.',
      wypowiedzi: [
        {
          id: 'mentzen-najprostsze',
          cytat: 'Polacy zasługują na najprostsze podatki w Europie.',
          miejsce: 'Spotkanie z mieszkańcami w Zduńskiej Woli',
          data: '28 listopada 2024',
          poCo: 'Sztandarowe hasło Konfederacji o uproszczeniach. Do przejęcia z konkretem estońskim, którego Konfederacji brakuje.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Mentzen już składa obietnice wyborcze. „Polacy zasługują na najprostsze podatki w Europie”',
            url: 'https://www.bankier.pl/wiadomosc/Mentzen-juz-sklada-obietnice-wyborcze-Polacy-zasluguja-na-najprostsze-podatki-w-Europie-8853146.html',
            wydawca: 'Bankier.pl',
            data: '28 listopada 2024',
          },
        },
      ],
    },
    {
      id: 'morawiecki',
      imieNazwisko: 'Mateusz Morawiecki',
      funkcja: 'poseł, były premier',
      ugrupowanie: 'Prawo i Sprawiedliwość',
      stanowisko: 'Pod koniec rządów PiS zaproponował długie vacatio legis w sprawach podatkowych.',
      slabyPunkt: 'To rząd PiS wprowadził Polski Ład, symbol chaosu podatkowego, więc jego apel o stabilność brzmi niewiarygodnie.',
      wypowiedzi: [
        {
          id: 'morawiecki-vacatio',
          cytat: 'Z programu Konfederacji jak najbardziej podpisujemy się pod postulatem, w którym również my mamy wiarygodność.',
          miejsce: 'Konferencja na Giełdzie Papierów Wartościowych, Warszawa',
          data: '17 listopada 2023',
          poCo: 'PiS przejmuje hasło uproszczeń tracąc władzę. Zestawić z Polskim Ładem, który sam był wzorem komplikacji.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Premier obiecuje coś, czego nie chciał jego rząd. „Podpisujemy się”',
            url: 'https://biznes.interia.pl/podatki/news-premier-obiecuje-cos-czego-nie-chcial-jego-rzad-podpisujemy-,nId,7160494',
            wydawca: 'Interia Biznes',
            data: '17 listopada 2023',
          },
        },
      ],
    },
  ],

  segmenty: [
    {
      id: 'przedsiebiorcy',
      nazwa: 'Przedsiębiorcy i samozatrudnieni',
      opis: 'Grupa, która na własnej skórze czuje złożoność systemu.',
      podstawa: 'PwC: 334 godziny rocznie na rozliczenia. Rada Przedsiębiorców (ok. 380 organizacji) od lat domaga się uproszczeń.',
      kat: 'Konkret i stabilność. Nie „proste podatki”, tylko estoński plan i koniec z chaosem pokroju Polskiego Ładu.',
      coDziala: [
        'Liczba 334 godzin rocznie wobec 50 w Estonii: namacalny obraz zmarnowanego czasu.',
        'Obietnica stabilności: żadnych zmian w trakcie roku, długie vacatio legis.',
        'Pozyskanie organizacji przedsiębiorców jako sojuszników, a nie zostawianie ich Konfederacji.',
      ],
      czegoUnikac: [
        'Hasła „najprostsze podatki w Europie” bez konkretu. To już mówi Mentzen.',
        'Obiecywania rzeczy niewykonalnych obok uproszczeń (jak likwidacja połowy danin), bo psuje to wiarygodność całości.',
      ],
      kanaly: ['LinkedIn', 'Media dla przedsiębiorców', 'Podcasty gospodarcze', 'X'],
      przyklad:
        'Polski przedsiębiorca traci 334 godziny rocznie na rozliczenia. Estończyk 50, bo rozlicza się jednym kliknięciem. Nie obiecuję cudów, obiecuję estoński plan i koniec zmian w połowie roku.',
    },
  ],

  luki: [
    'Konfederacja nie rozpisała mechanizmów uproszczeń, więc nie da się ocenić konkretnej treści postulatu.',
    'Sondaże o ocenie skomplikowania systemu (84 proc., 73 proc., 34 proc. z obiegu) pochodzą z doniesień wtórnych bez pełnej metodologii. Publikowalny jest CBOS 85/2016.',
    'Dane o czasie rozliczeń pochodzą z różnych, nieporównywalnych metodologii (Bank Światowy zakończył Paying Taxes w 2021 r.). Podawać z rokiem.',
    'Pozycja Polski w Tax Complexity Index PwC (63/64) do potwierdzenia w konkretnej edycji raportu.',
  ],
};
