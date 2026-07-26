/**
 * Temat: przyjęcie euro w programie polityka wolnościowo-liberalnego (Ryszard Petru).
 * Najbardziej dzielący temat całego planu wyborczego: jedyna kwestia, w której grupa
 * "rozczarowani KO" chce czegoś, co wolnościowcy Konfederacji odrzucają niemal jednomyślnie.
 * Rekomendacja z docs/plan-wyborczy-petru/rekomendacja-elektoraty.md, sekcja 1: euro poza
 * kadencją, warunek konwergencji, decyzja w referendum. Zamiast mapy drogowej.
 */

import type { Temat } from '../types';

export const euro: Temat = {
  slug: 'euro',
  nazwa: 'Przyjęcie euro',
  zajawka:
    'Najbardziej dzielący temat całego planu. Rozczarowani KO to jedyna grupa z poparciem dla euro, wolnościowcy Konfederacji są mu przeciwni niemal jednomyślnie. Rekomendacja: warunek konwergencji i referendum, bez mapy drogowej.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/plan-wyborczy-petru/',
  liczbaZrodel: 9,
  doWeryfikacji: 3,

  rekomendacja: {
    pytanie: 'Czy program deklaruje mapę drogową do euro, czy pomija temat?',
    odpowiedz:
      'Ani jedno, ani drugie: euro nie jest celem tej kadencji, warunkiem jest wcześniejsze zejście z deficytem poniżej 3 proc. PKB i spełnienie kryteriów konwergencji, a decyzję podejmują obywatele w referendum.',
    uzasadnienie: [
      'To najbardziej dzielący temat z całego zestawu ośmiu kwestii. Tylko jedna z trzech grup docelowych, rozczarowani KO, popiera euro, a dwie pozostałe są mu przeciwne. Mapa drogowa jako element programu straciłaby wolnościowców i sieroty po Trzeciej Drodze naraz.',
      'Wolnościowcy Konfederacji są w tej sprawie zabetonowani: w badaniu CBOS z maja 2024 r. przyjęcia euro w ciągu trzech lat chciało 0 proc. tego elektoratu. Żaden przekaz nie odwróci tak jednoznacznej postawy w jednej kadencji.',
      'Sprzeciw wobec euro można oddzielić od stosunku do Unii, bo 64 proc. wyborców Konfederacji WiN popiera członkostwo Polski w UE (CBOS 19/2026). Pozwala to zająć pozycję "nie oddajemy złotego, ale nie walczymy z Unią", bez zrywania z proeuropejskim rdzeniem oferty.',
      'Uzasadnienie merytoryczne jest przy tym prawdziwe: przy deficycie sektora finansów publicznych 7,3 proc. PKB w 2025 r. i długu zbliżającym się do 65 proc. PKB Polska nie spełnia kryteriów konwergencji, a kryterium fiskalne wymaga deficytu poniżej 3 proc. PKB. Rozmowa o wspólnej walucie jest dziś po prostu przedwczesna.',
      'Referendum rozbraja napięcie politycznie: decyzję o walucie oddaje obywatelom, nie rządowi. To pozwala nie ukrywać poglądów, nie tracić elektoratu wolnościowego i zachować spójność z proeuropejskim centrum.',
    ],
    ryzyko: [
      'Rozczarowani KO to jedyna grupa z realnym poparciem dla euro (KO 28 proc. za przyjęciem w ciągu trzech lat, koalicja rządząca ok. 66 proc. za w perspektywie dziesięciu lat). Dla nich postawienie twardego warunku może zabrzmieć jak unik, dlatego przekaz do tej grupy musi podkreślać, że drzwi nie są zamknięte.',
      'Flash Eurobarometr z 2026 r. pokazuje w Polsce 43 proc. za euro, znacznie więcej niż krajowe sondaże (26 do 28,5 proc.), bo pyta bez horyzontu czasowego. Przeciwnik może cytować tę liczbę na dowód, że poparcie jest wyższe. Trzeba znać różnicę wynikającą z konstrukcji pytania.',
      'Sieroty po Trzeciej Drodze są rozdarte: proeuropejskie co do członkostwa, ale elektoratowo bliżej sceptyków (tylko 7 proc. za euro w ciągu trzech lat). Zbyt proeuropejski i zbyt antyeuropejski ton odpycha różne części tej grupy.',
      'Dla części wolnościowców sprzeciw wobec euro jest tożsamościowy, a nie techniczny (złoty jako symbol suwerenności). Sprowadzenie tematu wyłącznie do warunku fiskalnego może w tej grupie zabrzmieć zbyt chłodno.',
    ],
    podchwycic: [
      'Rama warunku konwergencji: to nie jest "nigdy", to jest "najpierw uporządkujmy finanse". Wiarygodne dla wolnościowca, który umie liczyć, i akceptowalne dla proeuropejskiego centrum.',
      'Referendum jako mechanizm: o walucie decydują obywatele, nie rząd. Ta demokratyczna rama jest do przyjęcia dla wszystkich trzech grup docelowych, bo nie przesądza wyniku.',
      'Oddzielenie członkostwa w UE (popierane) od euro (odrzucane): "nie oddajemy złotego, ale nie walczymy z Unią". Baza w danych, bo 64 proc. wyborców Konfederacji WiN popiera członkostwo, a tylko 7 proc. chce wyjścia.',
    ],
    zaatakowac: [
      'Rząd Tuska deklaruje proeuropejskość, ale własną polityką fiskalną oddala Polskę od strefy euro: przy deficycie 7,3 proc. PKB i braku planu zejścia poniżej 3 proc. kryteria konwergencji są poza zasięgiem. Proeuropejskość bez zdrowych finansów to hasło bez pokrycia.',
      'Radykalny antyeuropeizm Konfederacji jest sprzeczny z postawami jej własnego elektoratu: straszenie wyjściem z Unii nie trafia do wyborców, z których 64 proc. popiera członkostwo, a tylko 7 proc. chce polexitu. Obrona złotego to jedno, wojna z Unią to drugie.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '49 proc.',
      opis: 'Tylu Polaków uważa, że Polska w ogóle nie powinna przyjmować euro (CBOS, maj 2024). Przyjęcia w ciągu trzech lat chce 13 proc.',
      doPublikacji: true,
    },
    {
      wartosc: '0 proc.',
      opis: 'Tyle wyborców Konfederacji chciało przyjęcia euro w ciągu trzech lat (CBOS, maj 2024). Najbardziej zabetonowana postawa ze wszystkich elektoratów.',
      doPublikacji: true,
    },
    {
      wartosc: '28,5 proc.',
      opis: 'Poparcie dla euro w perspektywie dziesięciu lat (IBRiS, grudzień 2025). Przeciw ponad 62 proc. Nawet w długim horyzoncie sprzeciw jest większościowy.',
      doPublikacji: true,
    },
    {
      wartosc: '64 proc.',
      opis: 'Tylu wyborców Konfederacji WiN popiera członkostwo Polski w UE (CBOS 19/2026), przy 7 proc. chcących wyjścia. Sprzeciw wobec euro nie oznacza sprzeciwu wobec Unii.',
      doPublikacji: true,
    },
    {
      wartosc: '7,3 proc. PKB',
      opis: 'Deficyt sektora finansów publicznych w 2025 r. Kryteria konwergencji wymagają poniżej 3 proc., więc rozmowa o euro jest dziś bezprzedmiotowa.',
      doPublikacji: true,
    },
    {
      wartosc: '43 proc.',
      opis: 'Poparcie dla euro w Polsce w Eurobarometrze 2026, gdzie pytanie nie ma horyzontu czasowego. W sondażach krajowych z konkretną perspektywą spada do 26 do 28,5 proc.',
      doPublikacji: true,
    },
    {
      wartosc: '93 proc.',
      opis: 'Sprzeciw wobec euro w elektoracie Konfederacji (IBRiS, grudzień 2025). Liczba z jednego źródła, [do weryfikacji], nie publikować bez potwierdzenia.',
      doPublikacji: false,
    },
  ],

  syntezaOpinii: [
    'Sprzeciw wobec euro jest stabilnie większościowy i nie słabnie: 49 proc. uważa, że Polska w ogóle nie powinna go przyjmować (CBOS, maj 2024), a w perspektywie dziesięciu lat za jest 28,5 proc. przy ponad 62 proc. przeciw (IBRiS, grudzień 2025).',
    'Podział jest przede wszystkim polityczny, nie demograficzny. Różnica między elektoratem koalicji a opozycji sięga blisko 58 punktów procentowych, podczas gdy różnica między wsią a dużym miastem to około 33 punkty.',
    'Sformułowanie pytania zmienia wynik bardziej niż cokolwiek innego. Eurobarometr bez horyzontu czasowego daje 43 proc. za, a sondaże krajowe pytające o konkretną perspektywę trzech lub dziesięciu lat schodzą do 26 do 28,5 proc.',
    'To najbardziej dzielący temat całego planu. Rozczarowani KO to jedyna grupa docelowa z poparciem dla euro, sieroty po Trzeciej Drodze są rozdarte, a wolnościowcy Konfederacji są mu przeciwni niemal jednomyślnie.',
    'Elektorat Konfederacji jest zarazem antyeuro i proeuropejski: 64 proc. popiera członkostwo w UE, a tylko 7 proc. chce wyjścia. Sprzeciw dotyczy waluty i kierunku integracji, nie samego członkostwa.',
  ],

  badania: [
    {
      id: 'cbos-euro-2024',
      instytut: 'CBOS',
      zleceniodawca: 'PAP',
      termin: 'maj 2024',
      proba: '1000 osób, CATI, próba ogólnopolska',
      pytanie: 'Kiedy Polska powinna przyjąć euro?',
      wyniki: [
        { etykieta: 'W ogóle nie powinna', procent: 49, kluczowy: true },
        { etykieta: 'W ciągu 10 lat', procent: 22 },
        { etykieta: 'W ciągu 3 lat', procent: 13 },
        { etykieta: 'Jeszcze później', procent: 10 },
        { etykieta: 'Trudno powiedzieć', procent: 6 },
      ],
      jakCzytac:
        'Rozbicie na elektoraty (odsetek chcących przyjęcia w ciągu trzech lat): KO 28 proc., Lewica 25 proc., Trzecia Droga 7 proc., PiS 1 proc., Konfederacja 0 proc. Pełnego przekroju wiekowego nie opublikowano, znana jest tylko grupa 55 do 64 lat, gdzie 54 proc. wskazało, że Polska w ogóle nie powinna przyjmować euro. Podział jest polityczny, nie pokoleniowy.',
      zrodlo: {
        tytul: 'Euro w Polsce. Sondaż CBOS: 49 proc. Polaków mówi stanowcze nie',
        url: 'https://www.money.pl/gospodarka/euro-w-polsce-sondaz-cbos-49-proc-polakow-mowi-stanowcze-nie-7031960301279936a.html',
        wydawca: 'money.pl (za CBOS)',
        data: 'maj 2024',
      },
    },
    {
      id: 'ibris-euro-2025',
      instytut: 'IBRiS',
      zleceniodawca: 'Rzeczpospolita',
      termin: 'grudzień 2025',
      proba: '1068 osób, CATI',
      pytanie: 'Czy Polska powinna w ciągu najbliższych 10 lat przyjąć euro zamiast złotego?',
      wyniki: [
        { etykieta: 'Przeciw', procent: 62, kluczowy: true },
        { etykieta: 'Za', procent: 28.5 },
        { etykieta: 'Brak zdania', procent: 9.5 },
      ],
      jakCzytac:
        'Rozbicie na elektoraty: wyborcy koalicji rządzącej około 66 proc. za, wyborcy opozycji 8 proc. za przy 87 proc. przeciw. Elektorat Konfederacji osobno 93 proc. przeciw [do weryfikacji], liczba z jednego źródła, nie publikować bez potwierdzenia. W dużych miastach powyżej 250 tys. mieszkańców za euro jest 48 proc., na wsi tylko 15 proc.',
      zrodlo: {
        tytul: 'Euro w Polsce w ciągu dziesięciu lat. Polacy są przeciwni',
        url: 'https://www.rp.pl/finanse/art43568131-euro-w-polsce-w-ciagu-dziesieciu-lat-polacy-sa-przeciwni',
        wydawca: 'Rzeczpospolita',
        data: 'grudzień 2025',
      },
    },
    {
      id: 'eurobarometr-euro-2026',
      instytut: 'Flash Eurobarometer (Komisja Europejska)',
      zleceniodawca: 'Komisja Europejska',
      termin: 'kwiecień i maj 2026',
      proba: 'badanie ogólnounijne, próby dla Polski nie podano w dostępnych relacjach',
      pytanie: 'Poparcie dla wprowadzenia euro w kraju respondenta, bez horyzontu czasowego',
      wyniki: [
        { etykieta: 'Za', procent: 43, kluczowy: true },
        { etykieta: 'Przeciw', procent: 36 },
      ],
      jakCzytac:
        'To najwyższa liczba poparcia dla euro w polskich pomiarach, bo pytanie nie zawiera horyzontu czasowego i mierzy poparcie dla idei, a nie dla konkretnej decyzji. Nie mieszać z sondażami krajowymi, które pytają o perspektywę trzech lub dziesięciu lat i dają 26 do 28,5 proc. Poparcie spadło o 3 punkty rok do roku.',
      zrodlo: {
        tytul: 'Strefa euro: rekordowe poparcie dla wspólnej waluty na Węgrzech, Polacy sceptyczni',
        url: 'https://tvn24.pl/biznes/ze-swiata/strefa-euro-rekordowe-poparcie-dla-wspolnej-waluty-na-wegrzech-polacy-sceptyczni-st9112399',
        wydawca: 'TVN24 Biznes (za Flash Eurobarometer)',
        data: '2026',
      },
    },
  ],

  politycy: [
    {
      id: 'tusk',
      imieNazwisko: 'Donald Tusk',
      funkcja: 'premier, przewodniczący Platformy Obywatelskiej',
      ugrupowanie: 'Koalicja Obywatelska',
      stanowisko:
        'Deklaratywnie proeuropejski, bez ogłoszonej mapy drogowej ani harmonogramu przyjęcia euro. Elektorat KO to jedyny z realnym poparciem dla wspólnej waluty.',
      slabyPunkt:
        'Mówi o proeuropejskości, a własną polityką fiskalną oddala Polskę od euro: przy deficycie 7,3 proc. PKB i długu rosnącym w stronę 65 proc. PKB kryteria konwergencji są poza zasięgiem, a planu zejścia poniżej 3 proc. nie ma.',
      wypowiedzi: [],
    },
    {
      id: 'mentzen',
      imieNazwisko: 'Sławomir Mentzen',
      funkcja: 'poseł, lider Nowej Nadziei',
      ugrupowanie: 'Konfederacja',
      stanowisko:
        'Twardy sprzeciw wobec euro, obrona złotego jako atrybutu suwerenności. Postawa spójna z elektoratem, w którym poparcie dla euro w ciągu trzech lat wynosiło 0 proc.',
      slabyPunkt:
        'Sprzeciw wobec euro łączy z antyunijną retoryką, choć 64 proc. jego elektoratu popiera członkostwo Polski w UE, a tylko 7 proc. chce wyjścia. Obrona złotego ma bazę, straszenie polexitem już nie.',
      wypowiedzi: [],
    },
  ],

  segmenty: [
    {
      id: 'wolnosciowcy-konfederacji',
      nazwa: 'Wolnościowcy z Konfederacji',
      opis: 'Świecko-wolnościowy rdzeń elektoratu Konfederacji WiN. Euro odrzuca niemal jednomyślnie, ale członkostwo w UE popiera. Cel wtórny i trudny, bariera jest tożsamościowa.',
      podstawa:
        'IBRiS, grudzień 2025: 93 proc. przeciw euro [do weryfikacji]. CBOS, maj 2024: 0 proc. za przyjęciem w ciągu trzech lat. CBOS 19/2026: 64 proc. za członkostwem w UE, 7 proc. za wyjściem.',
      kat: 'Nie oddajemy złotego, ale nie walczymy z Unią. Oddzielić walutę od członkostwa i pokazać, że sprzeciw wobec euro to nie polexit.',
      coDziala: [
        'Obrona złotego jako suwerennej waluty, temat tożsamościowy dla tej grupy.',
        'Rama "najpierw uporządkujmy finanse, potem rozmawiajmy", spójna z postawą wolnościowca liczącego koszty.',
        'Referendum jako gwarancja, że nikt nie wprowadzi euro tylnymi drzwiami.',
        'Podkreślenie, że 64 proc. z nich popiera UE, więc sprzeciw wobec euro nie jest wojną z Unią.',
      ],
      czegoUnikac: [
        'Mieszania sprzeciwu wobec euro z antyunijną retoryką i straszeniem polexitem, którego chce tylko 7 proc. tej grupy.',
        'Sprowadzania tematu wyłącznie do techniki fiskalnej, bo dla tej grupy złoty jest kwestią tożsamości, nie tylko rachunku.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze', 'YouTube'],
      przyklad:
        'Złotego nie oddajemy, to nasza waluta i nasza suwerenność. Ale obrona złotego to nie wojna z Unią, w której chce być większość z nas. Najpierw uporządkujmy finanse, a o walucie i tak zdecydują Polacy w referendum, nie rząd.',
    },
    {
      id: 'sieroty-po-td',
      nazwa: 'Sieroty po Trzeciej Drodze',
      opis: 'Dobrze wykształcony, wielkomiejski elektorat centrowy rozproszony po rozpadzie Trzeciej Drogi. Proeuropejski co do członkostwa, ale wobec euro elektoratowo bliżej sceptyków.',
      podstawa:
        'CBOS, maj 2024: Trzecia Droga tylko 7 proc. za przyjęciem euro w ciągu trzech lat, wyraźnie mniej niż KO i Lewica. Członkostwo w UE popierane bezwarunkowo.',
      kat: 'Proeuropejskość nie oznacza pośpiechu z euro. Warunek konwergencji jako stanowisko dojrzałe, nie ucieczka od tematu.',
      coDziala: [
        'Rama wiarygodności fiskalnej: euro wymaga zdrowych finansów, a przy deficycie ponad 7 proc. PKB rozmowa o nim jest przedwczesna.',
        'Kryteria konwergencji jako obiektywny, europejski punkt odniesienia, nie polityczny kaprys.',
        'Referendum jako demokratyczne domknięcie decyzji.',
      ],
      czegoUnikac: [
        'Antyeuropejskiej retoryki w stylu Konfederacji, którą ta grupa odrzuci tożsamościowo.',
        'Obietnicy szybkiego euro bez pokrycia w stanie finansów publicznych.',
      ],
      kanaly: ['Prasa', 'Newsletter', 'LinkedIn', 'Facebook'],
      przyklad:
        'Jesteśmy w Europie i chcemy w niej zostać. Ale euro to decyzja na dekady i wymaga zdrowych finansów. Przy deficycie ponad 7 proc. PKB rozmowa o wspólnej walucie jest przedwczesna. Najpierw kryteria, potem referendum.',
    },
    {
      id: 'rozczarowani-ko',
      nazwa: 'Rozczarowani Koalicją Obywatelską',
      opis: 'Jedyna z trzech grup docelowych z realnym poparciem dla euro. Zawiedzeni wykonaniem, nie kierunkiem. Proeuropejscy, wykształceni, zamożni.',
      podstawa:
        'CBOS, maj 2024: KO 28 proc. za przyjęciem euro w ciągu trzech lat. IBRiS, grudzień 2025: koalicja rządząca około 66 proc. za w perspektywie dziesięciu lat. CBOS 19/2026: KO 99 proc. za członkostwem w UE.',
      kat: 'Nie zamykamy drzwi, ale stawiamy warunek konwergencji. Nie unikamy tematu jak przeciwnicy, ale nie obiecujemy bez pokrycia.',
      coDziala: [
        'Komunikat "nie jesteśmy przeciw euro, jesteśmy za zdrowymi finansami, które je umożliwią".',
        'Kontrast z rządem, który deklaruje proeuropejskość, a deficytem 7,3 proc. PKB oddala Polskę od strefy euro.',
        'Referendum jako decyzja obywateli, nie unik ani zwłoka.',
      ],
      czegoUnikac: [
        'Brzmienia jak unik albo jak antyeuro, bo ta grupa to wychwyci najszybciej.',
        'Zimnego technicyzmu, który zabrzmi jak zawoalowane "nigdy".',
      ],
      kanaly: ['Prasa', 'LinkedIn', 'Facebook', 'Newsletter'],
      przyklad:
        'Euro nie jest wykluczone, jest odłożone do czasu, aż spełnimy kryteria. Dziś to rząd, mówiąc, że jest proeuropejski, deficytem 7,3 proc. PKB oddala nas od strefy euro. My proponujemy plan zejścia poniżej 3 proc., a decyzję oddajemy w referendum.',
    },
  ],

  luki: [
    'Brak pełnego przekroju wiekowego w badaniu CBOS z maja 2024 r. Opublikowano tylko grupę 55 do 64 lat (54 proc. za tym, że Polska w ogóle nie powinna przyjmować euro). Hipoteza o proeuropejskiej młodzieży nie ma w tych danych potwierdzenia ani zaprzeczenia.',
    'Liczba 93 proc. sprzeciwu wobec euro w elektoracie Konfederacji (IBRiS, grudzień 2025) pochodzi z jednego źródła i wymaga potwierdzenia u pracowni. Nie publikować bez sprawdzenia.',
    'Badania środowiskowe (poparcie szefów firm spadłe do 23 proc., panel Ariadna z 26 proc. poparcia) krążą w obiegu bez pełnej metodologii i brzmienia pytania. Nie cytować.',
    'Brak zweryfikowanych, dosłownych cytatów polityków o euro w korpusie. Stanowiska Donalda Tuska i Sławomira Mentzena opisano na podstawie danych o elektoratach i polityce fiskalnej, nie przytoczono wypowiedzi.',
    'Brak przekroju elektoratowego dla Eurobarometru 2026. Dane dla Polski podano ogólnie, bez rozbicia na partie.',
    'Brak w korpusie danych porównawczych z zagranicy o adopcji euro (Słowacja, Chorwacja, Bułgaria). Pole zagranica pominięto świadomie, by nie podawać liczb spoza źródeł.',
  ],
};
