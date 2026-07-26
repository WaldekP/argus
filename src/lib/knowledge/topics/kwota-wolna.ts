/**
 * Korpus: kwota wolna od podatku.
 *
 * Treść pochodzi z docs/kwota-wolna/ (90 źródeł, każda liczba z przypisem),
 * połączona z briefem 16 (deep research z weryfikacją adwersaryjną, 44 źródła).
 * Wersja scalona i rozstrzygnięcia konfliktów: briefy/17-brief-kwota-wolna-polaczony.md.
 * Rekomendacja odpowiada na pytanie postawione wprost przez użytkownika
 * pilotażowego: podnieść własny temat czy poprzeć cudzy.
 */

import type { Temat } from '../types';

export const kwotaWolna: Temat = {
  slug: 'kwota-wolna',
  nazwa: 'Kwota wolna od podatku',
  zajawka: 'Obietnica 60 tys. zł, niezrealizowana od trzech lat. Temat wraca przed wyborami.',
  aktualizacja: '24 lipca 2026',
  korpus: 'docs/kwota-wolna/ + briefy/17-brief-kwota-wolna-polaczony.md',
  liczbaZrodel: 134,
  doWeryfikacji: 18,

  rekomendacja: {
    pytanie: 'Poprzeć podniesienie kwoty wolnej czy trzymać się składki zdrowotnej?',
    odpowiedz:
      'Trzymać składkę zdrowotną jako temat własny, kwotę wolną poprzeć warunkowo i rozliczyć z terminu, a jako propozycję własną postawić automatyczną waloryzację kwoty wolnej zamiast licytacji na 60 tys.',
    uzasadnienie: [
      'Asymetria kosztów wynosi około 10:1. Obniżka składki to około 4,6 mld zł rocznie, kwota wolna 60 tys. zł to 45-56 mld zł rocznie. Rząd sam przyznał, że na kwotę wolną nie ma przestrzeni fiskalnej.',
      'Składka to jedyna reforma z dowodem wykonalności: przeszła Sejm (4.04.2025, 213:190) i Senat, padła dopiero na wecie prezydenta Dudy. Po wecie składka minimalna wzrosła w 2026 r. o 37,3 proc., więc problem jest świeży i realny.',
      'W głosowaniu 4.04.2025 żaden poseł Konfederacji nie zagłosował za obniżką składki (12 wstrzymało się, 4 nieobecnych). Temat daje jednocześnie linię ataku na partię, która ze składki zrobiła sztandar.',
      'Kwota wolna jest zajęta. Obiecał ją Tusk, projekty składali Konfederacja, PiS i PSL. Linia rozliczeniowa jest gotowa bez przejmowania tematu: termin „pierwsze 100 dni” padł w Tarnowie 9 września 2023 i minął w marcu 2024.',
      'Poprzednia podwyżka pokazuje, że sama korzyść nie kupuje poparcia. Kwota wolna wzrosła prawie czterokrotnie, a tylko 22 proc. Polaków uznało, że zyskało.',
    ],
    ryzyko: [
      'Jeśli rząd faktycznie wprowadzi 60 tys. zł, poparcie warunkowe zostanie odczytane jako dołączenie do cudzego sukcesu. Presja koalicyjna rośnie: Kosiniak-Kamysz 22.07.2026 zadeklarował realizację jeszcze w tej kadencji.',
      'Składka zdrowotna ma węższego adresata: 2,45 mln przedsiębiorców JDG, nie ogół podatników PIT. Przy szerokim elektoracie kwota wolna dotyka więcej osób.',
      'Poparcie dla obniżki składki jest umiarkowane, nie przytłaczające: 46,4 proc. za (SW Research, kwiecień 2025). Wcześniej cytowany sondaż z wynikiem 72,8 proc. nie przeszedł weryfikacji i nie wolno go używać.',
      'Weto i deklaracja toruńska (zapowiedź wetowania każdej podwyżki podatków i składek) betonują status quo. Reforma składki może być niewykonalna do końca kadencji prezydenta.',
    ],
    podchwycic: [
      'Automatyczna waloryzacja kwoty wolnej zamiast skoku do 60 tys.: powiązanie z płacą minimalną i coroczna indeksacja, tańsze i policzalne, a rozwiązuje realny problem zamrożenia kwoty od 2022 r.',
      'Benchmark europejski jako amunicja: 11 z 27 krajów OECD w Europie indeksuje kwotę wolną i progi automatycznie co roku, Polska nie. Postulat jest do sprawdzenia, nie licytacyjny.',
      'Komunikacja wyłącznie w złotówkach miesięcznych i w konstrukcji „od jakich zarobków w ogóle nie powinno się płacić podatku”, nie w abstrakcyjnych kwotach rocznych, bo skok z 8 do 30 tys. w 2022 r. nie kupił wdzięczności.',
    ],
    zaatakowac: [
      'Rozliczenie terminu obietnicy: 60 tys. zł na „pierwsze 100 dni” padło w Tarnowie 9 września 2023 r., termin minął w marcu 2024 r., a rząd sam przyznał brak przestrzeni fiskalnej. Gotowa linia bez przejmowania tematu.',
      'Brak wyceny u Konfederacji: partia zrobiła z kwoty wolnej sztandar, ale jej pakiet z 2023 r. FOR wycenił na dziurę rzędu 189 mld zł, bez własnego rachunku.',
      'Skok do 60 tys. zł kosztuje 45-56 mld zł rocznie przy zerowej przestrzeni fiskalnej, więc licytacja nominalna to obietnica bez pokrycia. Waloryzacja jest odpowiedzią policzalną.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '300 zł',
      opis: 'Maksymalna miesięczna korzyść z podniesienia do 60 tys. zł. Pełna od ok. 7,5 tys. zł brutto. Przy wspólnym rozliczeniu małżonków 600 zł, przy płacy minimalnej ok. 168 zł.',
      doPublikacji: true,
    },
    {
      wartosc: '45-56 mld zł',
      opis: 'Roczny koszt kwoty wolnej 60 tys. zł. Widełki: CenEA 45 mld, szacunki MF do 56 mld. Podawać widełki, nie pojedynczą liczbę.',
      doPublikacji: true,
    },
    {
      wartosc: '10:1',
      opis: 'Asymetria kosztów: obniżka składki zdrowotnej (ok. 4,6 mld zł rocznie, 2,45 mln JDG) jest około dziesięciokrotnie tańsza od kwoty wolnej 60 tys. zł.',
      doPublikacji: true,
    },
    {
      wartosc: '+37,3 proc.',
      opis: 'Wzrost minimalnej składki zdrowotnej w 2026 r. po wecie: z 314,96 do 432,54 zł miesięcznie. Przedsiębiorcy płacą więcej niż rok temu.',
      doPublikacji: true,
    },
    {
      wartosc: '0 głosów za',
      opis: 'Konfederacja w głosowaniu 4.04.2025 nad obniżką składki zdrowotnej: nikt za, 12 wstrzymało się, 4 nieobecnych. Ustawa przeszła 213:190.',
      doPublikacji: true,
    },
    {
      wartosc: '189 mld zł',
      opis: 'Wycena FOR dziury w propozycjach wyborczych Konfederacji z 2023 r. Datować uczciwie na kampanię 2023, celować w brak własnej wyceny.',
      doPublikacji: true,
    },
    {
      wartosc: '5 tys. zł',
      opis: 'Do takiej emerytury świadczenie wyszłoby z PIT. Dziś granica przebiega przy ok. 2,5 tys. zł.',
      doPublikacji: true,
    },
    {
      wartosc: '5,5 mld zł',
      opis: 'Rzeczywisty spadek wpływów z PIT w 2022 r., gdy prognozowano 20-22 mld. Dołek trwał rok.',
      doPublikacji: true,
    },
    {
      wartosc: '22 proc.',
      opis: 'Tylu Polaków uznało, że zyskało na Polskim Ładzie, choć kwota wolna wzrosła wtedy prawie czterokrotnie.',
      doPublikacji: true,
    },
    {
      wartosc: '19,7 mln',
      opis: 'Deklarowana liczba beneficjentów. Liczba z jednego źródła, którego nie udało się otworzyć.',
      doPublikacji: false,
    },
  ],

  syntezaOpinii: [
    'Poparcie dla kwoty wolnej zależy od tego, czy w pytaniu pojawia się jej cena. Bez kosztu w pytaniu: 79 proc. za. Z kosztem: 39,9 proc. To ten sam postulat, inaczej zadany.',
    'Zwolenników nadal jest więcej niż przeciwników nawet przy pytaniu sformułowanym maksymalnie niekorzystnie, ale przewaga topnieje z 71 do 10 punktów procentowych.',
    'Około 30 proc. badanych nie ma zdania i ten odsetek powtarza się w każdym pomiarze. Temat jest abstrakcyjny, dopóki nie pokaże się kwoty w złotówkach.',
    'Polacy chcą jednocześnie niższych podatków dla siebie i wysokiego poziomu usług publicznych. 77 proc. popiera opiekuńcze funkcje państwa, 87 proc. uważa, że podatki są za wysokie wobec tego, co państwo daje.',
    'Poparcie dla progresji spadło z 77 proc. w 1998 r. do 51 proc. w 2025 r. Kwota wolna jest jednym z niewielu rozwiązań akceptowanych przez obie strony tego sporu, choć z różnych powodów.',
    'Poparcie dla obniżki składki zdrowotnej jest umiarkowane: 46,4 proc. za, 29,4 przeciw (SW Research, kwiecień 2025). Popularna liczba 72,8 proc. pochodzi z sondażu, który nie przeszedł weryfikacji, i nie wolno jej cytować.',
  ],

  badania: [
    {
      id: 'sw-2025',
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
        'Jedyne badanie z ceną w pytaniu. Mężczyźni popierają w 46,5 proc., kobiety w 34,1 proc. Pytanie dotyczy priorytetu rządu, nie kwoty 60 tys. zł, więc nie podpisuj tych 39,9 proc. pod konkretną kwotą.',
      zrodlo: {
        tytul: 'Co z kwotą wolną od podatku? Wiemy, co sądzą Polacy',
        url: 'https://polskieradio24.pl/artykul/3575612,co-z-kwota-wolna-od-podatku-wiemy-co-sadza-polacy',
        wydawca: 'Polskie Radio 24',
        data: '6 września 2025',
      },
    },
    {
      id: 'ibris-skladka-2024',
      instytut: 'IBRiS',
      zleceniodawca: 'Rzeczpospolita',
      termin: 'listopad 2024',
      proba: 'nie podano w publikacji',
      pytanie:
        'Czy rząd powinien obniżyć składkę zdrowotną dla osób prowadzących jednoosobową działalność gospodarczą?',
      wyniki: [
        { etykieta: 'Zdecydowanie tak', procent: 31.5 },
        { etykieta: 'Raczej tak', procent: 41.3 },
        { etykieta: 'Raczej nie', procent: 7.4 },
        { etykieta: 'Zdecydowanie nie', procent: 4.7 },
        { etykieta: 'Nie mam zdania', procent: 15.1 },
      ],
      jakCzytac:
        'SONDAŻ OBALONY. Nie przeszedł adwersaryjnej weryfikacji (2 z 3 głosów przeciw) w deep researchu z lipca 2026. Nie cytować publicznie w żadnej formie. Zweryfikowany pomiar poparcia dla obniżki składki to SW Research z kwietnia 2025: 46,4 proc. za.',
      zrodlo: {
        tytul: 'Sondaż: 72,8 proc. Polaków za obniżką składki zdrowotnej dla przedsiębiorców',
        url: 'https://www.rp.pl/polityka/art41506491-sondaz-duze-poparcie-dla-obnizki-skladki-zdrowotnej-dla-przedsiebiorcow',
        wydawca: 'Rzeczpospolita',
        data: '27 listopada 2024',
      },
    },
    {
      id: 'sw-skladka-2025',
      instytut: 'SW Research',
      zleceniodawca: 'Rzeczpospolita (rp.pl)',
      termin: '23-24 kwietnia 2025',
      proba: '800 ankiet, CAWI, panel',
      pytanie: 'Czy rząd powinien obniżyć składkę zdrowotną dla przedsiębiorców?',
      wyniki: [
        { etykieta: 'Tak', procent: 46.4, kluczowy: true },
        { etykieta: 'Nie', procent: 29.4 },
        { etykieta: 'Nie mam zdania', procent: 24.2 },
      ],
      jakCzytac:
        'Jedyny zweryfikowany pomiar poparcia dla obniżki składki (status 3-0, pewność średnia z uwagi na metodologię panelową). Poparcie umiarkowane, nie przytłaczające. Zastępuje obalony sondaż z wynikiem 72,8 proc. Link do pełnej publikacji do uzupełnienia, lista URL w materiałach deep researchu wskazanych w briefie 16.',
      zrodlo: {
        tytul: 'Sondaż SW Research dla rp.pl o obniżce składki zdrowotnej',
        url: 'https://www.rp.pl',
        wydawca: 'Rzeczpospolita',
        data: 'kwiecień 2025',
      },
    },
    {
      id: 'cbos-25-2022',
      instytut: 'CBOS',
      zleceniodawca: 'badanie statutowe, komunikat 25/2022',
      termin: '31 stycznia - 10 lutego 2022',
      proba: '1065 osób, mixed-mode (CAPI, CATI, CAWI), próba z rejestru PESEL',
      pytanie: 'Czy osobiście zyska Pan(i), czy też straci na zmianach podatkowych Polskiego Ładu?',
      wyniki: [
        { etykieta: 'Zyskam', procent: 22 },
        { etykieta: 'Stracę', procent: 28, kluczowy: true },
        { etykieta: 'Ani zyskam, ani stracę', procent: 20 },
        { etykieta: 'Trudno powiedzieć', procent: 30, kluczowy: true },
      ],
      jakCzytac:
        'Pomiar po największej podwyżce kwoty wolnej w historii polskiego PIT, z 8 do 30 tys. zł. Tylko co piąty uznał, że zyskał, 56 proc. oceniło zmiany negatywnie, a 68 proc. nie czuło się poinformowanych. Sama korzyść nie wystarcza.',
      zrodlo: {
        tytul: 'Komunikat z badań 25/2022: Polski Ład w praktyce, wstępne opinie i oceny',
        url: 'https://cbos.pl/SPISKOM.POL/2022/K_025_22.PDF',
        wydawca: 'CBOS',
        data: 'luty 2022',
      },
    },
    {
      id: 'pollster-2021',
      instytut: 'Instytut Badań Pollster',
      zleceniodawca: 'Super Express',
      termin: '15-16 marca 2021',
      proba: '1036 osób, CAWI',
      pytanie: 'Czy popiera Pan(i) podniesienie kwoty wolnej od podatku do 30 tys. zł?',
      wyniki: [
        { etykieta: 'Bardzo dobry pomysł', procent: 49, kluczowy: true },
        { etykieta: 'Raczej dobry pomysł', procent: 30, kluczowy: true },
        { etykieta: 'Raczej zły', procent: 5 },
        { etykieta: 'Bardzo zły', procent: 3 },
        { etykieta: 'Nie wiem', procent: 13 },
      ],
      jakCzytac:
        'Ten sam postulat bez kosztu w pytaniu daje 79 proc. poparcia. Zestawienie z badaniem SW Research to najmocniejsza informacja komunikacyjna w korpusie. Badanie dotyczy kwoty 30 tys. zł i roku 2021, nie nadaje się pod tezę o poparciu dla 60 tys.',
      zrodlo: {
        tytul: 'Polacy za podniesieniem kwoty wolnej od podatku',
        url: 'https://www.gazetaprawna.pl/podatki/artykuly/10770269,kwota-wolna-od-podatku-badanie-sondaz.html',
        wydawca: 'Gazeta Prawna',
        data: '18 marca 2021',
      },
    },
  ],

  politycy: [
    {
      id: 'tusk',
      imieNazwisko: 'Donald Tusk',
      funkcja: 'premier',
      ugrupowanie: 'Koalicja Obywatelska',
      stanowisko:
        'Obietnica podtrzymana formalnie, odkładana od trzech lat. Uzasadnienia zmieniały się cztery razy. Ministrowie finansów przyznają brak przestrzeni fiskalnej, realizacja mało prawdopodobna nawet od 2027 r.',
      slabyPunkt:
        'Termin „pierwsze 100 dni” padł publicznie z konkretną kwotą i adresatem. Minął w marcu 2024 r. Presję podbija koalicjant: Kosiniak-Kamysz 22.07.2026 deklaruje realizację jeszcze w tej kadencji i czeka na ofertę ministra finansów.',
      wypowiedzi: [
        {
          id: 'tusk-tarnow',
          cytat:
            'Mówimy tu o kwocie wolnej do podatku podniesionej do 60 tys. zł. Ten konkret, który przeprowadzimy w ciągu pierwszych 100 dni oznacza, że w Polsce każda emerytka, każdy emeryt, który ma emeryturę do 5 tys. zł nie będzie już płacił podatku dochodowego.',
          miejsce: 'Konwencja „100 konkretów na 100 dni”, Tarnów',
          data: '9 września 2023',
          poCo: 'Najmocniejszy cytat w całym temacie. Zawiera kwotę, termin i adresata, więc da się go rozliczyć co do joty.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Tusk: Podniesiemy kwotę wolną od podatku do 60 tys. zł',
            url: 'https://www.gazetaprawna.pl/wiadomosci/kraj/artykuly/9293753,tusk-podniesiemy-kwote-wolna-od-podatku-do-60-tys-zl.html',
            wydawca: 'Gazeta Prawna',
            data: '9 września 2023',
          },
        },
        {
          id: 'tusk-maj-2025',
          cytat:
            'To jest moja twarda obietnica, że do końca tej kadencji, nie powiem, czy w przyszłym roku, bo to będzie zależało od tego, jak wysoko trzyma się ten deficyt.',
          miejsce: 'TVN24',
          data: '23 maja 2025',
          poCo: 'Przesunięcie terminu z 100 dni na koniec kadencji, bez daty. Pokazuje wzorzec: obietnica bez zobowiązania.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Tusk obiecuje: Kwota wolna wzrośnie do 60 tys. zł, ale nie w tym roku',
            url: 'https://www.infor.pl/prawo/nowosci-prawne/6953557,tusk-obiecuje-kwota-wolna-wzrosnie-do-60-tys-zl-ale-nie-w-tym-roku.html',
            wydawca: 'Infor',
            data: '23 maja 2025',
          },
        },
        {
          id: 'tusk-lipiec-2025',
          cytat: 'Na pewno na rok 2026 tego nie będzie.',
          miejsce: '„Fakty po Faktach”, TVN24, rozmowa z Piotrem Kraśką',
          data: '30 lipca 2025',
          poCo: 'Najświeższa deklaracja. Zamyka rok 2026 i nie otwiera żadnego innego.',
          wiarygodnosc: 'wideo',
          zrodlo: {
            tytul: 'Kwota wolna od podatku 60 tysięcy złotych. Premier Donald Tusk o terminie',
            url: 'https://tvn24.pl/biznes/z-kraju/kwota-wolna-od-podatku-60-tysiecy-zlotych-premier-donald-tusk-o-terminie-st8579521',
            wydawca: 'TVN24 Biznes',
            data: '30 lipca 2025',
          },
        },
      ],
    },
    {
      id: 'morawiecki',
      imieNazwisko: 'Mateusz Morawiecki',
      funkcja: 'poseł, były premier',
      ugrupowanie: 'Prawo i Sprawiedliwość',
      stanowisko:
        'Autor podwyżki do 30 tys. zł w Polskim Ładzie. Dziś rozlicza KO z niezrealizowanej obietnicy 60 tys.',
      slabyPunkt:
        'Teza o „najwyższej kwocie wolnej w Europie” została obalona danymi własnego ministerstwa: Polska była 13. na 24 kraje.',
      wypowiedzi: [
        {
          id: 'morawiecki-rewolucja',
          cytat: 'To prawdziwa rewolucja podatkowa dla 18 mln Polaków.',
          miejsce: 'Prezentacja Polskiego Ładu',
          data: '2021',
          poCo: 'Pokazuje, że skala obietnicy była podobna do dzisiejszej. Zestawiony z CBOS 25/2022 (22 proc. „zyskam”) obrazuje przepaść między zapowiedzią a odbiorem.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Polski Ład. Kwota wolna od podatku do 30 tys. zł',
            url: 'https://biznes.wprost.pl/finanse-i-inwestycje/podatki/10447575/polski-lad-kwota-wolna-od-podatku-do-30-tys-zl.html',
            wydawca: 'Wprost Biznes',
            data: '2021',
          },
        },
        {
          id: 'morawiecki-najwyzsza',
          cytat: 'Wprowadziliśmy najwyższą kwotę wolną od podatku.',
          miejsce: 'Wywiad w TVP Info',
          data: '4 lipca 2022',
          poCo: 'Gotowy przykład na to, że kwota wolna stała się narzędziem marketingu, a nie polityki fiskalnej. Redakcja Konkret24 wykazała, że według prezentacji MF z 2021 r. Polska była 13. wśród 24 krajów europejskich. Wyżej były Cypr, Finlandia i Hiszpania.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Morawiecki: kwota wolna od podatku „najwyższa w Europie”. Eksperci tłumaczą trick marketingowy',
            url: 'https://konkret24.tvn24.pl/polityka/morawiecki-kwota-wolna-od-podatku-najwyzsza-w-europie-eksperci-tlumacza-trick-marketingowy-ra1111523-ls5791478',
            wydawca: 'Konkret24, TVN24',
            data: '13 lipca 2022',
          },
        },
      ],
    },
    {
      id: 'mentzen',
      imieNazwisko: 'Sławomir Mentzen',
      funkcja: 'poseł, lider Nowej Nadziei',
      ugrupowanie: 'Konfederacja',
      stanowisko:
        'Kwota wolna powiązana z płacą minimalną jako krok do uproszczenia i obniżenia podatków. W 2024 r. postuluje niższą stałą składkę zdrowotną zamiast wcześniejszej likwidacji.',
      slabyPunkt:
        'Odciął się od wadliwego projektu własnego klubu słowami, że go nie czytał. W głosowaniu 4.04.2025 nie poparł jedynej realnej obniżki składki zdrowotnej (Konfederacja: 0 za). Deklaracja toruńska podpisana na jego kanale betonuje system, na który narzeka.',
      wypowiedzi: [
        {
          id: 'mentzen-projekt',
          cytat:
            'Nawet go nie czytałem, nie podpisywałem, nie byłem na konferencji. Nie widziałem go na oczy.',
          miejsce: 'Kanał YouTube „MENTZEN GRILLUJE”',
          data: '16 listopada 2023',
          poCo: 'Cytat działa w obie strony. Podważa kontrolę nad klubem, ale też pokazuje, że sami politycy mylą kwotę wolną z kwotą zmniejszającą podatek.',
          wiarygodnosc: 'wideo',
          zrodlo: {
            tytul: 'Sławomir Mentzen o projekcie Konfederacji. PIT, podatki, kwota wolna',
            url: 'https://tvn24.pl/biznes/z-kraju/slawomir-mentzen-o-projekcie-konfederacji-pit-podatki-kwota-wolna-st7440902',
            wydawca: 'TVN24 Biznes',
            data: '16 listopada 2023',
          },
        },
        {
          id: 'mentzen-blad',
          cytat:
            'No nie wyszło to najlepiej. Miało być dobrze, a wyszło zabawnie. Ja nie miałem z tym projektem nic wspólnego.',
          miejsce: 'Kanał YouTube „MENTZEN GRILLUJE”',
          data: '16 listopada 2023',
          poCo: 'Przyznanie się do wpadki własnym głosem. Przydatne, gdy Konfederacja przedstawia się jako jedyna kompetentna w podatkach.',
          wiarygodnosc: 'wideo',
          zrodlo: {
            tytul: 'Konfederacja zaliczyła wpadkę. Mentzen odcina się od projektu',
            url: 'https://biznes.interia.pl/podatki/news-s-mentzen-odcina-sie-od-podwojnej-wpadki-konfederacji-nie-wi,nId,7153160',
            wydawca: 'Interia Biznes',
            data: '16 listopada 2023',
          },
        },
      ],
    },
    {
      id: 'bosak',
      imieNazwisko: 'Krzysztof Bosak',
      funkcja: 'wicemarszałek Sejmu',
      ugrupowanie: 'Konfederacja',
      stanowisko:
        'Projekty ustaw jako test dla koalicji, nie jako realna próba uchwalenia przepisów. Własna propozycja: bon zdrowotny z obowiązkowym zapisem i koszykiem gwarantowanym.',
      slabyPunkt:
        'Powiedział wprost, że celem jest korzyść polityczna niezależnie od wyniku. W głosowaniu 4.04.2025 nad obniżką składki wstrzymał się razem z klubem.',
      wypowiedzi: [
        {
          id: 'bosak-zyskamy',
          cytat: 'Cokolwiek się nie stanie Konfederacja na tym zyska.',
          miejsce: 'RMF FM',
          data: '14 listopada 2023',
          poCo: 'Najmocniejszy argument przeciw szczerości intencji wnioskodawców. Rozbraja zarzut, że to koalicja blokuje dobry projekt.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Konfederacja złożyła projekty z obietnicami opozycji. Krzysztof Bosak: Cokolwiek się nie stanie, zyskamy',
            url: 'https://www.rp.pl/polityka/art39399211-konfederacja-zlozyla-projekty-z-obietnicami-opozycji-krzysztof-bosak-cokolwiek-sie-nie-stanie-zyskamy',
            wydawca: 'Rzeczpospolita',
            data: '14 listopada 2023',
          },
        },
        {
          id: 'bosak-przelicytowanie',
          cytat:
            'Nasza propozycja to była dwunastokrotność pensji minimalnej, Platforma Obywatelska postanowiła nas przelicytować dając 60 tysięcy.',
          miejsce: 'RMF FM',
          data: '14 listopada 2023',
          poCo: 'Przyznanie, że 60 tys. zł to licytacja, a nie wynik rachunku. Wzmacnia argument o mechanizmie indeksacji zamiast okrągłej kwoty.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Konfederacja złożyła projekty z obietnicami opozycji',
            url: 'https://www.rp.pl/polityka/art39399211-konfederacja-zlozyla-projekty-z-obietnicami-opozycji-krzysztof-bosak-cokolwiek-sie-nie-stanie-zyskamy',
            wydawca: 'Rzeczpospolita',
            data: '14 listopada 2023',
          },
        },
      ],
    },
    {
      id: 'holownia',
      imieNazwisko: 'Szymon Hołownia',
      funkcja: 'były lider Polski 2050',
      ugrupowanie: 'Polska 2050',
      stanowisko: 'Jedyny lider koalicji, który publicznie sprzeciwił się kwocie 60 tys. zł.',
      slabyPunkt:
        'Jeden z trzech jego argumentów, ubytek dochodów samorządów, jest nieaktualny po reformie finansów JST z 2025 r.',
      wypowiedzi: [
        {
          id: 'holownia-sprzeciw',
          cytat:
            'Polska 2050, w obecnej sytuacji wysokiej inflacji, jest przeciwna zwiększeniu kwoty wolnej od podatku do 60 tysięcy złotych.',
          miejsce: 'Rozmowa z PAP',
          data: '18 maja 2023',
          poCo: 'Dowód, że sprzeciw wobec obietnicy istniał wewnątrz przyszłej koalicji jeszcze przed wyborami. Tłumaczy, dlaczego nie trafiła do umowy koalicyjnej.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Hołownia: Polska 2050 jest przeciwna zwiększeniu kwoty wolnej od podatku do 60 tys. zł',
            url: 'https://forsal.pl/gospodarka/polityka/artykuly/8718570,holownia-polska-2050-jest-przeciwna-zwiekszeniu-kwoty-wolnej-od-podatku-do-60-tys-zl.html',
            wydawca: 'Forsal',
            data: '18 maja 2023',
          },
        },
      ],
    },
  ],

  segmenty: [
    {
      id: 'sieroty-td',
      nazwa: 'Sieroty po Trzeciej Drodze',
      opis:
        'Wyborcy centrum, którzy w 2023 r. zagłosowali na Trzecią Drogę i nie mają dziś naturalnej reprezentacji.',
      podstawa:
        'CBOS 43/2025: elektorat Trzeciej Drogi to w 38 proc. prosocjalni centryści, poglądy najbliższe średniej krajowej. 55 proc. popiera progresję, 80 proc. opiekuńcze funkcje państwa.',
      kat: 'Kompetencja i wykonalność, nie licytacja. Ta grupa nie kupuje obietnic bez pokrycia, bo raz już się na nich zawiodła.',
      coDziala: [
        'Pokazanie rachunku: ile kosztuje, skąd pieniądze, w jakim terminie.',
        'Warianty pośrednie zamiast skoku: indeksacja kwoty wolnej albo dojście etapami.',
        'Odwołanie do konkretu z wypłaty, czyli 300 zł miesięcznie, a nie do haseł o rewolucji podatkowej.',
      ],
      czegoUnikac: [
        'Licytowania się na wyższą kwotę. Ta grupa czyta to jako ten sam mechanizm, który ją zawiódł.',
        'Ataku na państwo opiekuńcze. 80 proc. z nich popiera wysoki poziom usług publicznych.',
      ],
      kanaly: ['Prasa ogólnopolska', 'Wywiady radiowe', 'LinkedIn', 'Newsletter'],
      przyklad:
        'Obietnica 60 tysięcy padła z terminem stu dni. Minęły trzy lata. Nie licytuję się, mówię, jak to zrobić etapami i z czego sfinansować.',
    },
    {
      id: 'wolnosciowcy',
      nazwa: 'Wolnościowe skrzydło Konfederacji',
      opis:
        'Wyborcy nastawieni antypodatkowo, dla których kwota wolna to kwestia zasady, a nie wsparcia socjalnego.',
      podstawa:
        'CBOS 43/2025: jedyny elektorat z przewagą zwolenników podatku liniowego (50 proc. wobec 39 proc. za progresją). 52 proc. to „aspirujący liberałowie”. Poparcie dla państwa opiekuńczego najniższe, ale wciąż 68 proc.',
      kat: 'To moje pieniądze, nie ulga od państwa. Argument sprawiedliwościowy tu nie działa, działa argument o wolności i o tym, że państwo bierze za dużo.',
      coDziala: [
        'Mechanizm zamiast kwoty: indeksacja do płacy minimalnej rozwiązuje problem zamrożenia na stałe.',
        'Cicha podwyżka podatków przez bezczynność: odsetek niepłacących PIT spadł z 43 do 33 proc. w dwa lata.',
        'Składka zdrowotna jako temat wspólny: po wecie wzrosła w 2026 r. o 37,3 proc., a Konfederacja w głosowaniu 4.04.2025 nie dała ani jednego głosu za obniżką. Kosztuje 10 razy mniej niż kwota wolna.',
      ],
      czegoUnikac: [
        'Ramy „pomoc najuboższym”. Ta grupa słyszy w niej redystrybucję.',
        'Obiecywania okrągłej kwoty bez mechanizmu. Bosak sam nazwał 60 tys. przelicytowaniem.',
      ],
      kanaly: ['X', 'YouTube i podcasty', 'Kanał Zero', 'Media branżowe dla przedsiębiorców'],
      przyklad:
        'Kwota wolna zamrożona od 2022 roku to podwyżka podatków, której nikt nie ogłosił. Brytyjczycy mają na to nazwę: fiscal drag. Rozwiązaniem nie jest okrągła kwota, tylko indeksacja.',
    },
    {
      id: 'rozczarowani-ko',
      nazwa: 'Rozczarowani Koalicją Obywatelską',
      opis:
        'Wyborcy KO z 2023 r. zawiedzeni bilansem gospodarczym ostatnich trzech lat, wciąż niechętni prawicy.',
      podstawa:
        'CBOS 43/2025: elektorat KO jest w podatkach najbardziej podzielony, 48 proc. za progresją, 38 proc. za podatkiem liniowym. 77 proc. popiera opiekuńcze funkcje państwa.',
      kat: 'Rozliczenie z konkretu, bez satysfakcji z porażki rządu. Ta grupa nie chce słyszeć, że głosowała źle.',
      coDziala: [
        'Sam cytat z Tarnowa i data. Fakty rozliczają skuteczniej niż komentarz.',
        'Zestawienie ewolucji uzasadnień: cztery różne powody odkładania w trzy lata.',
        'Pokazanie, że obietnica nie trafiła do umowy koalicyjnej, bo Polska 2050 była przeciw już w maju 2023.',
      ],
      czegoUnikac: [
        'Tonu triumfalnego i słowa „oszustwo”. Ta grupa broni własnej decyzji sprzed trzech lat.',
        'Zestawiania kwoty wolnej z wydatkami na obronność. Argument o bezpieczeństwie tę grupę przekonuje.',
      ],
      kanaly: ['Facebook', 'Prasa lokalna', 'Radio', 'Newsletter'],
      przyklad:
        'Dziewiątego września 2023 roku w Tarnowie padł termin: pierwsze sto dni. Nie oceniam intencji. Podaję datę i pytam, kiedy.',
    },
  ],

  luki: [
    'Nie istnieje badanie stawiające kwotę wolną i składkę zdrowotną obok siebie w jednym pytaniu. Nie porównywać sondaży o różnej konstrukcji.',
    'Sondaż IBRiS 72,8 proc. za obniżką składki nie przeszedł adwersaryjnej weryfikacji. W korpusie zostaje wyłącznie jako ostrzeżenie, nie do cytowania.',
    'Wypowiedź Kosiniaka-Kamysza z 22.07.2026 i sondaż SW Research z kwietnia 2025 wymagają uzupełnienia pełnych przypisów URL. Listy źródeł w materiałach deep researchu wskazanych w briefie 16.',
    'Wątek Petru vs Mentzen (debaty i konfrontacje 2024-2026) nie ma ani jednego zweryfikowanego ustalenia. Zweryfikować przed cytowaniem.',
    'Trop Wprost o złamaniu deklaracji toruńskiej przez Nawrockiego jest niezweryfikowany. Nie używać bez sprawdzenia.',
    'Brak sondaży z 2026 r., w tym preferencji kwota wolna wobec składki zadanej wprost.',
    'Brak przekroju elektoratowego dla sondażu SW Research z września 2025. Publikacje podają tylko płeć i wiek.',
    'Playbooki komunikacyjne opierają się na danych CBOS o poglądach elektoratów, ale sam podział na trzy segmenty jest decyzją strategiczną, nie wynikiem badania.',
  ],
};
