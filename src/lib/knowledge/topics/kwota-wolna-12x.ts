/**
 * Temat: kwota wolna = dwunastokrotność płacy minimalnej (program Konfederacji 2023).
 * Skupia się na MECHANIZMIE (indeksacja do płacy minimalnej) i wpadce legislacyjnej.
 * Materiał o koszcie i rozkładzie korzyści reformy 60 tys. jest w temacie
 * "kwota-wolna"; tu tylko to, co swoiste dla wersji Konfederacji.
 */

import type { Temat } from '../types';

export const kwotaWolna12x: Temat = {
  slug: 'kwota-wolna-12x',
  nazwa: 'Kwota wolna = 12× płaca minimalna',
  zajawka:
    'Wersja Konfederacji: kwota wolna zindeksowana do płacy minimalnej. Dobry mechanizm, kompromitujące wykonanie.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 28,
  doWeryfikacji: 3,

  rekomendacja: {
    pytanie: 'Jak ustawić się wobec pomysłu Konfederacji na kwotę wolną 12× płaca minimalna?',
    odpowiedz:
      'Przejąć sam mechanizm indeksacji, odciąć się od okrągłej kwoty i wypunktować wpadkę legislacyjną.',
    uzasadnienie: [
      'Powiązanie kwoty wolnej z płacą minimalną to jedyny element tej propozycji, który jest merytorycznie mocniejszy od licytacji na okrągłą liczbę: rozwiązuje problem zamrożenia kwoty wolnej na lata.',
      'Konfederacja sama podkopała swoją wiarygodność w tym temacie błędem w projekcie ustawy, więc przejęcie mechanizmu z lepszym wykonaniem jest łatwe do obronienia.',
      'To pole, na którym można rozmawiać z wolnościowym elektoratem Konfederacji jego językiem, nie oddając mu tematu.',
    ],
    ryzyko: [
      'Kwota wolna jest już zajęta przez wszystkich (Tusk, PiS, PSL). Wchodząc w nią, konkuruje się w tłoku. Patrz temat „Kwota wolna od podatku”.',
      'Mechanizm indeksacji jest trudny do wytłumaczenia w jednym zdaniu, a okrągłe „60 tysięcy” łatwo trafia do ludzi.',
    ],
    podchwycic: [
      'Indeksacja kwoty wolnej do płacy minimalnej: rośnie automatycznie co roku, bez potrzeby kolejnych ustaw. To odpowiedź na „cichą podwyżkę podatków” (fiscal drag).',
      'Ulga dla młodych do 26 lat rozszerzona na prowadzących działalność. Punktowe, tanie, dobrze brzmi przy elektoracie do 45 lat, który jest trzonem Konfederacji.',
    ],
    zaatakowac: [
      'Wpadka legislacyjna: w projekcie zapisano „kwotę zmniejszającą podatek” zamiast „kwoty wolnej”. Dosłowny zapis dawał kwotę wolną rzędu 500 tys. zł (Grant Thornton). Konfederacja składała autopoprawkę, Mentzen odcinał się od projektu.',
      'Regresywność: według CenEA 30 proc. najuboższych zyskuje mniej niż 100 zł, a realna korzyść płynie do lepiej zarabiających. To postulat sprzedawany jako prosocjalny, a działający odwrotnie.',
      'Brak rekompensaty dla samorządów w projekcie: ok. 18 mld zł ubytku wg samych wnioskodawców, bez wskazania, skąd to pokryć.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '500 tys. zł',
      opis: 'Tyle wyszłoby kwoty wolnej z dosłownego zapisu wadliwego projektu Konfederacji (wyliczenie Grant Thornton).',
      doPublikacji: true,
    },
    {
      wartosc: '35 mld zł',
      opis: 'Koszt wg samych wnioskodawców, w tym 18 mld zł ubytku dla samorządów, bez mechanizmu rekompensaty.',
      doPublikacji: true,
    },
    {
      wartosc: 'poniżej 100 zł',
      opis: 'Tyle zyskuje 30 proc. najuboższych podatników (CenEA). Realna korzyść idzie do lepiej zarabiających.',
      doPublikacji: true,
    },
    {
      wartosc: '238 : 196',
      opis: 'Głosowanie 20 III 2024: Sejm odrzucił wniosek Konfederacji o przyspieszenie prac. Za byli PiS i Konfederacja.',
      doPublikacji: true,
    },
    {
      wartosc: '11 z 27',
      opis: 'Tyle europejskich krajów OECD indeksuje kwotę wolną i progi automatycznie co roku. Polska tego nie robi.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Podniesienie kwoty wolnej jest popularne jako hasło, ale poparcie topnieje, gdy w pytaniu pojawia się cena. Szczegóły w temacie „Kwota wolna od podatku”.',
    'Sam pomysł indeksacji do płacy minimalnej nie był osobno badany sondażowo. Brak danych.',
    'Elektorat Konfederacji, do którego ten postulat jest adresowany, to w 52 proc. „aspirujący liberałowie” CBOS, wyróżniani poparciem dla niskich, prostych podatków.',
  ],

  badania: [
    {
      id: 'sw-2025-priorytet',
      instytut: 'SW Research',
      zleceniodawca: 'Onet',
      termin: '2-3 września 2025',
      proba: '830 ankiet, CAWI, panel SW Panel',
      pytanie:
        'Czy podniesienie kwoty wolnej od podatku powinno być priorytetem rządu, nawet kosztem zwiększenia deficytu budżetowego?',
      wyniki: [
        { etykieta: 'Tak', procent: 39.9, kluczowy: true },
        { etykieta: 'Nie', procent: 29.2 },
        { etykieta: 'Trudno powiedzieć', procent: 31 },
      ],
      jakCzytac:
        'Badanie z ceną w pytaniu. Poparcie dla podnoszenia kwoty wolnej topnieje z 79 proc. (pytanie bez kosztu) do 39,9 proc., gdy w pytaniu pojawia się deficyt. Pełna analiza w temacie „Kwota wolna od podatku”. Sam mechanizm indeksacji 12× nie był badany osobno.',
      zrodlo: {
        tytul: 'Co z kwotą wolną od podatku? Wiemy, co sądzą Polacy',
        url: 'https://polskieradio24.pl/artykul/3575612,co-z-kwota-wolna-od-podatku-wiemy-co-sadza-polacy',
        wydawca: 'Polskie Radio 24',
        data: '6 września 2025',
      },
    },
  ],

  zagranica: [
    {
      kraj: 'Niemcy',
      opis: 'Grundfreibetrag (kwota wolna) ma podstawę konstytucyjną: państwo nie może opodatkować minimum egzystencji. Jest podnoszony niemal co roku na podstawie rządowego raportu o minimum socjalnym: 11 784 EUR (2024), 12 096 EUR (2025), 12 348 EUR (2026).',
      wniosek:
        'Niemcy realizują dokładnie to, co proponuje mechanizm Konfederacji: automatyczną, coroczną waloryzację kwoty wolnej, żeby inflacja nie wciągała ludzi w opodatkowanie minimum. To dowód, że indeksacja jest standardem, nie ekstrawagancją.',
      zrodlo: {
        tytul: 'Grundfreibetrag 2026: 12 348 EUR',
        url: 'https://norman.finance/de/en/blog/basic-tax-free-allowance-germany',
        wydawca: 'Norman Finance',
        data: '2026',
      },
    },
    {
      kraj: 'Wielka Brytania (przestroga)',
      opis: 'Progi podatkowe zamrożone od 2022 r., pierwotnie do 2028, potem do 2030/31. Skutek: budżet zyska ok. 42,9 mld GBP do 2027/28 bez ani jednej ustawy podnoszącej stawki, a blisko 4 mln osób dodatkowo zacznie płacić PIT tylko przez zamrożenie.',
      wniosek:
        'To najlepiej policzony przykład „cichej podwyżki podatków” (fiscal drag). Polska kwota wolna zamrożona na 30 tys. zł od 2022 r. działa tak samo. Indeksacja 12× jest mechanizmem, który to zjawisko wyłącza.',
      zrodlo: {
        tytul: 'Fiscal drag: an explainer',
        url: 'https://commonslibrary.parliament.uk/research-briefings/cbp-9687/',
        wydawca: 'House of Commons Library',
        data: '2024',
      },
    },
    {
      kraj: 'OECD (indeksacja)',
      opis: 'Automatyczną coroczną indeksację kwoty wolnej i progów PIT stosuje 11 z 27 europejskich krajów OECD (m.in. Belgia, Dania, Francja, Holandia, Skandynawia, Słowacja). 14 krajów, w tym Polska, nie indeksuje regularnie.',
      wniosek:
        'Polska jest w grupie krajów, które pozwalają inflacji po cichu podnosić realne opodatkowanie. Powiązanie z płacą minimalną wprowadziłoby automatyzm, który u części sąsiadów jest normą.',
      zrodlo: {
        tytul: 'Income Tax Inflation Adjustments in Europe',
        url: 'https://taxfoundation.org/data/all/eu/income-tax-inflation-adjustments-europe/',
        wydawca: 'Tax Foundation',
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
      stanowisko: 'Autor mechanizmu, ale odciął się od wadliwego projektu klubu.',
      slabyPunkt:
        'Firmował program podatkowy, a od jego realizacji legislacyjnej się zdystansował, gdy wyszła wpadka.',
      wypowiedzi: [
        {
          id: 'mentzen-proste',
          cytat:
            'PiS łupi Polaków, a podatki powinny być niskie i proste. Niestety są wysokie i skomplikowane. Z każdym rokiem są skomplikowane coraz bardziej.',
          miejsce: 'Konwencja „Konstytucja Wolności”, Expo XXI, Warszawa',
          data: '24 czerwca 2023',
          poCo: 'Rdzeń przekazu Konfederacji o podatkach. Warto znać dosłowne brzmienie, bo to do tej ramy trzeba się odnieść, przejmując mechanizm.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Konwencja Konfederacji. „Chcemy prostych i niskich podatków”',
            url: 'https://www.rmf24.pl/fakty/polityka/news-konwencja-konfederacji-chcemy-prostych-i-niskich-podatkow,nId,6861486',
            wydawca: 'RMF24',
            data: '24 czerwca 2023',
          },
        },
      ],
    },
    {
      id: 'morawiecki',
      imieNazwisko: 'Mateusz Morawiecki',
      funkcja: 'poseł, były premier',
      ugrupowanie: 'Prawo i Sprawiedliwość',
      stanowisko: 'Broni własnej podwyżki kwoty wolnej do 30 tys., częściowo podpisuje się pod postulatem Konfederacji.',
      slabyPunkt: 'Przejął postulaty Konfederacji dopiero tracąc władzę, co Mentzen natychmiast wypomniał.',
      wypowiedzi: [
        {
          id: 'morawiecki-3091',
          cytat:
            'My zwiększyliśmy kwotę wolną od podatków, czyli wynagrodzenie bez żadnego podatku PIT, z kwoty 3091 złotych do 30 tysięcy złotych rocznie.',
          miejsce: 'Konferencja na Giełdzie Papierów Wartościowych, Warszawa',
          data: '17 listopada 2023',
          poCo: 'PiS licytuje się dorobkiem. Zestawić z tym, że mimo tej podwyżki tylko 22 proc. Polaków uznało, że zyskało na Polskim Ładzie (temat „Kwota wolna”).',
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
  ],

  segmenty: [
    {
      id: 'wolnosciowcy',
      nazwa: 'Wolnościowe skrzydło Konfederacji',
      opis: 'Trzon elektoratu Konfederacji, do którego ten postulat jest wprost adresowany.',
      podstawa:
        'CBOS 43/2025: 52 proc. elektoratu Konfederacji to „aspirujący liberałowie”, wyróżniani poparciem dla podatku liniowego i niskich podatków.',
      kat: 'Mechanizm zamiast okrągłej kwoty. Ta grupa docenia rozwiązanie systemowe bardziej niż hasło.',
      coDziala: [
        'Indeksacja do płacy minimalnej jako trwałe rozwiązanie problemu zamrożonej kwoty wolnej.',
        'Uczciwe przyznanie, że pomysł jest dobry, ale Konfederacja spartaczyła wykonanie.',
      ],
      czegoUnikac: [
        'Licytowania się na wyższą okrągłą kwotę. Ta grupa rozpozna to jako to samo, co robi każdy.',
        'Ramy „pomoc najuboższym”. Dla nich to nie jest argument, a dane CenEA i tak jej przeczą.',
      ],
      kanaly: ['X', 'YouTube i podcasty', 'Media dla przedsiębiorców'],
      przyklad:
        'Kwota wolna powinna rosnąć sama, razem z płacą minimalną, żeby inflacja jej nie zżerała. Ten pomysł Konfederacji jest dobry. Szkoda, że projekt napisali tak, że wychodziło pół miliona.',
    },
  ],

  luki: [
    'Brak osobnego sondażu o mechanizmie indeksacji kwoty wolnej do płacy minimalnej.',
    'Rozkład decylowy korzyści przypisany CenEA pochodzi z relacji OKO.press, nie z odczytanego raportu pierwotnego.',
    'Materiał o koszcie i odbiorze społecznym reformy 60 tys. celowo nie jest tu powielany; jest w temacie „Kwota wolna od podatku”.',
  ],
};
