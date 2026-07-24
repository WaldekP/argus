/**
 * Temat: likwidacja 15 podatków (program Konfederacji 2023).
 * Postulat efektowny hasłowo, fiskalnie drobny. Wartość głównie symboliczna.
 */

import type { Temat } from '../types';

export const likwidacja15: Temat = {
  slug: 'likwidacja-15-podatkow',
  nazwa: 'Likwidacja 15 podatków',
  zajawka:
    'Efektowne hasło o niskiej wadze fiskalnej. Dobre do przejęcia w węższej, konkretnej wersji.',
  aktualizacja: '24 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 8,
  doWeryfikacji: 2,

  rekomendacja: {
    pytanie: 'Czy warto wchodzić w hasło likwidacji 15 podatków?',
    odpowiedz:
      'Nie kopiować listy. Wybrać dwa lub trzy najbardziej dokuczliwe i uciążliwe podatki i zrobić z nich własny, wykonalny postulat.',
    uzasadnienie: [
      'Sama lista jest fiskalnie tania (drobne daniny), więc likwidacja części jest realna bez rozsadzania budżetu, w przeciwieństwie do PIT liniowego czy dobrowolnego ZUS.',
      'Hasło „15 podatków” brzmi radykalnie i populistycznie, ale konkretne, dokuczliwe daniny (podatek cukrowy, opłaty w cenie prądu) to realny, odczuwalny temat.',
      'To pole, gdzie można pokazać się jako ktoś, kto upraszcza państwo konkretnie, a nie hasłowo.',
    ],
    ryzyko: [
      'Brak sumy wpływów z tych 15 danin: nie da się rzetelnie policzyć kosztu, co utrudnia obronę liczbowej rzetelności.',
      'Pełna lista pochodzi z jednego źródła (inFakt) i nie została zweryfikowana wobec oryginalnego programu. Nie cytować jej jako pewnej.',
      'Likwidacja opłat targowej, uzdrowiskowej czy miejscowej uderza w dochody samorządów, a nie budżetu centralnego.',
    ],
    podchwycic: [
      'Podatek cukrowy i opłaty zaszyte w cenach (mocowa, przejściowa, emisyjna): to ukryte podatki, które ludzie płacą, nie wiedząc o tym. Dobry, konkretny temat o przejrzystości.',
      'Rama „państwo mnoży drobne daniny, których nikt nie rozumie”: trafia w poczucie, że system jest przekombinowany.',
    ],
    zaatakowac: [
      'Hasło „15 podatków” bez policzonego kosztu i bez pełnej listy w oficjalnym programie to typowy chwyt populistyczny. Można je zderzyć z pytaniem, ile to naprawdę daje i kto straci (samorządy).',
      'Ekspertka Małgorzata Starczewska-Krzysztoszek: program Konfederacji „pokazuje, że partia najwyraźniej niewiele rozumie z gospodarki”. Cytat działa na całość pakietu.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '15',
      opis: 'Liczba podatków i opłat do likwidacji według hasła Konfederacji. Pełna lista z jednego źródła.',
      doPublikacji: true,
    },
    {
      wartosc: 'brak sumy',
      opis: 'Żadne źródło nie sumuje wpływów z tych 15 danin. To w większości drobne, mało wydajne opłaty.',
      doPublikacji: true,
    },
    {
      wartosc: '182 mld zł',
      opis: 'Koszt całego pakietu Konfederacji (FOR). Ciężar leży w PIT liniowym, nie w 15 drobnych podatkach.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Brak dedykowanych badań opinii o likwidacji tych konkretnych 15 danin.',
    'Ogólny kontekst: 87 proc. Polaków uważa, że podatki są zbyt wysokie wobec tego, co państwo daje, a 78 proc., że system jest zbyt skomplikowany (CBOS 85/2016). Hasło upraszczania trafia w realny nastrój.',
    'Uwaga: część danin z listy (opłata targowa, uzdrowiskowa, miejscowa) to dochody samorządów, nie budżetu państwa. Likwidacja przerzuca problem na gminy.',
  ],

  politycy: [
    {
      id: 'bosak',
      imieNazwisko: 'Krzysztof Bosak',
      funkcja: 'wicemarszałek Sejmu',
      ugrupowanie: 'Konfederacja',
      stanowisko: 'Filozofia oddawania ludziom dochodów zamiast mnożenia danin.',
      slabyPunkt: 'Operuje hasłem, nie policzonym bilansem. Program jako całość eksperci uznali za niedopięty fiskalnie.',
      wypowiedzi: [
        {
          id: 'bosak-dochody',
          cytat: 'Chcemy ludziom dać ich własne dochody, a nie zabrać.',
          miejsce: 'Konwencja „Konstytucja Wolności”, Expo XXI, Warszawa',
          data: '24 czerwca 2023',
          poCo: 'Rama filozoficzna Konfederacji. Do przejęcia w wersji konkretnej (te dwa, trzy podatki), nie hasłowej (wszystkie 15).',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Likwidacja podatków, dobrowolny ZUS. Konfederacja przedstawiła program',
            url: 'https://www.wprost.pl/polityka/wybory-parlamentarne-2023/11279089/likwidacja-podatkow-dobrowolny-zus-wzmocnienie-granic-konfederacja-przedstawila-program.html',
            wydawca: 'Wprost',
            data: '24 czerwca 2023',
          },
        },
      ],
    },
  ],

  segmenty: [
    {
      id: 'wolnosciowcy',
      nazwa: 'Wolnościowe skrzydło Konfederacji',
      opis: 'Wyborcy wrażliwi na hasło ograniczania państwa i danin.',
      podstawa: 'Program Konfederacji 2023; elektorat wyróżnia się poparciem dla niskich podatków (CBOS 43/2025).',
      kat: 'Konkret zamiast hasła. Zamiast licytować liczbę podatków, pokazać jeden, którego wszyscy nienawidzą.',
      coDziala: [
        'Podatek cukrowy i ukryte opłaty w cenie prądu jako namacalne przykłady mnożenia danin.',
        'Przejrzystość: ile z rachunku za prąd to ukryte podatki.',
      ],
      czegoUnikac: [
        'Powtarzania okrągłego „15 podatków” bez pokrycia w liczbach. Łatwo o kontrę „a ile to daje”.',
      ],
      kanaly: ['X', 'Facebook', 'Media dla przedsiębiorców'],
      przyklad:
        'Nie licytuję się, ile podatków zlikwiduję. Wskazuję jeden: podatek cukrowy, który płacisz w cenie każdego napoju, nie wiedząc o tym. Zacznijmy od uczciwości, ile naprawdę płacimy.',
    },
  ],

  luki: [
    'Pełna 15-punktowa lista pochodzi z jednego źródła (inFakt), niezweryfikowana wobec oryginalnego PDF programu Konfederacji.',
    'Brak danych o wpływach z poszczególnych danin i o łącznym koszcie ich likwidacji.',
    'Brak sondaży o poparciu dla likwidacji tych konkretnych podatków.',
  ],
};
