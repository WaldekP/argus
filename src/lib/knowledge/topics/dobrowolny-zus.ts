/**
 * Temat: dobrowolny ZUS dla przedsiębiorców (program Konfederacji 2023).
 * Postulat nośny w kampanii, ale niebezpieczny: ubóstwo emerytalne i dziura w FUS.
 * Kluczowy argument: pełna dobrowolność nie ma odpowiednika w krajach rozwiniętych.
 */

import type { Temat } from '../types';

export const dobrowolnyZus: Temat = {
  slug: 'dobrowolny-zus',
  nazwa: 'Dobrowolny ZUS dla przedsiębiorców',
  zajawka:
    'Nośne hasło z groźnym dnem: ubóstwo emerytalne i dziura w FUS. Zero z 25 ekonomistów za, a świat idzie w przeciwną stronę.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 53,
  doWeryfikacji: 4,

  rekomendacja: {
    pytanie: 'Poprzeć dobrowolny ZUS, żeby podebrać wyborców Konfederacji?',
    odpowiedz:
      'Nie popierać dobrowolności. Przejąć realny problem (wysokie składki dławią mikrofirmy) i zaproponować rozwiązanie bez pułapki emerytalnej.',
    uzasadnienie: [
      'To najbardziej ryzykowny postulat pakietu. Prowadzi wprost do ubóstwa emerytalnego samozatrudnionych i głębszej dziury w FUS, którą i tak pokryje budżet.',
      'Konsensus ekspercki jest miażdżący: żaden z 25 ekonomistów w panelu „Rzeczpospolitej” nie poparł dobrowolnego ZUS.',
      'Pełna dobrowolność nie ma odpowiednika w żadnym dużym kraju rozwiniętym. Niemcy i Holandia, przywoływane jako wzory, właśnie rozszerzają obowiązek, nie znoszą go.',
      'Realny ból (składka ok. 1600 zł miesięcznie przy „dużym ZUS”) jest prawdziwy i da się na niego odpowiedzieć bez rozmontowywania systemu emerytalnego.',
    ],
    ryzyko: [
      'Hasło jest nośne wśród przedsiębiorców i młodych, czyli w trzonie elektoratu Konfederacji. Frontalny sprzeciw może zrazić tę grupę.',
      'Rząd już rozwodnił temat „wakacjami składkowymi”, więc pole częściowo zajęte.',
    ],
    podchwycic: [
      'Diagnoza, nie recepta: składki są realną barierą dla mikrofirm i start-upów. To prawda i można ją głośno przyznać, nie zgadzając się na dobrowolność.',
      'Rozwiązania pośrednie: dłuższy okres ulgowych składek na starcie, składka proporcjonalna do dochodu, uproszczenie. Odbiera Konfederacji problem, nie kupując jej rozwiązania.',
      'Wariant Gwiazdowskiego: sensowna wersja dobrowolności wymaga emerytury obywatelskiej jako siatki bezpieczeństwa. Konfederacja jej nie ma, więc jej projekt jest niedopięty.',
    ],
    zaatakowac: [
      'Świat idzie w drugą stronę: Niemcy (propozycja min. Bas 2025) i Holandia (obowiązek od 2027) rozszerzają obowiązek składkowy na samozatrudnionych, uznając dobrowolność za błąd. Konfederacja proponuje to, z czego inni się wycofują.',
      'Ubóstwo emerytalne: przy gwarantowanej emeryturze minimalnej racjonalną strategią staje się nieskładanie na ZUS i liczenie na dopłatę państwa. Najbardziej zagrożone są przedsiębiorcze kobiety (raport ZUS).',
      'Dziura w FUS: fundusz już jest deficytowy (składki pokrywają ok. 83 proc. wydatków, budżet dopłaca ok. 65 mld zł rocznie). Dobrowolność pogłębia lukę, którą pokryją wszyscy podatnicy. „Dobrowolne ubóstwo” (nazwa opinii BCC).',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '0 z 25',
      opis: 'Tylu ekonomistów w panelu „Rzeczpospolitej” poparło dobrowolny ZUS. Określenie: „ekstremalnie nieracjonalny pomysł”.',
      doPublikacji: true,
    },
    {
      wartosc: '27,5%',
      opis: 'Tylu samozatrudnionych realnie płaciłoby składki przy pełnej dobrowolności (raport ZUS), mimo że 67 proc. deklaruje chęć.',
      doPublikacji: true,
    },
    {
      wartosc: '65 mld zł',
      opis: 'Dotacja budżetu do FUS w 2024 r. (wykonanie; plan ustawy budżetowej zakładał 72,7 mld). Fundusz jest deficytowy przed jakąkolwiek dobrowolnością.',
      doPublikacji: true,
    },
    {
      wartosc: '~1600 zł',
      opis: 'Miesięczne składki społeczne przedsiębiorcy przy „dużym ZUS” w 2024 r. To realny ból, który napędza postulat.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Deklaratywne poparcie jest wysokie, ale kruche. INDICATOR 2019: 54 proc. za dobrowolnością, 67 proc. skorzystałoby z możliwości rezygnacji. Raport ZUS modeluje, że realnie płaciłoby dalej tylko 27,5 proc. Deklaracja to nie zachowanie.',
    'Zaufanie do form oszczędzania na emeryturę jest niskie: do ZUS ok. 40 proc., do OFE 22 proc., do PPK 19 proc. (IGTE 2023). To karmi postulat, ale nie znaczy, że ludzie sami odłożą na starość.',
    'CBOS: 85 proc. Polaków w wieku 18-44 sądzi, że na emeryturze będą potrzebować wielu źródeł dochodu; tylko 12 proc. liczy wyłącznie na emeryturę.',
    'Kluczowy wniosek strategiczny: baza Konfederacji nie jest spójnie wolnorynkowa. 68 proc. jej wyborców popiera opiekuńcze funkcje państwa. Dobrowolny ZUS wyprzedza poglądy własnego elektoratu.',
  ],

  badania: [
    {
      id: 'indicator-2019',
      instytut: 'Centrum Badań Marketingowych INDICATOR',
      zleceniodawca: 'badanie przywoływane przez Rzecznika MŚP',
      termin: '2019',
      proba: 'metodologia do potwierdzenia u źródła',
      pytanie: 'Czy popiera Pan(i) dobrowolność składek ZUS dla przedsiębiorców?',
      wyniki: [
        { etykieta: 'Skorzystałoby z rezygnacji', procent: 67, kluczowy: true },
        { etykieta: 'Popiera ideę dobrowolności', procent: 54 },
      ],
      jakCzytac:
        'Deklaratywne poparcie jest wysokie, ale rozjeżdża się z realnym zachowaniem. Raport ZUS modeluje, że przy pełnej dobrowolności składki płaciłoby dalej tylko 27,5 proc. samozatrudnionych. Cytuj deklarację razem z tym zastrzeżeniem, inaczej wprowadza w błąd.',
      zrodlo: {
        tytul: 'Dobrowolny ZUS, materiały Rzecznika MŚP (INDICATOR 2019)',
        url: 'https://rzecznikmsp.gov.pl/tag/dobrowolny-zus/',
        wydawca: 'Rzecznik MŚP',
        data: '2019',
      },
    },
  ],

  zagranica: [
    {
      kraj: 'Niemcy',
      opis: 'Samozatrudnieni nie są objęci powszechnym obowiązkiem emerytalnym, ale obowiązek jest szeroki i selektywny (rzemieślnicy, artyści przez Künstlersozialkasse, nauczyciele). W 2024 r. tylko ok. 29 proc. z 3,5 mln samozatrudnionych miało obowiązkowe zabezpieczenie. W maju 2025 r. ministra pracy zaproponowała objęcie składkami wszystkich samozatrudnionych.',
      wniosek:
        'Przywoływanie Niemiec jako wzoru „dobrowolnego ZUS” jest wybiórcze. Niemcy mają szeroki obowiązek branżowy i właśnie zmierzają do jego rozszerzenia, uznając dobrowolność za źródło przyszłego ubóstwa.',
      zrodlo: {
        tytul: 'Freelancers must make mandatory German pension contributions, says labour minister',
        url: 'https://www.iamexpat.de/expat-info/germany-news/freelancers-must-make-mandatory-german-pension-contributions-says-labour-minister',
        wydawca: 'IamExpat',
        data: 'maj 2025',
      },
    },
    {
      kraj: 'Holandia',
      opis: 'Samozatrudnieni nie są objęci obowiązkowym systemem pracowniczym, ale istnieje uniwersalna emerytura bazowa AOW dla wszystkich rezydentów, finansowana z podatków, chroniąca przed ubóstwem. Od 2027 r. planowany obowiązek ubezpieczenia na wypadek niezdolności do pracy dla samozatrudnionych.',
      wniosek:
        'Holenderska dobrowolność działa tylko dlatego, że jest siatka bezpieczeństwa w postaci emerytury obywatelskiej. Polski projekt Konfederacji jej nie zawiera, więc kopiuje formę bez zabezpieczenia.',
      zrodlo: {
        tytul: 'Pension provisions for self-employed professionals',
        url: 'https://business.gov.nl/starting-your-business/pension-and-insurance/pension-provisions-for-self-employed-professionals/',
        wydawca: 'Business.gov.nl',
        data: '2024',
      },
    },
    {
      kraj: 'USA i kraje CEE',
      opis: 'W USA samozatrudniony płaci obowiązkowo self-employment tax 15,3 proc., bez opcji rezygnacji. W Czechach obowiązkowa składka społeczna 29,2 proc., na Słowacji 18 proc. z minimalną podstawą. Bezpośredni sąsiedzi Polski utrzymują obowiązek.',
      wniosek:
        'Pełna dobrowolność, jaką proponuje Konfederacja, nie ma odpowiednika w żadnym dużym kraju rozwiniętym ani w regionie. To postulat bezprecedensowy, nie import sprawdzonego wzorca.',
      zrodlo: {
        tytul: 'Self-Employment Tax (Social Security and Medicare Taxes)',
        url: 'https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes',
        wydawca: 'IRS',
        data: '2024',
      },
    },
    {
      kraj: 'OECD (synteza)',
      opis: 'W większości krajów OECD samozatrudnieni są objęci obowiązkiem, często z obniżoną stawką albo ryczałtem (jak w Polsce). Tam, gdzie mogą nie wchodzić do systemu zarobkowego (Niemcy, Holandia, Dania), zawsze istnieje filar bazowy chroniący przed ubóstwem. Samozatrudniony w OECD dostaje średnio emeryturę równą 79 proc. emerytury pracownika.',
      wniosek:
        'Nigdzie nie ma pełnej dobrowolności bez uniwersalnej siatki bezpieczeństwa. To najmocniejszy argument, że postulat trzeba albo odrzucić, albo uzupełnić o emeryturę obywatelską.',
      zrodlo: {
        tytul: 'Pensions at a Glance 2025: theoretical relative pensions of the self-employed',
        url: 'https://www.oecd.org/en/publications/2025/11/pensions-at-a-glance-2025_76510fe4/full-report/theoretical-relative-pensions-of-the-self-employed_f764691a.html',
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
      podstawa: 'INDICATOR 2019 (deklaratywny): 54 proc. za dobrowolnością. Składka „dużego ZUS” 2024 to ok. 1600 zł miesięcznie. Raport ZUS: realnie płaciłoby 27,5 proc.',
      kat: 'Rozumiem ból, nie sprzedaję pułapki. Przejąć problem, zaproponować rozwiązanie bez ubóstwa emerytalnego.',
      coDziala: [
        'Głośne przyznanie, że składka na starcie dławi mikrofirmy.',
        'Konkret: składka proporcjonalna do dochodu, dłuższy okres ulgowy, uproszczenie rozliczeń.',
        'Uczciwość: w Niemczech i Holandii, na które powołuje się Konfederacja, obowiązek jest rozszerzany, bo dobrowolność rodzi biedę na starość.',
      ],
      czegoUnikac: [
        'Obietnicy pełnej dobrowolności. To pułapka, która wraca do tej grupy jako ubóstwo emerytalne za 30 lat.',
        'Straszenia ZUS-em bez alternatywy. Trzeba dać rozwiązanie, nie tylko empatię.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze', 'Media dla przedsiębiorców', 'LinkedIn'],
      przyklad:
        'Wiem, że 1600 złotych składki na starcie dławi jednoosobową firmę. Ale dobrowolny ZUS to obietnica biedy na emeryturze. Niemcy i Holandia właśnie rozszerzają obowiązek, bo tam to już przerabiali. Zamiast tego: składka od realnego dochodu i dłuższy okres ulgowy.',
    },
  ],

  luki: [
    'Pełne metryczki badań INDICATOR 2019, IPC 2019 i IGTE 2023 do potwierdzenia w raportach pierwotnych.',
    'Źródło pierwotne badania OECD o ok. 5 proc. skłonności do dobrowolnego oszczędzania (cytowane przez ZUS) do ustalenia.',
    'Oficjalne, aktualne stanowiska Lewiatana i BCC wprost do projektu Konfederacji do dotarcia.',
    'Status legislacyjny projektu (skierowany do I czytania w komisjach) wymaga potwierdzenia na stronach Sejmu.',
  ],
};
