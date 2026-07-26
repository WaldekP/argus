/**
 * Temat: składka zdrowotna przedsiębiorców jako pierwszy flagowy konkret
 * programu gospodarczego Petru. Dobrowolny ZUS tylko jako wątek poboczny
 * (etapowo, z pokazanym skutkiem dla emerytury). Pełny dobrowolny ZUS ma
 * osobny temat: dobrowolny-zus.
 *
 * Sprostowanie faktograficzne kluczowe dla tego tematu: ustawę obniżającą
 * składkę zdrowotną zawetował Andrzej Duda 6 maja 2025 r., nie Karol Nawrocki
 * (objął urząd 6 sierpnia 2025 r.).
 */

import type { Temat } from '../types';

export const skladkaZdrowotna: Temat = {
  slug: 'skladka-zdrowotna',
  nazwa: 'Składka zdrowotna przedsiębiorców',
  zajawka:
    'Jedyna pozycja z poparciem większościowym w każdym sformułowaniu pytania. Gotowa ustawa po wecie Andrzeja Dudy z 6 maja 2025 r. Naturalny pierwszy konkret programu gospodarczego.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/plan-wyborczy-petru/',
  liczbaZrodel: 13,
  doWeryfikacji: 4,

  rekomendacja: {
    pytanie:
      'Czy uczynić ze składki zdrowotnej przedsiębiorców pierwszy flagowy konkret programu gospodarczego?',
    odpowiedz:
      'Tak. To jedyna pozycja z poparciem większościowym w każdym sformułowaniu, umiarkowanym kosztem i gotową ścieżką legislacyjną. Dobrowolny ZUS tylko etapowo i zawsze z pokazanym skutkiem dla przyszłej emerytury.',
    uzasadnienie: [
      'To jedyna pozycja z całego zestawu programowego, która ma poparcie większościowe w każdym sformułowaniu pytania: 72,8 proc. za obniżką dla jednoosobowych działalności przy pytaniu o powinność rządu i 46,4 proc. za przy pytaniu wprost o poparcie. Nawet w najostrożniejszym brzmieniu zwolenników jest wyraźnie więcej niż przeciwników.',
      'Baza jest szersza niż sami przedsiębiorcy: 69,4 proc. Polaków nie wierzy, że podwyższenie składki poprawi ochronę zdrowia. Argument nie ogranicza się do interesu jednej grupy zawodowej.',
      'Istnieje gotowa ścieżka legislacyjna. Ustawa obniżająca składkę została przegłosowana w Sejmie w 2025 r. (213 do 190), a przepadła dopiero na wecie prezydenta Andrzeja Dudy 6 maja 2025 r. Postulat można wnieść ponownie, bez wymyślania go od zera.',
      'Czytelna historia niedowiezionej ulgi: wobec braku nowej ustawy od 2026 r. wróciły zasady sprzed ulgi, minimalna składka wzrosła z 314,96 zł do 432,54 zł miesięcznie. Przedsiębiorca realnie płaci więcej, mimo że reforma przeszła przez Sejm.',
      'Koszt jest umiarkowany. Przywrócenie i pogłębienie ulgi liczone jest w pojedynczych miliardach złotych rocznie, czyli o rząd wielkości mniej niż obietnice po stronie PIT. Dokładna wycena pozostaje do potwierdzenia.',
    ],
    ryzyko: [
      'Nie istnieje żaden przekrój elektoratowy dla pytań o składkę zdrowotną. Nie wiadomo, jak temat rozkłada się w grupach docelowych, więc cała segmentacja poniżej jest oceną strategiczną, nie pomiarem.',
      'Efekt sformułowania jest ekstremalny: 72,8 proc. wobec 46,4 proc. dla tej samej polityki. Podanie wyższej liczby bez pełnego brzmienia pytania naraża na zarzut manipulacji. Zawsze cytować z brzmieniem.',
      'Koszt reformy nie ma potwierdzonej wyceny. Liczba "pojedyncze miliardy złotych rocznie" krąży bez rzetelnego rachunku i jest oznaczona do weryfikacji.',
      'To danina zasilająca NFZ, więc łatwo o atak "zabierasz pieniądze służbie zdrowia". Kontra jest gotowa: 69,4 proc. nie wierzy w związek wyższej składki z jakością leczenia.',
      'Wątek dobrowolnego ZUS jest ryzykowny: brak wiarygodnych sondaży z lat 2024-2026, 0 z 25 ekonomistów w panelu za, ostrzeżenia o "dobrowolnym ubóstwie". Pełna dobrowolność bez rachunku powtórzyłaby błąd, na którym Konfederacja straciła wiarygodność.',
    ],
    podchwycic: [
      'Rama "składka to podatek od prowadzenia firmy, nie ubezpieczenie". Polski Ład zerwał związek składki z odliczeniem od podatku i uzależnił ją od dochodu, co było faktyczną podwyżką klina dla przedsiębiorców.',
      'Gotowa ustawa po wecie: nie trzeba obiecywać nowego pomysłu, wystarczy wnieść ponownie projekt, który już raz przeszedł przez Sejm, i dopiąć go.',
      'Liczba dla ogółu, nie tylko dla przedsiębiorców: skoro prawie 70 proc. nie wierzy, że wyższa składka leczy lepiej, obniżka nie jest przywilejem branżowym, tylko reakcją na powszechne odczucie.',
      'Dobrowolny ZUS tylko etapowo, wzorem projektowego harmonogramu (najpierw mikrofirmy, potem MŚP), albo z podstawą liczoną od płacy minimalnej, zawsze z jawnym rachunkiem skutku dla przyszłej emerytury.',
    ],
    zaatakowac: [
      'Rząd i prezydent razem nie dowieźli: rządowy projekt przeszedł przez Sejm, prezydent Andrzej Duda zawetował go 6 maja 2025 r., a przedsiębiorca i tak płaci w 2026 r. więcej niż przed reformą. Winę można rozłożyć, ale skutek jest jeden.',
      'Weto z 6 maja 2025 r. uderzyło w około 2 mln firm i cofnęło zasady do gorszego stanu sprzed ulgi. To gotowa historia o obietnicy, która utknęła między władzą wykonawczą a prezydentem.',
      'Konfederacja: dobrowolny ZUS bez wyceny i bez poparcia ekonomistów (0 z 25 w panelu) to hasło, które eksperci nazwali "dobrowolnym ubóstwem". Pokazać różnicę między odpowiedzialnym konkretem (składka zdrowotna z rachunkiem) a licytacją bez kosztorysu.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '72,8%',
      opis:
        'Za obniżeniem składki dla jednoosobowych działalności przy pytaniu o powinność rządu (IBRiS dla Rzeczpospolitej, XI 2024). Przeciw 12,1 proc.',
      doPublikacji: true,
    },
    {
      wartosc: '46,4%',
      opis:
        'Za obniżeniem składki przy pytaniu wprost o poparcie (SW Research dla rp.pl, IV 2025). Przeciw 29,4 proc. Ta sama polityka, inne brzmienie, wynik niższy o ponad 26 punktów.',
      doPublikacji: true,
    },
    {
      wartosc: '69,4%',
      opis:
        'Tylu Polaków nie wierzy, że podwyższenie składki poprawi ochronę zdrowia (SW Research dla rp.pl, VI-VII 2026). Baza szersza niż sami przedsiębiorcy.',
      doPublikacji: true,
    },
    {
      wartosc: '213 : 190',
      opis:
        'Głosowanie w Sejmie nad ustawą obniżającą składkę (2025), przy 25 wstrzymujących się, w tym 7 posłów PiS i 12 Konfederacji. Ustawę zawetował Andrzej Duda 6 maja 2025 r.',
      doPublikacji: true,
    },
    {
      wartosc: '314,96 -> 432,54 zł',
      opis:
        'Minimalna miesięczna składka zdrowotna przedsiębiorcy: wzrost po wecie, bo od 2026 r. wobec braku nowej ustawy wróciły zasady sprzed ulgi.',
      doPublikacji: true,
    },
    {
      wartosc: 'pojedyncze mld zł',
      opis:
        'Szacowany roczny koszt przywrócenia i pogłębienia ulgi, o rząd wielkości mniej niż obietnice po stronie PIT. Brak rzetelnej wyceny, liczba do weryfikacji.',
      doPublikacji: false,
    },
  ],

  syntezaOpinii: [
    'Poparcie dla obniżki jest realne, ale wynik rozstrzyga sformułowanie pytania. Pytanie o powinność rządu wobec jednoosobowych działalności daje 72,8 proc. za, pytanie wprost o poparcie 46,4 proc. Różnicy ponad 26 punktów nie wolno pomijać przy cytowaniu.',
    'To jedyna pozycja w całym zestawie programowym z poparciem większościowym niezależnie od tego, jak zada się pytanie. Zwolenników jest więcej niż przeciwników w każdym pomiarze.',
    'Nieufność wobec podwyższania składki wykracza poza przedsiębiorców: 69,4 proc. Polaków nie wierzy, że wyższa składka poprawi ochronę zdrowia, co daje argumentacji bazę ogólnospołeczną.',
    'Ścieżka legislacyjna jest gotowa: ustawa przegłosowana w 2025 r. głosami między innymi Konfederacji, a następnie przepadła na wecie prezydenta Andrzeja Dudy 6 maja 2025 r. Wobec braku nowej ustawy od 2026 r. wróciły wyższe zasady.',
    'Nie istnieje żaden przekrój elektoratowy dla składki zdrowotnej ani dla ZUS, dlatego rekomendacje segmentowe są oceną strategiczną opartą na danych ogólnopolskich i stanowiskach partii, nie na pomiarze grup docelowych.',
  ],

  badania: [
    {
      id: 'ibris-skladka-2024',
      instytut: 'IBRiS',
      zleceniodawca: 'Rzeczpospolita',
      termin: 'publikacja 27 listopada 2024',
      proba: 'N i metoda: brak danych w publikacji',
      pytanie:
        'Czy pana/pani zdaniem rząd powinien obniżyć składkę zdrowotną dla osób prowadzących jednoosobowe działalności gospodarcze?',
      wyniki: [
        { etykieta: 'Za obniżką (łącznie)', procent: 72.8, kluczowy: true },
        { etykieta: 'Przeciw (łącznie)', procent: 12.1 },
        { etykieta: 'Brak zdania', procent: 15.1 },
      ],
      jakCzytac:
        'Najwyższy odczyt dla tej polityki, bo pytanie dotyczy powinności rządu wobec konkretnej grupy, a nie kosztu dla budżetu. Rozbicie: zdecydowanie tak 31,5 proc., raczej tak 41,3 proc. Publikacja nie podaje próby ani metody, więc cytować z tym zastrzeżeniem.',
      zrodlo: {
        tytul: 'Sondaż: duże poparcie dla obniżki składki zdrowotnej dla przedsiębiorców',
        url: 'https://www.rp.pl/polityka/art41506491-sondaz-duze-poparcie-dla-obnizki-skladki-zdrowotnej-dla-przedsiebiorcow',
        wydawca: 'rp.pl',
        data: '27 listopada 2024',
      },
    },
    {
      id: 'swresearch-skladka-2025',
      instytut: 'SW Research',
      zleceniodawca: 'rp.pl (badanie redakcyjne)',
      termin: '23-24 kwietnia 2025',
      proba: '800 internautów, CAWI, dobór losowo-kwotowy z korektą wagową',
      pytanie: 'Czy popiera Pani/Pan obniżenie składki zdrowotnej dla przedsiębiorców?',
      wyniki: [
        { etykieta: 'Tak', procent: 46.4, kluczowy: true },
        { etykieta: 'Nie', procent: 29.4 },
        { etykieta: 'Brak zdania', procent: 24.2 },
      ],
      jakCzytac:
        'To samo zagadnienie co u IBRiS, ale pytanie wprost o poparcie zamiast o powinność rządu, i dlatego wynik jest niższy o ponad 26 punktów. Zwolenników nadal jest więcej niż przeciwników. Najsilniejsze poparcie w grupie 25-34 lata (53 proc.) i przy dochodzie powyżej 7000 zł netto (57 proc.).',
      zrodlo: {
        tytul: 'Sondaż. Składka zdrowotna dla przedsiębiorców w dół. Znamy zdanie Polaków',
        url: 'https://www.rp.pl/spoleczenstwo/art42204451-sondaz-skladka-zdrowotna-dla-przedsiebiorcow-w-dol-znamy-zdanie-polakow',
        wydawca: 'rp.pl',
        data: 'kwiecień 2025',
      },
    },
    {
      id: 'swresearch-ochrona-zdrowia-2026',
      instytut: 'SW Research',
      zleceniodawca: 'rp.pl (badanie redakcyjne)',
      termin: '30 czerwca - 1 lipca 2026',
      proba: '800 internautów, CAWI',
      pytanie:
        'Czy podwyższenie składki zdrowotnej poprawi sytuację ochrony zdrowia w Polsce?',
      wyniki: [
        { etykieta: 'Nie', procent: 69.4, kluczowy: true },
        { etykieta: 'Tak', procent: 13.7 },
        { etykieta: 'Brak zdania', procent: 16.9 },
      ],
      jakCzytac:
        'Badanie nie dotyczy wprost przedsiębiorców, tylko związku między wysokością składki a jakością leczenia. To najmocniejszy argument dla ogółu: skoro prawie 70 proc. nie wierzy w ten związek, obniżka nie jest przywilejem branżowym. Przekroje (najsilniejszy sprzeciw w grupie 35-49 lat i z wyższym wykształceniem) oznaczone do weryfikacji.',
      zrodlo: {
        tytul:
          'Sondaż: Polacy nie wierzą, że wyższa składka poprawi sytuację ochrony zdrowia w Polsce',
        url: 'https://www.rp.pl/spoleczenstwo/art44775231-sondaz-polacy-nie-wierza-ze-wyzsza-skladka-poprawi-sytuacje-ochrony-zdrowia-w-polsce',
        wydawca: 'rp.pl',
        data: 'lipiec 2026',
      },
    },
  ],

  politycy: [
    {
      id: 'duda',
      imieNazwisko: 'Andrzej Duda',
      funkcja: 'prezydent RP (do 6 sierpnia 2025 r.)',
      ugrupowanie: 'zaplecze PiS',
      stanowisko:
        'Zawetował 6 maja 2025 r. ustawę obniżającą składkę zdrowotną przedsiębiorców, mimo że przeszła przez Sejm.',
      slabyPunkt:
        'Weto zablokowało ulgę dla około 2 mln firm, a wobec braku nowej ustawy od 2026 r. wróciły zasady sprzed ulgi. Gotowa historia o obietnicy zatrzymanej na ostatnim kroku.',
      wypowiedzi: [],
    },
    {
      id: 'domanski',
      imieNazwisko: 'Andrzej Domański',
      funkcja: 'minister finansów',
      ugrupowanie: 'Koalicja Obywatelska',
      stanowisko:
        'Firmował rządowy projekt obniżki, który przeszedł przez Sejm, ale przepadł na wecie prezydenta i nie wszedł w życie.',
      slabyPunkt:
        'Mimo rządowego projektu i przegłosowania ulgi przedsiębiorcy płacą w 2026 r. wyższą składkę niż przed reformą. Efekt netto to niedowieziona ulga.',
      wypowiedzi: [],
    },
  ],

  segmenty: [
    {
      id: 'wolnosciowcy-konfederacji',
      nazwa: 'Wolnościowcy z Konfederacji',
      opis:
        'Elektorat, dla którego obniżka składki to rdzeniowy postulat. Przedsiębiorcy i samozatrudnieni stanowią w nim istotną część.',
      podstawa:
        'Brak przekroju elektoratowego dla składki zdrowotnej. To ocena strategiczna oparta na danych ogólnopolskich (72,8 proc. za obniżką dla jednoosobowych działalności) oraz na tym, że obniżka jest postulatem Konfederacji, a jej głosy przesądziły o przyjęciu ustawy w 2025 r. Nie jest to pomiar tego elektoratu.',
      kat:
        'Składka jako odpowiedzialny konkret z gotową ustawą, w odróżnieniu od pełnego dobrowolnego ZUS bez wyceny.',
      coDziala: [
        'Rama "podatek od prowadzenia firmy": Polski Ład zerwał związek składki z odliczeniem i uzależnił ją od dochodu.',
        'Gotowa ustawa po wecie: wystarczy wnieść ponownie projekt, który raz już przeszedł przez Sejm.',
        'Różnica "my liczymy, oni licytują": dobrowolny ZUS bez rachunku to hasło, obniżka składki to policzalny konkret.',
      ],
      czegoUnikac: [
        'Licytowania się na pełną dobrowolność ZUS bez wyceny, którą panel ekonomistów odrzucił w stosunku 0 do 25.',
        'Obiecywania bez kosztorysu, bo to powtórka błędu, na którym Konfederacja straciła wiarygodność.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze'],
      przyklad:
        'Obniżka składki zdrowotnej ma gotową ustawę, która przeszła przez Sejm i przepadła dopiero na wecie prezydenta. To konkret z kosztorysem, a nie hasło o dobrowolnym ZUS bez rachunku, który sami ekonomiści nazwali dobrowolnym ubóstwem.',
    },
    {
      id: 'sieroty-po-td',
      nazwa: 'Sieroty po Trzeciej Drodze',
      opis:
        'Wyborcy, którym Trzecia Droga obiecywała cofnięcie składki wprowadzonej Polskim Ładem i którzy tej zmiany się nie doczekali.',
      podstawa:
        'Brak przekroju elektoratowego dla składki zdrowotnej. To ocena strategiczna oparta na danych ogólnopolskich i na programowej obietnicy Trzeciej Drogi z 2023 r., a nie na pomiarze tego elektoratu.',
      kat:
        'Dowieziemy to, co obiecano i porzucono. Spokojne rozliczenie konkretem, bez pogardy wobec wyborców Trzeciej Drogi.',
      coDziala: [
        'Konkret z kwotą: minimalna składka wróciła z 314,96 zł do 432,54 zł miesięcznie, bo ulga nie weszła w życie.',
        'Rama "obiecali, my zrobimy": gotowa ustawa istnieje, brakuje tylko woli jej dopięcia.',
      ],
      czegoUnikac: [
        'Ataku personalnego na polityków Trzeciej Drogi bez oferty; to potencjalny elektorat, nie przeciwnik.',
        'Abstrakcyjnych kwot rocznych, które nie mówią przedsiębiorcy nic o jego rachunku.',
      ],
      kanaly: ['Facebook', 'Newsletter', 'Prasa lokalna'],
      przyklad:
        'Cofnięcie tej składki było obietnicą, którą złożono i porzucono. Ustawa jest gotowa, minimalna składka i tak wzrosła do 432 złotych miesięcznie. My zamierzamy ten konkret dowieźć, a nie o nim mówić.',
    },
    {
      id: 'rozczarowani-ko',
      nazwa: 'Rozczarowani Koalicją Obywatelską',
      opis:
        'Wyborcy KO, dla których rządowy projekt obniżki, który przeszedł przez Sejm i przepadł na wecie, jest dowodem, że obietnicy nie dowieziono.',
      podstawa:
        'Brak przekroju elektoratowego dla składki zdrowotnej. To ocena strategiczna oparta na faktach legislacyjnych (rządowy projekt przegłosowany, weto prezydenta, brak nowej ustawy) i na danych ogólnopolskich, a nie na pomiarze tego elektoratu.',
      kat:
        'Rozliczenie niedowiezionej ulgi rzeczowo i bez triumfalizmu. Przekaz o skuteczności, nie o pogardzie.',
      coDziala: [
        'Sekwencja faktów: rząd przygotował projekt, Sejm go przyjął, prezydent zawetował, a przedsiębiorca płaci więcej w 2026 r.',
        'Liczba dla ogółu: 69,4 proc. nie wierzy, że wyższa składka poprawia leczenie, więc obniżka to reakcja na powszechne odczucie.',
      ],
      czegoUnikac: [
        'Triumfalizmu i języka wyższości wobec wyborców KO, którzy są potencjalnym elektoratem.',
        'Zrzucania całej winy na jedną stronę, gdy odpowiedzialność jest rozłożona między rząd a prezydenta.',
      ],
      kanaly: ['Facebook', 'Newsletter'],
      przyklad:
        'Rząd przygotował obniżkę, Sejm ją przyjął, a mimo to płacicie w tym roku wyższą składkę, bo projekt utknął na wecie. Chodzi o skuteczność, nie o kolejną deklarację.',
    },
  ],

  luki: [
    'Brak jakiegokolwiek przekroju elektoratowego dla pytań o składkę zdrowotną i ZUS. Rekomendacje segmentowe w tym temacie są oceną strategiczną, nie pomiarem grup docelowych.',
    'Brak wiarygodnego sondażu o dobrowolnym ZUS z lat 2024-2026; debata toczy się na danych ZUS, nie na badaniach opinii. Liczby INDICATOR z obiegu (54 proc. za dobrowolnością, 67 proc. skorzystałoby) nie mają potwierdzonego źródła ani URL i nie nadają się do publikacji.',
    'Brak sondażu mierzącego reakcję opinii publicznej na weto z maja 2025 r.',
    'SW Research o hipotetycznej partii przedsiębiorców (poparcie do 40 proc.) jest do weryfikacji w całości: brak daty, próby, metody i brzmienia pytania. Nie publikować.',
    'Koszt reformy składki zdrowotnej nie ma potwierdzonej wyceny; w obiegu figuruje jako pojedyncze miliardy złotych rocznie, oznaczone do weryfikacji.',
    'Badanie IBRiS z XI 2024 (72,8 proc.) nie podaje próby ani metody. Cytować z tym zastrzeżeniem.',
    'Przekroje demograficzne badania SW Research z VI-VII 2026 oznaczone do weryfikacji.',
    'Brak niezależnej oceny "wakacji składkowych"; dostępne są tylko dane administracyjne ZUS o liczbie wniosków i kwocie zwolnień.',
  ],
};
