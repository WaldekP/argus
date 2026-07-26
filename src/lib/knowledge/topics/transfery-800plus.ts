/**
 * Temat: stanowisko wobec 800 plus i transferów socjalnych w planie wyborczym Petru.
 * Oś sporu przesunięta z "ile państwa" na "dla kogo transfer": warunkowanie aktywnością
 * ma większość we wszystkich trzech grupach docelowych, likwidacja nie ma jej nigdzie.
 * Emerytury dodatkowe (13. i 14.) nietykalne. Źródło danych: docs/plan-wyborczy-petru/.
 */

import type { Temat } from '../types';

export const transfery800plus: Temat = {
  slug: 'transfery-800plus',
  nazwa: '800 plus i transfery socjalne',
  zajawka:
    'Warunek aktywności zamiast likwidacji: 44 proc. za utrzymaniem 800 plus pod warunkiem rejestracji, 13 proc. za odebraniem. Emerytury dodatkowe nietykalne.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/plan-wyborczy-petru/',
  liczbaZrodel: 9,
  doWeryfikacji: 4,

  rekomendacja: {
    pytanie: '800 plus nietykalne, warunkowane, czy do dyskusji?',
    odpowiedz:
      'Zostawić 800 plus w mocy, dodać warunek aktywności (praca, rejestracja w urzędzie pracy albo rozliczanie podatków w Polsce), bez kryterium dochodowego, i nie tykać 13. ani 14. emerytury.',
    uzasadnienie: [
      'Warunkowanie ma większość we wszystkich trzech grupach docelowych, a napięcia między nimi prawie nie ma: 44 proc. chce utrzymać 800 plus pod warunkiem rejestracji w urzędzie pracy, tylko 13 proc. chce je odebrać (Pollster, maj 2026).',
      'Kryterium dochodowe jest kosztowne administracyjnie i dzieli rodziny tuż nad progiem oraz elektorat KO. Warunek aktywności realizuje ten sam cel bez tej ceny.',
      'Emerytury dodatkowe są nietykalne: 65,3 proc. ogółu jest przeciw likwidacji 13. i 14. emerytury, a w rdzeniu grupy docelowej przyzwolenie na cięcie rent i emerytur wynosi 9 proc. (CBOS 80/2024). Oszczędność nie jest warta utraty wiarygodności na starcie.',
      'Oś sporu to transfer bez wzajemności, nie wielkość państwa: 58,9 proc. jest przeciw 800 plus dla obcokrajowców, a jednocześnie 58 proc. za świadczeniami dla Ukraińców pracujących i płacących podatki w Polsce (CBOS, wrzesień 2025). Język warunku i wzajemności ma większość, język likwidacji nie ma jej nigdzie.',
    ],
    ryzyko: [
      'Demografia elektoratu Konfederacji (84 proc. pracujących, około 75 proc. poniżej 45 lat) sprawia, że 800 plus dotyczy go realnie. Część odbierze warunkowanie jako uderzenie we własne świadczenie.',
      '32 proc. chce 800 plus bezwarunkowo (Pollster, maj 2026), więc warunek aktywności zraża znaczną mniejszość, także rodziny bez stałej pracy.',
      'Warunek aktywności i kryterium dochodowe łatwo pomylić w odbiorze. Bez precyzyjnego przekazu grozi etykieta "zabierają 800 plus".',
      'Brak sondażu wprost o powiązaniu 800 plus z rozliczaniem podatków w Polsce, więc ta część postulatu nie ma zmierzonego poparcia.',
    ],
    podchwycic: [
      'Rama warunku i wzajemności: świadczenie należy się rodzinie aktywnej, pracującej lub zarejestrowanej, i nie jest odbierane nikomu z automatu.',
      '"800 plus dla pracujących i płacących podatki" zamiast "800 plus dla obcokrajowców": 58,9 proc. jest przeciw transferowi bez wzajemności, ale 58 proc. za świadczeniem dla Ukraińców pracujących i płacących podatki.',
      'Twarda deklaracja nietykalności 13. i 14. emerytury zdejmuje najłatwiejszy zarzut o zabieranie emerytom.',
    ],
    zaatakowac: [
      'Konfederacja komunikuje program 800 plus jako porażkę i prowadzi kampanię "800 plus nie dla Ukraińców", ale jej własny elektorat w 68 proc. chce wysokiego poziomu świadczeń społecznych (CBOS 43/2025). To hasło cięcia bez pokrycia w postawach bazy.',
      'Kryterium dochodowe, postulat części opozycji z 2023 r., jest kosztowne administracyjnie i dzieli rodziny tuż nad progiem. Warunek aktywności jest prostszy i sprawiedliwszy.',
      'Bezwarunkowa likwidacja albo cięcie 800 plus nie ma większości w żadnym elektoracie. Kto ją proponuje, licytuje się o 13 proc. rynku.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '44 do 13 proc.',
      opis: 'Za utrzymaniem 800 plus pod warunkiem rejestracji w urzędzie pracy (44 proc.) wobec odebrania świadczenia (13 proc.) po utracie pracy przez rodzica. Pollster, maj 2026.',
      doPublikacji: true,
    },
    {
      wartosc: '65,3 proc.',
      opis: 'Przeciw likwidacji 13. i 14. emerytury; za likwidacją 18,7 proc. SW Research dla "Wprost", luty 2025.',
      doPublikacji: true,
    },
    {
      wartosc: '58,9 proc.',
      opis: 'Przeciw wypłacaniu 800 plus obcokrajowcom; za 33,2 proc. United Surveys dla WP, grudzień 2025.',
      doPublikacji: true,
    },
    {
      wartosc: '9 proc.',
      opis: 'Tyle elektoratu Konfederacji dopuszcza oszczędności na rentach i emeryturach. Emerytury są w tej grupie praktycznie nietykalne. CBOS 80/2024.',
      doPublikacji: true,
    },
    {
      wartosc: '38 proc.',
      opis: 'Elektorat Konfederacji wskazujący wsparcie rodziny, w tym 800 plus, jako obszar możliwych oszczędności. Drugi wynik po administracji publicznej. CBOS 80/2024.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Warunkowanie 800 plus ma większość, a bezwarunkowe cięcie nie ma jej nigdzie. W maju 2026 tylko 13 proc. chciało odebrać świadczenie rodzicowi po utracie pracy, przy 44 proc. gotowych utrzymać je za cenę rejestracji w urzędzie pracy (Pollster).',
    'Nietypowo dla planu wyborczego napięcia między grupami docelowymi prawie nie ma. Warunkowanie ma większość u wolnościowców z Konfederacji, u sierot po Trzeciej Drodze i u rozczarowanych Koalicją Obywatelską.',
    'Emerytury dodatkowe są nietykalne: 65,3 proc. ogółu jest przeciw likwidacji 13. i 14. emerytury, a w elektoracie Konfederacji przyzwolenie na cięcie rent i emerytur wynosi 9 proc.',
    'Spór o transfery jest sporem o granice wspólnoty, nie o wielkość państwa: 58,9 proc. jest przeciw 800 plus dla obcokrajowców, ale 58 proc. za świadczeniami dla Ukraińców pracujących i płacących podatki. Argument "to nasze pieniądze, a dostają je bez wzajemności" działa mocniej niż "państwo wydaje za dużo".',
    'Elektorat Konfederacji dopuszcza cięcie wsparcia rodziny (38 proc. wskazuje je jako obszar oszczędności, drugi po administracji), a broni emerytur, których w większości jeszcze nie pobiera.',
  ],

  badania: [
    {
      id: 'pollster-800plus-2026',
      instytut: 'Pollster',
      zleceniodawca: '"Super Express"',
      termin: '8-11 maja 2026',
      proba: '1005 osób, CAWI',
      pytanie: 'Co powinno się dziać z 800 plus po utracie pracy przez rodzica?',
      wyniki: [
        { etykieta: 'Utrzymać pod warunkiem rejestracji w urzędzie pracy', procent: 44, kluczowy: true },
        { etykieta: 'Utrzymać bezwarunkowo', procent: 32 },
        { etykieta: 'Odebrać', procent: 13 },
        { etykieta: 'Brak zdania', procent: 12 },
      ],
      jakCzytac:
        'Najmocniejszy dowód, że przestrzeń jest dla warunku, nie dla likwidacji: chętnych do odebrania świadczenia jest ponad trzy razy mniej niż gotowych je warunkować. Pomiar na ogóle, bez pełnych tabel elektoratowych.',
      zrodlo: {
        tytul: '800 plus a utrata pracy. Polacy wskazują warunek w sondażu',
        url: 'https://wiadomosci.wp.pl/800-plus-a-utrata-pracy-polacy-wskazuja-warunek-w-sondazu-7287112362551360a',
        wydawca: 'WP Wiadomości',
        data: 'maj 2026',
      },
    },
    {
      id: 'united-surveys-kryterium-2023',
      instytut: 'United Surveys',
      zleceniodawca: '"Dziennik Gazeta Prawna" i RMF FM',
      termin: 'publikacja 20 listopada 2023',
      proba: 'brak danych o próbie i metodzie',
      pytanie: 'Czy wprowadzić kryterium dochodowe przy wypłacie 800 plus?',
      wyniki: [
        { etykieta: 'Za kryterium dochodowym (ogół)', procent: 51.4, kluczowy: true },
        { etykieta: 'Wyborcy ówczesnej opozycji za', procent: 66 },
        { etykieta: 'Wyborcy PiS za', procent: 22 },
      ],
      jakCzytac:
        'Rozbicie elektoratowe pokazuje, że ówczesna opozycja (KO, Trzecia Droga, Lewica), z której wywodzą się dwie grupy docelowe, jest najmocniejszym zapleczem warunkowania, a PiS najsłabszym. Kryterium dochodowe to inny mechanizm niż rekomendowany warunek aktywności. Próba i metoda nieujawnione.',
      zrodlo: {
        tytul: 'Polacy wskazują nowemu rządowi, na czym powinien zaoszczędzić',
        url: 'https://www.money.pl/gospodarka/polacy-wskazuja-nowemu-rzadowi-na-czym-powinien-zaoszczedzic-6965075512453888a.html',
        wydawca: 'money.pl',
        data: 'listopad 2023',
      },
    },
    {
      id: 'sw-research-emerytury-2025',
      instytut: 'SW Research',
      zleceniodawca: '"Wprost"',
      termin: 'publikacja 22 lutego 2025',
      proba: 'brak danych o próbie i metodzie',
      pytanie: 'Opinia o likwidacji 13. i 14. emerytury',
      wyniki: [
        { etykieta: 'Przeciw likwidacji', procent: 65.3, kluczowy: true },
        { etykieta: 'Za likwidacją', procent: 18.7 },
        { etykieta: 'Bez zdania', procent: 16 },
      ],
      jakCzytac:
        'Granica, której program nie powinien przekraczać. Nietykalność emerytur dodatkowych jest konsensualna w całym społeczeństwie, a w rdzeniu grupy docelowej jeszcze mocniejsza (9 proc. przyzwolenia na cięcie rent i emerytur, CBOS 80/2024). Próba nieujawniona.',
      zrodlo: {
        tytul: 'Polacy o likwidacji 13. i 14. emerytury. Sondaż dla "Wprost"',
        url: 'https://biznes.wprost.pl/twoj-portfel/12255522/polacy-o-likwidacji-13-i-14-emerytury-sondaz-dla-wprost.html',
        wydawca: 'Wprost Biznes',
        data: 'luty 2025',
      },
    },
    {
      id: 'united-surveys-obcokrajowcy-2025',
      instytut: 'United Surveys',
      zleceniodawca: 'Wirtualna Polska',
      termin: '19-21 grudnia 2025',
      proba: '1000 osób, CATI i CAWI',
      pytanie: 'Czy wypłacać 800 plus obcokrajowcom?',
      wyniki: [
        { etykieta: 'Ogół przeciw', procent: 58.9, kluczowy: true },
        { etykieta: 'Ogół za', procent: 33.2 },
        { etykieta: 'Wyborcy PiS i Konfederacji łącznie przeciw [do weryfikacji]', procent: 73 },
        { etykieta: 'Wyborcy koalicji rządzącej za', procent: 57 },
        { etykieta: 'Wyborcy niezdecydowani przeciw', procent: 82 },
      ],
      jakCzytac:
        'Dowód, że oś sporu to "dla kogo", nie "ile". Sprzeciw jest najsilniejszy wśród niezdecydowanych (82 proc.), a koalicja rządząca jest po drugiej stronie (57 proc. za). Źródło nie rozdziela elektoratu Konfederacji od PiS, dlatego 73 proc. w tej połączonej grupie pozostaje [do weryfikacji].',
      zrodlo: {
        tytul: 'Sondaż. 800 plus dla obcokrajowców. Wyborcy niezdecydowani najbardziej radykalni',
        url: 'https://www.rp.pl/spoleczenstwo/art43563531-sondaz-800-dla-obcokrajowcow-wyborcy-niezdecydowani-najbardziej-radykalni',
        wydawca: 'rp.pl',
        data: 'grudzień 2025',
      },
    },
  ],

  politycy: [],

  segmenty: [
    {
      id: 'wolnosciowcy-konfederacji',
      nazwa: 'Wolnościowcy z Konfederacji',
      opis: 'Świecko-wolnościowa część elektoratu Konfederacji WiN, nastawiona gospodarczo, nieakceptująca konserwatyzmu światopoglądowego.',
      podstawa:
        'CBOS 80/2024: 38 proc. wskazuje wsparcie rodziny, w tym 800 plus, jako obszar oszczędności (drugi po administracji), a tylko 9 proc. dopuszcza cięcie rent i emerytur. United Surveys XII 2025: twarde nie dla 800 plus obcokrajowcom. Demografia (CBOS Flash 54/2025): 84 proc. pracujących, około 75 proc. poniżej 45 lat.',
      kat: 'Warunek i wzajemność, nie likwidacja. 800 plus dla pracujących i płacących podatki, emerytury nietykalne.',
      coDziala: [
        'Ta grupa godzi się na warunkowanie świadczenia, które sama pobiera (800 plus, 38 proc. przyzwolenia na cięcie), a broni tego, którego w większości nie pobiera (emerytury, 9 proc.) [do weryfikacji: to hipoteza z demografii, nie wynik badania]. Mów o warunku aktywności, nie o wielkości państwa.',
        'Twarde nie dla transferu bez wzajemności: 800 plus dla pracujących i płacących podatki, nie z automatu dla każdego.',
        'Nietykalność 13. i 14. emerytury podana wprost, żeby nie było mowy o zabieraniu emerytom.',
      ],
      czegoUnikac: [
        'Języka likwidacji i cięcia emerytur: przyzwolenie na cięcie rent i emerytur wynosi w tej grupie 9 proc.',
        'Hasła "mniej państwa": 68 proc. tego elektoratu chce wysokiego poziomu świadczeń społecznych (CBOS 43/2025).',
      ],
      kanaly: ['X', 'Podcasty gospodarcze', 'YouTube'],
      przyklad:
        'Osiemset plus należy się rodzinie, która pracuje, jest zarejestrowana albo rozlicza podatki w Polsce. Nie zabieramy go nikomu z automatu i nie ruszamy trzynastej ani czternastej emerytury. Chcemy, żeby publiczne pieniądze trafiały tam, gdzie jest wzajemność.',
    },
    {
      id: 'sieroty-po-td',
      nazwa: 'Sieroty po Trzeciej Drodze',
      opis: 'Byli wyborcy Trzeciej Drogi, dziś rozproszeni i luźno związani z partiami, wielkomiejscy i dobrze wykształceni.',
      podstawa:
        'Powiązanie 800 plus z aktywnością zawodową popiera 80 proc. elektoratu Hołowni [do weryfikacji: nie ustalono pracowni, daty ani próby]. Elektorat Trzeciej Drogi był najbardziej prooszczędnościowy w Polsce (86 proc. za ograniczaniem wydatków, CBOS 80/2024) i zarazem antypodatkowy (91 proc. przeciw podwyżkom).',
      kat: 'Odpowiedzialność i efektywność: świadczenie warunkowane aktywnością, publiczne pieniądze pod kontrolą.',
      coDziala: [
        'Warunkowanie aktywnością jako dowód, że transfer nie jest rozdawnictwem: to grupa, która najmocniej chce oszczędności bez podwyżek podatków.',
        'Konkret zamiast hasła: warunek aktywności opisany i policzony, nie ogólnik o cięciach.',
        'Nietykalność emerytur i brak kryterium dochodowego, żeby nie brzmieć jak zabieranie.',
      ],
      czegoUnikac: [
        'Języka likwidacji i cięcia emerytur: nietykalność 13. i 14. emerytury jest konsensualna, także w tej grupie.',
        'Sugestii, że warunkowanie to pierwszy krok do zniesienia świadczenia.',
      ],
      kanaly: ['Facebook', 'Newsletter', 'Prasa ogólnopolska'],
      przyklad:
        'Osiemset plus powinno wspierać rodziny, które pracują albo szukają pracy. To nie jest cięcie, to warunek, który sprawia, że publiczne pieniądze mają sens. Trzynastej i czternastej emerytury nie ruszamy.',
    },
    {
      id: 'rozczarowani-ko',
      nazwa: 'Rozczarowani Koalicją Obywatelską',
      opis: 'Wyborcy Koalicji Obywatelskiej zawiedzeni wykonaniem, nie kierunkiem: proeuropejscy, proreformatorscy, z rdzeniem wśród wykształconych i lepiej zarabiających.',
      podstawa:
        'United Surveys XI 2023: wyborcy ówczesnej opozycji (KO, Trzecia Droga, Lewica) w 66 proc. za kryterium dochodowym przy 800 plus, wyborcy PiS w 22 proc. To najmocniejsze zaplecze warunkowania. IBRiS X 2025: 42 proc. wyborców KO uważa, że rząd rządzi gorzej, niż oczekiwali.',
      kat: 'Racjonalne państwo: świadczenie dla aktywnych, pieniądze publiczne wydawane sensownie, konkret z kosztorysem zamiast obietnicy.',
      coDziala: [
        'Najsilniejsze poparcie dla warunkowania ze wszystkich trzech grup (66 proc. za kryterium w 2023 r.). Podkreślaj, że warunek aktywności jest prostszy i tańszy niż kryterium dochodowe.',
        'Rama efektywności, nie ideologii: to grupa zawiedziona sposobem rządzenia, nie kierunkiem.',
        '800 plus dla pracujących i płacących podatki jako przykład państwa, które nie marnuje.',
      ],
      czegoUnikac: [
        'Języka likwidacji i cięcia emerytur: ta grupa nie kupi zabierania świadczeń, kupi ich uporządkowanie.',
        'Prawicowego tonu wobec obcokrajowców: 57 proc. koalicji rządzącej jest za 800 plus dla obcokrajowców, więc kluczowa jest wzajemność (praca, podatki), nie wykluczenie.',
      ],
      kanaly: ['Facebook', 'Prasa ogólnopolska', 'Newsletter'],
      przyklad:
        'Warunek aktywności przy 800 plus jest prostszy i tańszy niż kryterium dochodowe, o które spierano się w 2023 roku. Świadczenie zostaje, ale wspiera rodziny, które pracują lub szukają pracy. To państwo, które nie marnuje, a nie państwo, które zabiera.',
    },
  ],

  luki: [
    'Brak sondażu wprost o powiązaniu 800 plus z rozliczaniem podatków w Polsce (postulat wobec obywateli Ukrainy) w wersji ogólnopolskiej z lat 2025-2026.',
    'Brak pełnych tabel elektoratowych dla sondażu Pollstera z maja 2026: warunkowanie zmierzono na ogóle, nie w rozbiciu na grupy docelowe.',
    'Poparcie warunkowania aktywnością w elektoratach prezydenckich 2025 (Hołownia 80 proc., Trzaskowski 79 proc., Mentzen 69 proc.) pozostaje [do weryfikacji]: nie ustalono pracowni, daty ani próby.',
    'Sondaż "Super Expressu" o 63 proc. poparcia dla kryterium dochodowego jest [do weryfikacji], bez ustalonej daty i pracowni. Nie używać do publikacji.',
    'United Surveys XII 2025 nie rozdziela elektoratu Konfederacji od PiS, więc 73 proc. sprzeciwu wobec 800 plus dla obcokrajowców w tej połączonej grupie pozostaje [do weryfikacji].',
    'Brak danych, jaki odsetek wyborców Konfederacji sam pobiera 800 plus albo 13. i 14. emeryturę. Teza o asymetrii pobierania i bronienia świadczeń to hipoteza demograficzna, nie wynik badania.',
    'Brak udokumentowanych osobistych cytatów polityków grup docelowych wprost o 800 plus. W źródłach jest organizacyjna kampania Konfederacji "800 plus nie dla Ukraińców", nie wypowiedź konkretnej osoby, dlatego lista polityków pozostaje pusta.',
  ],
};
