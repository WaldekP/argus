/**
 * Temat: dobrowolny ZUS dla przedsiębiorców (program Konfederacji 2023).
 * Postulat nośny w kampanii, ale niebezpieczny: ubóstwo emerytalne i dziura w FUS.
 * Dla Petru raczej pułapka niż łup.
 */

import type { Temat } from '../types';

export const dobrowolnyZus: Temat = {
  slug: 'dobrowolny-zus',
  nazwa: 'Dobrowolny ZUS dla przedsiębiorców',
  zajawka:
    'Nośne hasło z groźnym dnem: ubóstwo emerytalne i głębsza dziura w FUS. Zero z 25 ekonomistów za.',
  aktualizacja: '24 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 16,
  doWeryfikacji: 3,

  rekomendacja: {
    pytanie: 'Poprzeć dobrowolny ZUS, żeby podebrać wyborców Konfederacji?',
    odpowiedz:
      'Nie popierać dobrowolności. Przejąć realny problem (wysokie składki dławią mikrofirmy) i zaproponować rozwiązanie bez pułapki emerytalnej.',
    uzasadnienie: [
      'To najbardziej ryzykowny postulat pakietu. Prowadzi wprost do ubóstwa emerytalnego samozatrudnionych i głębszej dziury w FUS, którą i tak pokryje budżet.',
      'Konsensus ekspercki jest miażdżący: żaden z 25 ekonomistów w panelu „Rzeczpospolitej” nie poparł dobrowolnego ZUS.',
      'Realny ból (składka ok. 1600 zł miesięcznie przy „dużym ZUS”) jest prawdziwy i da się na niego odpowiedzieć bez rozmontowywania systemu emerytalnego.',
    ],
    ryzyko: [
      'Hasło jest nośne wśród przedsiębiorców i młodych, czyli w trzonie elektoratu Konfederacji. Frontalny sprzeciw może zrazić tę grupę.',
      'Rząd już rozwodnił temat „wakacjami składkowymi”, więc pole częściowo zajęte.',
    ],
    podchwycic: [
      'Diagnoza, nie recepta: składki są realną barierą dla mikrofirm i start-upów. To prawda i można ją głośno przyznać, nie zgadzając się na dobrowolność.',
      'Rozwiązania pośrednie: dłuższy okres ulgowych składek na starcie, składka proporcjonalna do dochodu, uproszczenie. Odbiera Konfederacji problem, nie kupując jej rozwiązania.',
    ],
    zaatakowac: [
      'Ubóstwo emerytalne: przy gwarantowanej emeryturze minimalnej racjonalną strategią staje się nieskładanie na ZUS i liczenie na dopłatę państwa. Najbardziej zagrożone są przedsiębiorcze kobiety (raport ZUS).',
      'Dziura w FUS: fundusz już jest deficytowy (składki pokrywają 83 proc. wydatków, budżet dopłaca ok. 65 mld zł rocznie). Dobrowolność pogłębia lukę, którą pokryją wszyscy podatnicy.',
      'Niespójność: Konfederacja obiecuje wolność, a skutkiem jest przerzucenie kosztu ubogich emerytur na ogół. „Dobrowolne ubóstwo” (nazwa opinii BCC).',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '0 z 25',
      opis: 'Tylu ekonomistów w panelu „Rzeczpospolitej” poparło dobrowolny ZUS. Określenie: „ekstremalnie nieracjonalny pomysł”.',
      doPublikacji: true,
    },
    {
      wartosc: '65 mld zł',
      opis: 'Dotacja budżetu do FUS w 2024 r. Fundusz jest już deficytowy przed jakąkolwiek dobrowolnością.',
      doPublikacji: true,
    },
    {
      wartosc: '~1600 zł',
      opis: 'Miesięczne składki społeczne przedsiębiorcy przy „dużym ZUS” w 2024 r. To realny ból, który napędza postulat.',
      doPublikacji: true,
    },
    {
      wartosc: '3,4 mld zł',
      opis: 'Roczny ubytek FUS przy założeniu, że 25 proc. przedsiębiorców zrezygnuje (szacunek wnioskodawców).',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Brak świeżego, reprezentatywnego sondażu ogółu wprost o dobrowolnym ZUS. To realna luka i żadnej liczby o poparciu ogółu nie należy publikować jako pewnej.',
    'Sondaż przedsiębiorców IPC z 2019 r.: 45 proc. zadeklarowało chęć rezygnacji ze składek, 43 proc. płaciłoby dalej. Deklaracja chęci, nie realne zachowanie, i mocno nieaktualna.',
    'W rankingu poparcia dla postulatów partyjnych z 2023 r. dobrowolny ZUS znalazł się na przedostatnim miejscu.',
    'Kluczowy wniosek strategiczny: baza Konfederacji nie jest spójnie wolnorynkowa. 68 proc. jej wyborców popiera opiekuńcze funkcje państwa. Dobrowolny ZUS wyprzedza poglądy własnego elektoratu.',
  ],

  politycy: [
    {
      id: 'mentzen',
      imieNazwisko: 'Sławomir Mentzen',
      funkcja: 'poseł, lider Nowej Nadziei',
      ugrupowanie: 'Konfederacja',
      stanowisko: 'Dobrowolny ZUS jako sztandarowy postulat wolności gospodarczej.',
      slabyPunkt: 'Postulat, którego nie poparł żaden z 25 ekonomistów i który prowadzi do ubóstwa emerytalnego jego własnych wyborców.',
      wypowiedzi: [
        {
          id: 'mentzen-8-lat',
          cytat:
            'Morawiecki gdy już traci władzę, proponuje dobrowolny ZUS dla przedsiębiorców, długie vacatio legis w sprawach podatkowych i kilka innych udogodnień. Mieliście przecież na to 8 lat! Woleliście w tym czasie podnosić i komplikować w rekordowym tempie podatki.',
          miejsce: 'Wpis na platformie X',
          data: '17 listopada 2023',
          poCo: 'Pokazuje, jak Konfederacja rozgrywa temat: oskarża PiS o hipokryzję. Ta sama logika działa przeciw niej, bo dobrowolny ZUS też jest niedopięty.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Mentzen odpowiada Morawieckiemu: mieliście przecież na to 8 lat',
            url: 'https://tvn24.pl/biznes/z-kraju/mentzen-odpowiada-morawieckiemu-mieliscie-przeciez-na-to-8-lat-st7443054',
            wydawca: 'TVN24 Biznes',
            data: '17 listopada 2023',
          },
        },
      ],
    },
    {
      id: 'tusk',
      imieNazwisko: 'Donald Tusk',
      funkcja: 'premier',
      ugrupowanie: 'Koalicja Obywatelska',
      stanowisko: 'Odpowiedział na postulat węższym rozwiązaniem: wakacjami składkowymi, nie dobrowolnością.',
      slabyPunkt: 'Rozwodnił postulat Konfederacji do jednego miesiąca zwolnienia rocznie, zamiast rozwiązać problem systemowo.',
      wypowiedzi: [
        {
          id: 'tusk-wakacje',
          cytat:
            'Te osoby będą mogły liczyć na ten długo wyczekiwany tzw. urlop dla przedsiębiorców, czyli możliwość wzięcia takiego urlopu i to jest miesiąc w ciągu roku, kiedy mikroprzedsiębiorca nie będzie musiał płacić składki ZUS-owskiej.',
          miejsce: 'Konferencja po posiedzeniu rządu',
          data: '19 marca 2024',
          poCo: 'Dowód, że mainstream przejął język Konfederacji, ale rozwodnił postulat. Można pokazać, że ani dobrowolność, ani wakacje nie rozwiązują problemu wysokich składek.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Wakacje składkowe. Tusk o szczegółach urlopu od ZUS',
            url: 'https://dorzeczy.pl/ekonomia/563790/wakacje-skladkowe-tusk-o-szczegolach-urlopu-od-zus.html',
            wydawca: 'Do Rzeczy',
            data: '19 marca 2024',
          },
        },
      ],
    },
  ],

  segmenty: [
    {
      id: 'mikrofirmy',
      nazwa: 'Mikroprzedsiębiorcy i samozatrudnieni',
      opis: 'Grupa, dla której składka ZUS jest realnym, comiesięcznym bólem.',
      podstawa: 'Sondaż IPC 2019 (deklaratywny): 45 proc. przedsiębiorców rozważało rezygnację ze składek. Składka „dużego ZUS” 2024 to ok. 1600 zł miesięcznie.',
      kat: 'Rozumiem ból, nie sprzedaję pułapki. Przejąć problem, zaproponować rozwiązanie bez ubóstwa emerytalnego.',
      coDziala: [
        'Głośne przyznanie, że składka na starcie dławi mikrofirmy.',
        'Konkret: składka proporcjonalna do dochodu, dłuższy okres ulgowy, uproszczenie rozliczeń.',
      ],
      czegoUnikac: [
        'Obietnicy pełnej dobrowolności. To pułapka, która wraca do tej grupy jako ubóstwo emerytalne za 30 lat.',
        'Straszenia ZUS-em bez alternatywy. Trzeba dać rozwiązanie, nie tylko empatię.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze', 'Media dla przedsiębiorców', 'LinkedIn'],
      przyklad:
        'Wiem, że 1600 złotych składki na starcie dławi jednoosobową firmę. Ale dobrowolny ZUS to obietnica biedy na emeryturze. Zamiast tego: składka od realnego dochodu i dłuższy okres ulgowy.',
    },
  ],

  luki: [
    'Brak świeżego, reprezentatywnego sondażu ogółu wprost o dobrowolnym ZUS. Sondaż „54/67 proc.” z obiegu ma źródło wtórne bez autora i daty, nie do publikacji.',
    'Sondaż IPC pochodzi z 2019 r. i mierzy deklaracje, nie zachowania.',
    'Status legislacyjny projektu (skierowany do I czytania w komisjach) wymaga potwierdzenia na stronach Sejmu.',
    'Implikowana wartość ~13,8 mld zł całości składek społecznych przedsiębiorców opiera się na założeniu wnioskodawców, nie na niezależnym wyliczeniu.',
  ],
};
