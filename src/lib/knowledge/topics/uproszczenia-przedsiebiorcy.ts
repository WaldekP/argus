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
    'Hasło bez szczegółów, ale w punkt: system jest absurdalnie skomplikowany. Najłatwiejszy do przejęcia postulat pakietu.',
  aktualizacja: '24 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 10,
  doWeryfikacji: 2,

  rekomendacja: {
    pytanie: 'Czy to pole warto zająć, skoro Konfederacja mówi o nim ogólnikami?',
    odpowiedz:
      'Tak, i to najmocniej z całego pakietu. Konfederacja ma hasło bez treści, więc konkretny plan uproszczeń przejmuje temat w całości.',
    uzasadnienie: [
      'To jedyny postulat pakietu, który jest tani, popularny i bezpieczny naraz. Nie rozsadza budżetu i nie ma groźnego dna jak dobrowolny ZUS.',
      'Konsensus jest szeroki: 78 proc. Polaków uważa system za zbyt skomplikowany, a organizacje przedsiębiorców (Rada reprezentująca ok. 380 organizacji) od lat domagają się uproszczeń.',
      'Konfederacja rzuciła hasło „proste podatki” bez rozpisanych mechanizmów. Kto wejdzie z konkretem, ten zabiera temat, a nie tylko go współdzieli.',
    ],
    ryzyko: [
      'Uproszczenia to temat mało chwytliwy medialnie, bo pozytywny i techniczny. Trudno na nim zbudować emocję.',
      'Wiarygodność wymaga konkretów. Samo hasło „uproszczę podatki” brzmi jak każde inne.',
    ],
    podchwycic: [
      'Konkret liczbowy: polski przedsiębiorca traci 334 godziny rocznie na rozliczenia (PwC 2024), wobec ok. 164 godzin średniej unijnej. To gotowy, mocny obraz.',
      'Stabilność przepisów jako obietnica: koniec z chaosem pokroju Polskiego Ładu. To trafia w zmęczenie ciągłymi zmianami.',
      'Poparcie organizacji przedsiębiorców, które można pozyskać jako sojuszników zamiast zostawiać je Konfederacji.',
    ],
    zaatakowac: [
      'Konfederacja mówi o „prostych podatkach”, a sama złożyła projekt kwoty wolnej z błędem, który dawał 500 tys. zł. Trudno uchodzić za mistrza prostoty, gdy nie umie się napisać jednej ustawy.',
      'Hasło bez treści: „szeroki wachlarz uproszczeń” bez wskazania, których. Można to zderzyć z pytaniem, co konkretnie i jak.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '334 godz.',
      opis: 'Tyle rocznie polski przedsiębiorca poświęca na obowiązki podatkowe (PwC, 2024).',
      doPublikacji: true,
    },
    {
      wartosc: '164 godz.',
      opis: 'Średnia dla UE i EFTA (Paying Taxes 2017). Punkt odniesienia, inna metodologia niż PwC 2024.',
      doPublikacji: true,
    },
    {
      wartosc: '78%',
      opis: 'Tylu Polaków uważa system podatkowy za zbyt skomplikowany (CBOS 85/2016).',
      doPublikacji: true,
    },
    {
      wartosc: '~380',
      opis: 'Liczba organizacji biznesu w Radzie Przedsiębiorców domagającej się uproszczeń. Potencjalni sojusznicy.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Uproszczenie systemu ma najszersze możliwe poparcie: 78 proc. Polaków uważa system za zbyt skomplikowany, 82 proc. za nieszczelny (CBOS 85/2016).',
    'Organizacje przedsiębiorców są zgodne co do diagnozy: system jest przekombinowany i niestabilny, a Polski Ład był symbolem chaosu.',
    'Uwaga metodologiczna: dane o czasie rozliczeń (271 vs 334 godziny) pochodzą z różnych badań. Bank Światowy zakończył ranking Paying Taxes w 2021 r., więc nie da się z tego zbudować jednego szeregu czasowego.',
    'To temat pozytywny i konsensualny, więc mniej nośny medialnie, ale najbezpieczniejszy politycznie z całego pakietu.',
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
          poCo: 'Sztandarowe hasło Konfederacji o uproszczeniach. Do przejęcia z konkretem, którego Konfederacji brakuje.',
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
      podstawa: 'PwC 2024: 334 godziny rocznie na rozliczenia. Rada Przedsiębiorców (ok. 380 organizacji) od lat domaga się uproszczeń.',
      kat: 'Konkret i stabilność. Nie „proste podatki”, tylko koniec z chaosem pokroju Polskiego Ładu.',
      coDziala: [
        'Liczba 334 godzin rocznie: namacalny obraz zmarnowanego czasu.',
        'Obietnica stabilności: żadnych zmian w trakcie roku, długie vacatio legis.',
        'Pozyskanie organizacji przedsiębiorców jako sojuszników, a nie zostawianie ich Konfederacji.',
      ],
      czegoUnikac: [
        'Hasła „najprostsze podatki w Europie” bez konkretu. To już mówi Mentzen.',
        'Obiecywania rzeczy niewykonalnych obok uproszczeń (jak likwidacja połowy danin), bo psuje to wiarygodność całości.',
      ],
      kanaly: ['LinkedIn', 'Media dla przedsiębiorców', 'Podcasty gospodarcze', 'X'],
      przyklad:
        'Polski przedsiębiorca traci 334 godziny rocznie na rozliczenia, dwa razy więcej niż średnia w Europie. Nie obiecuję cudów. Obiecuję, że przepisy przestaną się zmieniać w połowie roku.',
    },
  ],

  luki: [
    'Konfederacja nie rozpisała mechanizmów uproszczeń, więc nie da się ocenić konkretnej treści postulatu.',
    'Dane o czasie rozliczeń pochodzą z różnych, nieporównywalnych metodologii (Bank Światowy zakończył Paying Taxes w 2021 r.).',
    'Komunikat PwC 2024 potwierdza liczbę 334 godzin w tytule, ale sama strona blokuje pobranie pełnej treści.',
  ],
};
