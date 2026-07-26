/**
 * Temat: polityka klimatyczno-energetyczna w planie wyborczym Petru.
 * Napięcie osi: wyjście z ETS dzieli grupy docelowe niemal na pół, atom łączy je
 * ponad podziałami. Rekomendacja: budować rozdział wokół atomu i ceny energii,
 * wobec regulacji UE zająć pozycję walki o tanią ścieżkę w Europie.
 */

import type { Temat } from '../types';

export const klimatEnergia: Temat = {
  slug: 'klimat-energia',
  nazwa: 'Klimat i energia',
  zajawka:
    'Wyjście z ETS to lustrzany podział elektoratów, Konfederacja niemal jednomyślnie za, KO przeciw. Atom łączy ponad podziałami. Rekomendacja: oś na atomie i cenie energii, nie na kontestacji ETS.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/plan-wyborczy-petru/',
  liczbaZrodel: 5,
  doWeryfikacji: 3,

  rekomendacja: {
    pytanie:
      'Jak odróżnić się od Konfederacji przy podobnej krytyce kosztów regulacji klimatyczno-energetycznej?',
    odpowiedz:
      'Nie stawiać wyjścia z ETS w programie. Zbudować rozdział wokół atomu i ceny energii, a wobec regulacji UE zająć pozycję walki o tanią ścieżkę w Europie.',
    uzasadnienie: [
      'Wyjście z ETS to lustrzany podział, który dzieli grupy docelowe niemal dokładnie na pół. Konfederacja 89,6 proc. za, KO 60,1 proc. przeciw, Trzecia Droga rozdarta (43 proc. za, 53,4 proc. przeciw). Postawienie tego w programie zyskuje jedną grupę i traci drugą w niemal identycznej proporcji.',
      'Atom jest jedynym elementem polityki klimatyczno-energetycznej z poparciem ponad podziałami: 75 proc. w pomiarze CBOS, do 92 proc. w badaniu zamawianym przez resort. To naturalna oś całego rozdziału.',
      'Cena energii dla gospodarstw i firm łączy wszystkie trzy grupy, bo dotyczy rachunków niezależnie od sympatii partyjnej. To temat, na którym nikt z grup docelowych nie stoi po przeciwnej stronie.',
      'Pozycja walki o tanią ścieżkę w Europie, czyli renegocjacja tempa ETS2, koalicje państw na rzecz deregulacji i neutralność technologiczna, odróżnia od Konfederacji, która kontestuje członkostwo, i od KO, która biernie akceptuje koszty.',
    ],
    ryzyko: [
      'Konfederacja ma tu przewagę pierwszeństwa i prostoty przekazu. Nasze stanowisko, tak dla Europy i nie dla drogiej ścieżki, jest trudniejsze do zakomunikowania niż jednoznaczne hasło o wyjściu z ETS.',
      'Zielony Ład jest marką negatywną (52 proc. skojarzeń negatywnych, 14 proc. pozytywnych), więc obrona jakiejkolwiek unijnej polityki klimatycznej niesie ryzyko wizerunkowe. Bezpieczniejszy jest język ceny energii niż język transformacji.',
      'Postulat renegocjacji tempa ETS2 opiera się na sondażach o ETS jako całości. Nie ma pomiaru poparcia dla ETS2 (budynki i transport) odrębnie od ETS1, więc argument stoi na danych zawyżonych deklarowaną rozpoznawalnością systemu.',
      'Rozjazd pomiarów atomu (75 proc. wobec 91,9 proc.) jest zbyt duży, by tłumaczyć go czasem. Użycie liczby resortowej naraża na zarzut manipulacji, dlatego publicznie należy podawać liczbę CBOS albo formułę zdecydowana większość.',
    ],
    podchwycic: [
      'Krytyka kosztu ETS2 dla gospodarstw domowych i transportu jako realnego obciążenia rachunków, ale bez postulatu wyjścia z systemu.',
      'Koalicje państw na rzecz deregulacji prawa europejskiego (postulat obecny już w programie Kukiz 15 z 2015 r., z naturalnymi sojusznikami w rodzaju Wielkiej Brytanii, Szwecji i Holandii) jako narzędzie zmiany tempa, nie zerwania.',
      'Neutralność technologiczna i atom jako polska odpowiedź na dekarbonizację, zamiast narzuconej z góry ścieżki.',
      'Dokończenie jednolitego rynku, w tym rynku energii (nawiązanie do postulatu PO z 2011 r. o dokończeniu jednolitego rynku usług), jako droga do tańszej energii wewnątrz Europy.',
    ],
    zaatakowac: [
      'Konfederacja: wyjście z ETS bez planu na tanią energię to hasło, nie polityka. Kontestacja członkostwa w UE, której nie podziela nawet proeuropejski rdzeń jej własnego elektoratu.',
      'KO: bierna akceptacja kosztów ETS2 i przerzucenie ich na rachunki gospodarstw, bez walki o renegocjację tempa. Bycie w Europie nie zwalnia z obowiązku negocjowania warunków.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '89,6 proc.',
      opis: 'Elektorat Konfederacji za wyjściem Polski z ETS (IBRiS dla Polsat News, marzec 2026). Najwyższy wynik ze wszystkich elektoratów, niemal jednomyślność.',
      doPublikacji: true,
    },
    {
      wartosc: '60,1 proc.',
      opis: 'Elektorat KO przeciw wyjściu z ETS, przy 23 proc. za. Lustrzane odbicie Konfederacji, stąd temat dzieli grupy docelowe.',
      doPublikacji: true,
    },
    {
      wartosc: '43 / 53,4 proc.',
      opis: 'Trzecia Droga za wyjściem z ETS wobec przeciw. Grupa rozdarta niemal na pół, nie należy zmuszać jej do wyboru.',
      doPublikacji: true,
    },
    {
      wartosc: '57,7 proc.',
      opis: 'Ogół Polaków za wystąpieniem z ETS (IBRiS dla Polsat News, marzec 2026). Stanowisko większościowe, ale silnie spolaryzowane partyjnie.',
      doPublikacji: true,
    },
    {
      wartosc: '75 vs 92 proc.',
      opis: 'Poparcie dla atomu: 75 proc. w pomiarze CBOS, 91,9 proc. w badaniu zamawianym przez Ministerstwo Energii. Do wystąpień publicznych używać liczby CBOS.',
      doPublikacji: true,
    },
    {
      wartosc: '52 proc.',
      opis: 'Tylu badanych kojarzy Europejski Zielony Ład negatywnie (CBOS Flash 23/2024). Pozytywnie 14 proc. Centrum skojarzeń to rolnictwo i zakazy, nie klimat.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Sprzeciw wobec ETS jest dziś stanowiskiem większościowym (57,7 proc. za wyjściem), ale silnie spolaryzowanym partyjnie. Konfederacja jest niemal jednomyślna (89,6 proc.), KO to lustrzane odbicie (60,1 proc. przeciw wyjściu), Trzecia Droga rozdarta (43 proc. za, 53,4 proc. przeciw).',
    'Nietypowo dla tematu kosztowego poparcie dla ograniczenia ETS rośnie wraz z dochodem. W badaniu SW Research dla DGP zdecydowanie za było 35,8 proc. przy dochodzie powyżej 7 tys. zł wobec 22,3 proc. przy 3 do 4 tys. To sugeruje głos tożsamościowo-polityczny wobec UE, a nie odruch obronny najuboższych.',
    'Zielony Ład jest marką negatywną z przewagą blisko cztery do jednego (52 proc. skojarzeń negatywnych, 14 proc. pozytywnych). Jego centrum skojarzeniowym jest rolnictwo i zakazy, nie klimat, a wśród rolników 84 proc. skojarzeń jest negatywnych.',
    'Atom to jedyny element polityki klimatyczno-energetycznej z poparciem ponad podziałami: 75 proc. w pomiarze CBOS, 91,9 proc. w badaniu zamawianym przez resort.',
    'Rozjazd pomiarów atomu (75 wobec 92 proc.) jest zbyt duży, by tłumaczyć go upływem czasu, i wskazuje na wpływ konstrukcji pytania oraz zamawiającego. Do wystąpień bezpieczniejsza jest liczba CBOS-owska albo sformułowanie zdecydowana większość.',
  ],

  badania: [
    {
      id: 'ibris-ets-2026',
      instytut: 'IBRiS',
      zleceniodawca: 'Polsat News',
      termin: '19 do 22 marca 2026',
      proba: '1000 osób, CATI, próba ogólnopolska reprezentatywna',
      pytanie: 'Czy Polska powinna wystąpić z unijnego systemu handlu emisjami ETS?',
      wyniki: [
        { etykieta: 'Za wyjściem', procent: 57.7, kluczowy: true },
        { etykieta: 'Przeciw', procent: 31.6 },
        { etykieta: 'Nie wiem', procent: 10.8 },
      ],
      jakCzytac:
        'Pytanie właściwe zadano tylko osobom deklarującym znajomość systemu (słyszało 80,7 proc.). Kluczowy jest rozkład partyjny, a nie wynik ogółu: Konfederacja 89,6 proc. za, PiS 81,7 proc. za, Trzecia Droga 43 proc. za wobec 53,4 proc. przeciw, KO 23 proc. za wobec 60,1 proc. przeciw. Wynik dla Nowej Lewicy (37,7 proc. przeciw wyjściu, odsetek za nie podany) jest do weryfikacji.',
      zrodlo: {
        tytul: 'Czy Polska powinna wystąpić z ETS. Najnowszy sondaż dla Polsat News',
        url: 'https://www.polsatnews.pl/wiadomosc/2026-03-23/czy-polska-powinna-wystapic-z-ets-najnowszy-sondaz-dla-polsat-news/',
        wydawca: 'Polsat News',
        data: '23 marca 2026',
      },
    },
    {
      id: 'swresearch-ets-dgp',
      instytut: 'SW Research',
      zleceniodawca: 'Dziennik Gazeta Prawna',
      termin: 'data nieustalona',
      proba: 'N i metoda nieustalone (do weryfikacji)',
      pytanie:
        'Czy Polska powinna ograniczyć stosowanie systemu opłat EU ETS za emisję dwutlenku węgla, nawet za cenę ograniczenia dostępu do unijnych funduszy?',
      wyniki: [
        { etykieta: 'Za ograniczeniem', procent: 50, kluczowy: true },
        { etykieta: 'Przeciw', procent: 25 },
      ],
      jakCzytac:
        'Publikacja podaje ponad 50 proc. za i niespełna 25 proc. przeciw, wartości na wykresie są przybliżeniem. Metodologia (data, N, sposób realizacji) jest do weryfikacji, więc liczb nie wolno cytować publicznie bez potwierdzenia. Wartościowy jest przekrój dochodowy: zdecydowanie za było 35,8 proc. przy dochodzie powyżej 7 tys. zł wobec 22,3 proc. przy 3 do 4 tys. zł, czyli poparcie rośnie z dochodem.',
      zrodlo: {
        tytul: 'Polacy zapytani o ETS. Jedna grupa szczególnie się wyróżnia',
        url: 'https://wydarzenia.interia.pl/kraj/news-polacy-zapytani-o-ets-jedna-grupa-szczegolnie-sie-wyroznia,nId,23321051',
        wydawca: 'Interia (relacja z DGP)',
        data: '2026',
      },
    },
    {
      id: 'cbos-zielony-lad-2024',
      instytut: 'CBOS',
      zleceniodawca: 'badanie własne (Flash 23/2024)',
      termin: '13 do 17 maja 2024',
      proba: '1000 osób, CATI',
      pytanie: 'Jakie skojarzenia budzi Europejski Zielony Ład?',
      wyniki: [
        { etykieta: 'Negatywnie', procent: 52, kluczowy: true },
        { etykieta: 'Ani pozytywnie, ani negatywnie', procent: 29 },
        { etykieta: 'Pozytywnie', procent: 14 },
        { etykieta: 'Trudno powiedzieć', procent: 5 },
      ],
      jakCzytac:
        'Treść skojarzeń otwartych: rolnictwo 24 proc., ekologia 14 proc., ograniczenia i zakazy 12 proc., negatywne skutki finansowe 10 proc., protesty grup zawodowych 8 proc. Przekroje: rolnicy 84 proc. skojarzeń negatywnych, poglądy prawicowe 74 proc. negatywnie. Dane pochodzą ze szczytu protestów rolniczych wiosną 2024 r., więc bez nowszego pomiaru nie wiadomo, czy wydźwięk się utrwalił.',
      zrodlo: {
        tytul: 'Co Polacy sądzą o Zielonym Ładzie. Sondaż CBOS',
        url: 'https://www.pap.pl/aktualnosci/co-polacy-sadza-o-zielonym-ladzie-sondaz-cbos',
        wydawca: 'PAP (za CBOS)',
        data: 'maj 2024',
      },
    },
    {
      id: 'asm-atom-2025',
      instytut: 'ASM Research Solutions Strategy',
      zleceniodawca: 'Ministerstwo Energii (zamawiający zainteresowany wynikiem)',
      termin: '24 listopada do 8 grudnia 2025',
      proba: '2000 osób w wieku 15 do 75 lat, CATI',
      pytanie: 'Czy popiera Pan_i budowę elektrowni jądrowych w Polsce?',
      wyniki: [
        { etykieta: 'Poparcie', procent: 91.9, kluczowy: true },
        { etykieta: 'Sprzeciw', procent: 5.4 },
      ],
      jakCzytac:
        'Badanie zamawiane przez resort, który jest zainteresowany wysokim wynikiem, dlatego traktować je jako górną granicę, nie jako liczbę do wystąpień. Zgoda na lokalizację blisko miejsca zamieszkania 79,9 proc., przekonanie, że atom zwiększy bezpieczeństwo energetyczne 94 proc. Rozjazd z pomiarem CBOS (75 proc.) jest zbyt duży, by tłumaczyć go czasem. Publicznie używać liczby CBOS.',
      zrodlo: {
        tytul: 'Energetyka jądrowa z silnym mandatem społecznym. Ponad 90 proc. Polek i Polaków stawia na atom',
        url: 'https://www.gov.pl/web/energia/energetyka-jadrowa-z-niezwykle-silnym-mandatem-spolecznym-ponad-90-proc-polek-i-polakow-stawia-na-atom',
        wydawca: 'Ministerstwo Energii (gov.pl)',
        data: 'grudzień 2025',
      },
    },
    {
      id: 'cbos-atom',
      instytut: 'CBOS',
      zleceniodawca: 'badanie własne',
      termin: 'data nieustalona (do weryfikacji)',
      proba: 'N nieustalone (do weryfikacji)',
      pytanie: 'Czy popiera Pan_i budowę elektrowni atomowej w Polsce?',
      wyniki: [
        { etykieta: 'Poparcie', procent: 75, kluczowy: true },
        { etykieta: 'Przeciw', procent: 13 },
        { etykieta: 'Niezdecydowani', procent: 12 },
      ],
      jakCzytac:
        'To jest liczba do publicznego użycia, bo pochodzi z pomiaru niezależnego od resortu. Poparcie wzrosło z 39 proc. w maju 2021 r. Blisko jedna trzecia zwolenników byłaby jednak przeciw budowie w swoim sąsiedztwie. Dokładna data i próba nie zostały ustalone, dlatego przed publikacją potwierdzić w komunikacie CBOS.',
      zrodlo: {
        tytul: 'Poparcie społeczne dla elektrowni atomowej w Polsce. CBOS',
        url: 'https://www.gazetaprawna.pl/wiadomosci/kraj/artykuly/8602827,poparcie-spoleczne-elektrownia-atomowa-w-polsce-cbos.html',
        wydawca: 'Gazeta Prawna (za CBOS)',
        data: 'data nieustalona',
      },
    },
  ],

  politycy: [],

  segmenty: [
    {
      id: 'wolnosciowcy-konfederacji',
      nazwa: 'Wolnościowcy z Konfederacji',
      opis: 'Wyborcy Konfederacji ceniący wolność gospodarczą, dla których ETS jest symbolem drogiej, narzuconej z góry regulacji.',
      podstawa:
        'IBRiS dla Polsat News (marzec 2026): 89,6 proc. elektoratu Konfederacji za wyjściem Polski z ETS, najwyższy wynik ze wszystkich elektoratów, niemal jednomyślność.',
      kat: 'Nie licytować się z Konfederacją na wyjście z ETS. Przesunąć rozmowę na tanią ścieżkę w Europie i na atom.',
      coDziala: [
        'Krytyka kosztu ETS2 dla rachunków gospodarstw i transportu jako realnego obciążenia.',
        'Koalicje państw na rzecz deregulacji prawa europejskiego, postulat obecny już w programie Kukiz 15 z 2015 r.',
        'Atom i neutralność technologiczna jako konkret zamiast hasła.',
      ],
      czegoUnikac: [
        'Licytowania się na wyjście z ETS i kontestacji członkostwa w UE. To grunt Konfederacji, na którym nie wygramy, a który dzieli pozostałe dwie grupy docelowe.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze'],
      przyklad:
        'Wyjście z ETS to hasło, nie plan na tanią energię. My chcemy tego samego celu, niższych rachunków, ale realną drogą: renegocjacją tempa ETS2, koalicją państw na rzecz deregulacji i budową atomu.',
    },
    {
      id: 'sieroty-po-td',
      nazwa: 'Sieroty po Trzeciej Drodze',
      opis: 'Wyborcy dawnej Trzeciej Drogi, centrowi i proeuropejscy, wrażliwi na koszty życia i na sprawy wsi.',
      podstawa:
        'IBRiS dla Polsat News (marzec 2026): elektorat Trzeciej Drogi rozdarty, 43 proc. za wyjściem z ETS wobec 53,4 proc. przeciw.',
      kat: 'Nie zmuszać do wyboru za albo przeciw ETS. Mówić o cenie energii i o atomie, które tej grupy nie dzielą.',
      coDziala: [
        'Cena energii dla gospodarstw i firm jako temat ponad podziałem wobec ETS.',
        'Atom jako projekt ponadpartyjny, z poparciem 75 proc. w pomiarze CBOS.',
        'Dokończenie jednolitego rynku energii w UE, nawiązanie do postulatu PO z 2011 r., jako droga do tańszej energii.',
      ],
      czegoUnikac: [
        'Ostrego języka antyunijnego oraz obrony Zielonego Ładu wprost. Zielony Ład ma 52 proc. skojarzeń negatywnych, u rolników 84 proc.',
      ],
      kanaly: ['Facebook', 'Prasa lokalna', 'Newsletter'],
      przyklad:
        'Nie musimy wybierać między Europą a niższym rachunkiem za prąd. Atom i dokończenie wspólnego rynku energii dają jedno i drugie, bez zrywania z Unią.',
    },
    {
      id: 'rozczarowani-ko',
      nazwa: 'Rozczarowani Koalicją Obywatelską',
      opis: 'Wyborcy KO zniechęceni obecną polityką, ale przywiązani do członkostwa w UE i niechętni jej kontestacji.',
      podstawa:
        'IBRiS dla Polsat News (marzec 2026): elektorat KO przeciw wyjściu z ETS, 60,1 proc. przeciw wobec 23 proc. za.',
      kat: 'Nie kontestować UE. Pokazać, że można być w Europie i jednocześnie walczyć o tańszą ścieżkę, czego KO zaniechało.',
      coDziala: [
        'Pozycja aktywnej renegocjacji tempa ETS2 zamiast biernej akceptacji kosztów.',
        'Atom jako konkret, z poparciem ponad podziałami.',
        'Neutralność technologiczna jako alternatywa dla ścieżki narzuconej.',
      ],
      czegoUnikac: [
        'Sugerowania wyjścia z ETS lub z UE. Ta grupa jest temu wyraźnie przeciwna i odbierze to jako zbliżenie do Konfederacji.',
      ],
      kanaly: ['Facebook', 'X', 'Newsletter'],
      przyklad:
        'Zostajemy w Europie, ale nie zgadzamy się płacić najwyższej ceny za transformację. KO przyjmuje koszty ETS2 biernie, my chcemy renegocjować ich tempo.',
    },
  ],

  luki: [
    'Brak pomiaru poparcia dla ETS2 (budynki i transport) odrębnie od ETS1. Oba dostępne sondaże pytają o ETS jako całość, co przy deklarowanej rozpoznawalności systemu może zawyżać realną wiedzę o mechanizmie.',
    'Dane o Zielonym Ładzie (CBOS Flash 23/2024) pochodzą ze szczytu protestów rolniczych wiosną 2024 r. Bez nowszego pomiaru nie wiadomo, czy negatywny wydźwięk się utrwalił.',
    'Sekcja o cenach energii i ocenie polityki energetycznej jest w korpusie sondażowym pusta. Nie ma danych o poparciu dla konkretnych rozwiązań obniżających rachunki.',
    'Metodologia badania SW Research dla DGP (data, N, sposób realizacji) nie została ustalona. Liczby ponad 50 proc. za i niespełna 25 proc. przeciw nie nadają się do publikacji bez potwierdzenia.',
    'Rozjazd pomiarów atomu (75 proc. CBOS wobec 91,9 proc. w badaniu resortowym) nie jest wyjaśniony. Do wystąpień używać liczby CBOS albo formuły zdecydowana większość.',
    'Brak w korpusie sourcowanych, imiennych wypowiedzi polityków o ETS, atomie i Zielonym Ładzie. Stanowiska Konfederacji i KO opisane są zbiorczo, więc sekcja polityków pozostaje pusta.',
  ],
};
