/**
 * Temat: wydatki obronne, finansowanie zbrojeń i wsparcie Ukrainy.
 * Stanowisko Petru: pozycja audytora efektywności zamiast licytacji na procentach PKB.
 * Kluczowy mechanizm: wysokie poparcie dla zwiększania wydatków (67-73 proc.) załamuje
 * się, gdy pytanie wskaże konkretny koszt, a samo nazwanie daniny decyduje o wyniku
 * (13 proc. jako "podatek wojenny", 32,4 proc. jako "tymczasowy podatek na modernizację").
 *
 * Źródła: docs/plan-wyborczy-petru/ (sondaze-tematyczne-2024-2026.md sekcja 6,
 * budzety-2022-2026.md sekcje 2 i 7, programy-2015/2019/2023.md, rekomendacja-elektoraty.md
 * sekcja 6). Liczby wyłącznie z korpusu, oznaczenia [do weryfikacji] zachowane.
 */

import type { Temat } from '../types';

export const obronnosc: Temat = {
  slug: 'obronnosc',
  nazwa: 'Wydatki obronne i wsparcie Ukrainy',
  zajawka:
    'Poparcie dla zwiększania wydatków (67-73 proc.) załamuje się przy koszcie: 50,6 proc. kosztem programów społecznych, 13 proc. za podatkiem wojennym. Rekomendacja: pozycja audytora, nie własny procent PKB.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/plan-wyborczy-petru/',
  liczbaZrodel: 16,
  doWeryfikacji: 5,

  rekomendacja: {
    pytanie:
      'Czy podawać własny cel procentowy PKB na obronność, czy zająć pozycję audytora efektywności wydatków?',
    odpowiedz:
      'Nie podawać własnego procentu. Zająć nieobsadzoną pozycję audytora: efektywność zakupów, konsolidacja Funduszu Wsparcia Sił Zbrojnych w budżecie, jawność kontraktów, wspólne zakupy europejskie, przemysł zbrojeniowy jako dźwignia technologiczna.',
    uzasadnienie: [
      'Dane rozstrzygają o pozycji. Poparcie dla samej obronności pozostaje wysokie (67 proc. w Opinia24 XII 2025, 72,9 proc. w IBRiS XI 2024), ale społeczeństwo nie chce płacić więcej. Jedyne pytanie, na które większość odpowie po naszej myśli, brzmi: czy dobrze wydajemy te około 200 mld zł.',
      'Licytacja na procentach PKB jest przegrana z góry. Wydatki już są na poziomie 4,7 proc. PKB (2025) i planowanych około 4,83 proc. (2026), wyższym niż w większości NATO. Podbijanie tej liczby nie daje przewagi, a naraża na pytanie o finansowanie przy deficycie 7,3 proc. PKB.',
      'Pozycja audytora jest wolna. Żaden z liczących się graczy nie obsadził pytania o efektywność 200 mld zł. To pole spójne z osobistą przewagą Petru (wiarygodność ekonomiczna) i z osią całego planu: państwo, które marnuje, kontra państwo, które się rozlicza.',
      'Mechanizm kosztu i nazwania daje amunicję obronną. Ta sama danina zbiera 13 proc. jako "podatek wojenny" i 32,4 proc. jako "tymczasowy podatek na modernizację armii". Skoro społeczeństwo odrzuca dodatkowe daniny, pytanie o efektywność już wydawanych pieniędzy jest jedynym wygrywającym.',
      'Wobec Ukrainy język wzajemności ma większość. 58 proc. Polaków chce, by świadczenia przysługiwały Ukraińcom pracującym i płacącym podatki w Polsce, a odrzuca transfer bezwarunkowy. To pozwala utrzymać wsparcie bez wchodzenia w narrację o zmęczeniu.',
    ],
    ryzyko: [
      'Zarzut "chcą ciąć armię" jest najgroźniejszy i łatwy do postawienia. Kontra: nie kwestionujemy poziomu wydatków, kwestionujemy sposób ich wydawania. Audyt zakupów to więcej sprawnej armii za te same pieniądze, nie mniej armii.',
      'Pozycja audytora jest trudniejsza komunikacyjnie niż prosta liczba. "5 proc. PKB" mieści się w jednym zdaniu, "efektywność zakupów i konsolidacja FWSZ" wymaga tłumaczenia. Ryzyko, że przekaz zabrzmi księgowo, a nie bezpiecznie.',
      'Elektorat Konfederacji przesunął się w stronę antyukraińską (postawy antyukraińskie z 42 proc. w 2023 do 71 proc. w 2025 wg CBOS). Język wzajemności łączy trzy grupy, ale u części wolnościowców może być odczytany jako zbyt miękki wobec Ukrainy.',
      'Większość pomiarów jest binarna (o zwiększaniu) i bez przekroju partyjnego, więc każda liczba wymaga podania brzmienia pytania. Publiczne cytowanie erozji poparcia bez tego kontekstu naraża na zarzut manipulacji.',
    ],
    podchwycic: [
      'Konsolidacja FWSZ w budżecie państwa. Postulat przejrzystości, nie cięć, więc tani politycznie: dziś 79,5 mld zł (plan 2026) idzie przez fundusz w BGK poza budżetem, drożej niż przez Skarb Państwa i poza kontrolą Sejmu.',
      'Jawność kontraktów zbrojeniowych, wzorem "białej księgi zakupów i awansów" z programu KO 2023. Naturalne rozszerzenie audytu efektywności.',
      'Wspólne zakupy europejskie: European Sky Shield (postulat KO 2023) i wspólne zamówienia w ramach PESCO (postulat PSL 2023). Tańsze jednostkowo, standaryzacja sprzętu, komponent europejski bez kontestacji NATO.',
      'Przemysł zbrojeniowy jako dźwignia technologiczna na wzór izraelski (postulat Nowoczesnej 2015): wojsko jako innowacyjny przemysł napędzający gospodarkę, plus offset i minimum udziału polskich zakładów (Trzecia Droga 2023 mówiła o 50 proc. modernizacji w kraju).',
    ],
    zaatakowac: [
      'FWSZ poza budżetem to najsłabszy punkt rządu. Rosnąca część zbrojeń (41,8 mld w 2024, 65,4 mld w 2025, 79,5 mld zł w planie 2026) idzie przez fundusz w BGK, który zadłuża się drożej niż Skarb Państwa i omija kontrolę parlamentu. Gotowy zarzut o wydatki bez nadzoru.',
      'Rozjazd planu z wykonaniem. W 2024 r. planowano 4,2 proc. PKB, wykonano poniżej 4 proc., głównie przez opóźnienia dostaw. Debata o "5 proc. PKB" dotyczy planu, nie faktycznego wydatkowania. Pytanie: ile z ogłoszonych miliardów faktycznie trafia do wojska.',
      'Brak audytu efektywności przy największej zmianie strukturalnej wydatków dekady (skok z 2,2 proc. PKB w 2022 do około 5 proc. w 2026). Obrona narodowa to już trzecia pozycja budżetu, a nikt nie pyta, czy 200 mld zł jest wydawane dobrze.',
      'Statystyka długu psuta przez pozabudżetowy FWSZ: rząd korzysta z tego, że konstytucyjny limit 60 proc. dotyczy państwowego długu publicznego (49,1 proc. na koniec 2025), podczas gdy dług w ujęciu unijnym sięga 60 proc. i wg MF przekroczy 65 proc. w 2026 r. Ujednolicenie definicji to test uczciwości fiskalnej.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '67-73 proc.',
      opis: 'Poparcie dla zwiększania wydatków obronnych, ale w trendzie erozji: 76,7 proc. (IV 2022), 72,9 proc. (IBRiS XI 2024), 67 proc. (Opinia24 XII 2025). Trzy pracownie, ten sam kierunek.',
      doPublikacji: true,
    },
    {
      wartosc: '13 vs 32,4 proc.',
      opis: 'Poparcie dla tej samej w istocie daniny zależnie od nazwy: 13 proc. jako "podatek wojenny" (IBRiS/Defence24), 32,4 proc. jako "tymczasowy podatek na modernizację armii" (IBRiS XII 2025). Nazwanie decyduje.',
      doPublikacji: true,
    },
    {
      wartosc: '50,6 proc.',
      opis: 'Poparcie dla większych wydatków na wojsko nawet kosztem programów społecznych i opieki medycznej (IBRiS IV 2025, N=1068). Poparcie deklaratywne załamuje się, gdy pojawia się konkretny koszt.',
      doPublikacji: true,
    },
    {
      wartosc: '4,7-4,83 proc. PKB',
      opis: 'Poziom wydatków obronnych: 4,7 proc. PKB w 2025 r. (186,6 mld zł, plan), około 4,83 proc. w 2026 r. (około 201 mld zł, plan). Powyżej celu NATO i większości sojuszników. Licytacja procentem nie daje przewagi.',
      doPublikacji: true,
    },
    {
      wartosc: '79,5 mld zł',
      opis: 'Plan wydatków przez Fundusz Wsparcia Sił Zbrojnych w BGK na 2026 r., poza budżetem państwa (41,8 mld w 2024, 65,4 mld w 2025). Fundusz zadłuża się drożej niż Skarb Państwa i omija kontrolę Sejmu.',
      doPublikacji: true,
    },
    {
      wartosc: '48 do 45 proc.',
      opis: 'Przyjmowanie uchodźców z Ukrainy: 48 proc. za, 45 proc. przeciw (CBOS IX 2025). Wg CBOS najniższe poparcie od aneksji Krymu. Liczby ze streszczeń, PDF komunikatu nie został sparsowany, przed publikacją otworzyć oryginał. [do weryfikacji]',
      doPublikacji: false,
    },
  ],

  syntezaOpinii: [
    'Poparcie dla samej obronności jest wysokie, ale powoli eroduje: 76,7 proc. za zwiększaniem wydatków w IV 2022, 72,9 proc. w XI 2024, 67 proc. pod koniec 2025 r. Różne pracownie i brzmienia, więc to nie czysty szereg czasowy, ale kierunek jest zgodny w trzech pomiarach.',
    'Poparcie deklaratywne załamuje się natychmiast, gdy pytanie wskaże konkretny koszt: 50,6 proc. przy alternatywie "kosztem programów społecznych", 30 proc. przy "ograniczeniu świadczeń", 32,4 proc. przy tymczasowym podatku na modernizację armii i 13 proc. pod etykietą "podatek wojenny".',
    'Rozbieżność 13 wobec 32,4 proc. dla w istocie tej samej daniny to najmocniej udokumentowany dowód, że samo nazwanie waży bardziej niż sam postulat. To argument za pozycją audytora, nie za własną propozycją daniny.',
    'Wobec Ukrainy widać trend zmęczenia: przyjmowanie uchodźców popiera 48 proc. przy 45 proc. przeciw, a 50 proc. uważa pomoc państwa za zbyt dużą. Jednocześnie 58 proc. chce świadczeń dla Ukraińców pracujących i płacących podatki, więc opór dotyczy transferu bez wzajemności, nie Ukraińców jako takich.',
  ],

  badania: [
    {
      id: 'obron-ibris-2024',
      instytut: 'IBRiS',
      zleceniodawca: 'Rzeczpospolita',
      termin: 'listopad 2024 [do weryfikacji: dokładna data]',
      proba: 'brak danych o N i metodzie',
      pytanie: 'Czy Polska powinna zwiększać wydatki na wojsko (parafraza redakcji).',
      wyniki: [
        { etykieta: 'Za zwiększaniem', procent: 72.9, kluczowy: true },
        { etykieta: 'Przeciw', procent: 18.2 },
        { etykieta: 'Brak zdania', procent: 8.9 },
      ],
      jakCzytac:
        'Punkt odniesienia podany przez redakcję: kwiecień 2022 to 76,7 proc., więc widać erozję. Przekroje (bez podziału partyjnego): elektorat lewicowy 83 proc., mężczyźni 77 proc., 60+ 82 proc., wieś 90 proc. Pytanie binarne (o zwiększaniu), co zawyża odsetek "za". Dokładna data i metodologia do potwierdzenia.',
      zrodlo: {
        tytul: 'Sondaż Rzeczpospolitej: na wojsko trzeba wydawać więcej',
        url: 'https://www.rp.pl/kraj/art41510261-sondaz-rzeczpospolitej-na-wojsko-trzeba-wydawac-wiecej',
        wydawca: 'Rzeczpospolita',
        data: 'listopad 2024',
      },
    },
    {
      id: 'obron-opinia24-2025',
      instytut: 'Opinia24',
      zleceniodawca: 'Fakty TVN i TVN24',
      termin: 'publikacja 30 grudnia 2025',
      proba: 'N = 1000',
      pytanie:
        'Czy wydatki na obronność powinny być zwiększane, nawet kosztem innych obszarów (relacjonowane).',
      wyniki: [
        { etykieta: 'Za zwiększaniem', procent: 67, kluczowy: true },
        { etykieta: 'Przeciw', procent: 25 },
        { etykieta: 'Niezdecydowani', procent: 8 },
      ],
      jakCzytac:
        'Najnowszy z trzech pomiarów poparcia dla zwiększania wydatków i najniższy, co potwierdza trend erozji. Przekroju elektoratowego brak. Sformułowanie "nawet kosztem innych obszarów" jest łagodniejsze niż wskazanie konkretnego kosztu, stąd wynik wyższy niż w badaniach o daninie.',
      zrodlo: {
        tytul: 'Polacy za zwiększaniem wydatków na obronność, sondaż dla Faktów TVN i TVN24',
        url: 'https://tvn24.pl/polska/polacy-za-zwiekszaniem-wydatkow-na-obronnosc-sondaz-dla-faktow-tvn-i-tvn24-st8822441',
        wydawca: 'TVN24',
        data: '30 grudnia 2025',
      },
    },
    {
      id: 'obron-ibris-kwiecien-2025',
      instytut: 'IBRiS',
      zleceniodawca: 'Defence24 [do weryfikacji: atrybucja z relacji, w publikacji IBRiS dla PAP]',
      termin: '22 kwietnia 2025',
      proba: 'N = 1068, CATI',
      pytanie:
        'Czy przeznaczać więcej środków na wojsko i obronność, nawet kosztem innych ważnych obszarów, takich jak programy społeczne czy opieka medyczna.',
      wyniki: [
        { etykieta: 'Za (razem)', procent: 50.6, kluczowy: true },
        { etykieta: 'Przeciw (razem)', procent: 41.8 },
        { etykieta: 'Brak zdania', procent: 7.6 },
      ],
      jakCzytac:
        'Kluczowy pomiar mechanizmu kosztu: samo dopisanie "kosztem programów społecznych czy opieki medycznej" ścina poparcie z około 67-73 proc. do 50,6 proc. (22,1 proc. zdecydowanie, 28,5 proc. raczej). To wciąż większość, ale krucha. Atrybucja zamawiającego do potwierdzenia.',
      zrodlo: {
        tytul: 'Polacy: zwiększać wydatki obronne nawet kosztem socjalnych',
        url: 'https://defence24.pl/polityka-obronna/polacy-zwiekszac-wydatki-obronne-nawet-kosztem-socjalnych',
        wydawca: 'Defence24',
        data: '22 kwietnia 2025',
      },
    },
    {
      id: 'obron-ibris-grudzien-2025',
      instytut: 'IBRiS',
      zleceniodawca: 'Rzeczpospolita',
      termin: '19-20 grudnia 2025',
      proba: 'brak danych o N i metodzie',
      pytanie:
        'Czy w związku z rosnącym zagrożeniem ze strony Rosji i wyższymi wydatkami na obronność powinien zostać wprowadzony tymczasowy podatek na sfinansowanie modernizacji polskiej armii.',
      wyniki: [
        { etykieta: 'Za (razem)', procent: 32.4, kluczowy: true },
        { etykieta: 'Przeciw (razem)', procent: 57.8 },
        { etykieta: 'Brak zdania', procent: 9.1 },
      ],
      jakCzytac:
        'Ta sama danina co "podatek wojenny", ale nazwana "tymczasowym podatkiem na modernizację armii" zbiera 32,4 proc. zamiast 13 proc. Przekrój: poparcie wśród wyborców koalicji rządzącej 50,1 proc., Lewicy 56,5 proc.; sprzeciw wśród prawicy 64,4 proc., opozycji 68 proc. [do weryfikacji: artykuł nie rozdziela PiS od Konfederacji i miesza kategorie].',
      zrodlo: {
        tytul: 'A może czasowy podatek wojenny? Co sądzą o tym Polacy',
        url: 'https://www.rp.pl/budzet-i-podatki/art43587651-a-moze-czasowy-podatek-wojenny-co-sadza-o-tym-polacy',
        wydawca: 'Rzeczpospolita',
        data: '19-20 grudnia 2025',
      },
    },
    {
      id: 'obron-ibris-defence24',
      instytut: 'IBRiS',
      zleceniodawca: 'Defence24 (raport "Obronność 2026")',
      termin: 'brak danych o dacie, N i metodzie',
      proba: 'brak danych',
      pytanie:
        'Czy uważasz, że Polska powinna wprowadzić specjalny podatek wojenny, aby lepiej przygotować się do obrony.',
      wyniki: [
        { etykieta: 'Za podatkiem wojennym', procent: 13, kluczowy: true },
        { etykieta: 'Przeciw', procent: 76 },
        { etykieta: 'Trudno powiedzieć', procent: 11 },
      ],
      jakCzytac:
        'Najniższy wynik dla daniny w całym korpusie i drugi biegun mechanizmu nazwania (13 proc. jako "podatek wojenny" wobec 32,4 proc. jako "tymczasowy podatek na modernizację"). Drugie pytanie tego badania: ograniczenie niektórych świadczeń socjalnych na rzecz obronności daje 30 proc. za, 64 proc. przeciw.',
      zrodlo: {
        tytul: 'Polacy przeciwni podatkowi wojennemu, badanie IBRiS i Defence24',
        url: 'https://defence24.pl/polityka-obronna/polacy-przeciwni-podatkowi-wojennemu-badanie-ibris-i-defence24',
        wydawca: 'Defence24',
        data: '2026',
      },
    },
    {
      id: 'obron-cbos-ukraina-2025',
      instytut: 'CBOS',
      zleceniodawca: 'badanie własne, komunikat K_096_25',
      termin: '11-22 września 2025',
      proba: 'N = 969, mixed-mode (CAPI 65,4 proc., CATI 22,1 proc., CAWI 12,5 proc.)',
      pytanie: 'Polacy o pomocy uchodźcom z Ukrainy i dalszych losach wojny.',
      wyniki: [
        { etykieta: 'Za przyjmowaniem uchodźców', procent: 48, kluczowy: true },
        { etykieta: 'Przeciw przyjmowaniu', procent: 45 },
        { etykieta: 'Pomoc państwa "za duża"', procent: 50 },
        { etykieta: 'Świadczenia dla pracujących Ukraińców', procent: 58 },
      ],
      jakCzytac:
        'Trend zmęczenia: wg CBOS najniższe poparcie i najwyższy sprzeciw wobec przyjmowania uchodźców od aneksji Krymu. Jednocześnie 58 proc. chce, by 800 plus i opieka zdrowotna przysługiwały wszystkim Ukraińcom pracującym i płacącym podatki, co uzasadnia język wzajemności, nie likwidacji. [do weryfikacji]: PDF komunikatu nie został sparsowany, liczby ze streszczeń i konta CBOS na X, przed publikacją otworzyć oryginał.',
      zrodlo: {
        tytul: 'Polacy o pomocy uchodźcom z Ukrainy i dalszych losach wojny (K_096_25)',
        url: 'https://www.cbos.pl/SPISKOM.POL/2025/K_096_25.PDF',
        wydawca: 'CBOS',
        data: 'wrzesień 2025',
      },
    },
  ],

  zagranica: [
    {
      kraj: 'European Sky Shield (inicjatywa europejska)',
      opis: 'Europejska inicjatywa wspólnej obrony powietrznej i przeciwrakietowej, oparta na skoordynowanych zakupach systemów przez państwa uczestniczące. Przystąpienie Polski było konkretem programu KO w 2023 r., a wspólne zakupy i standaryzacja w ramach PESCO postulatem PSL.',
      wniosek:
        'Wspólne zakupy europejskie są gotowym postulatem do przejęcia: obniżają koszt jednostkowy, standaryzują sprzęt i wzmacniają europejski filar bezpieczeństwa bez kontestacji NATO. Wpisują się w pozycję audytora efektywności, nie w licytację procentem PKB.',
      zrodlo: {
        tytul: 'Program wyborczy KO 2023, obrona narodowa (European Sky Shield), korpus programów sejmowych',
        url: 'docs/plan-wyborczy-petru/zrodla/programy-2023.md',
        wydawca: 'Korpus plan wyborczy Petru (analiza programów sejmowych)',
        data: '2023',
      },
    },
    {
      kraj: 'Izrael (model przemysłu zbrojeniowego)',
      opis: 'Rama "wojsko jak przemysł innowacyjny": sektor zbrojeniowy jako innowacyjny przemysł napędzający gospodarkę, a nie tylko pozycja wydatkowa. Postulat Nowoczesnej z 2015 r. odwoływał się wprost do wzoru izraelskiego, obok akceptacji poziomu wydatków i rozwoju sprawności wojska.',
      wniosek:
        'Przemysł zbrojeniowy jako dźwignia technologiczna pozwala mówić o wydatkach obronnych językiem inwestycji i innowacji, a nie kosztu. Uzupełniane offsetem i minimalnym udziałem polskich zakładów (Trzecia Droga 2023 mówiła o 50 proc. modernizacji w kraju).',
      zrodlo: {
        tytul: 'Program Nowoczesnej 2015, wojsko jak przemysł innowacyjny (wzór izraelski), korpus programów sejmowych',
        url: 'docs/plan-wyborczy-petru/zrodla/programy-2015.md',
        wydawca: 'Korpus plan wyborczy Petru (analiza programów sejmowych)',
        data: '2015',
      },
    },
  ],

  politycy: [],

  segmenty: [
    {
      id: 'wolnosciowcy-konfederacji',
      nazwa: 'Wolnościowcy z Konfederacji',
      opis:
        'Świecko-wolnościowy rdzeń elektoratu Konfederacji, wrażliwy na koszt i na każdą nową daninę, sceptyczny wobec transferu bez wzajemności.',
      podstawa:
        'Ocena strategiczna oparta na mechanizmie kosztu (odrzucenie podatku wojennego, 76 proc. przeciw, IBRiS/Defence24) i na przesunięciu elektoratu Konfederacji ku postawom antyukraińskim (z 42 do 71 proc., CBOS 2023-2025). Brak przekroju partyjnego wprost dla większości pytań obronnych.',
      kat: 'Nie kwestionujemy obronności, kwestionujemy marnotrawstwo. FWSZ poza budżetem i brak audytu 200 mld zł to wydatki bez kontroli.',
      coDziala: [
        'Wypunktowanie, że FWSZ w BGK (79,5 mld zł w planie 2026) zadłuża się drożej niż Skarb Państwa i omija kontrolę Sejmu.',
        'Rama efektywności: te same pieniądze wydane mądrzej to więcej sprawnej armii, nie mniej. Jawność kontraktów zamiast nowej daniny.',
        'Język wzajemności wobec Ukrainy: świadczenia dla pracujących i płacących podatki, nie transfer bezwarunkowy.',
      ],
      czegoUnikac: [
        'Własnego celu procentowego PKB, który zabrzmi jak licytacja z rządem i narazi na pytanie o finansowanie.',
        'Języka, który u części tej grupy zabrzmi jak zbyt miękkie stanowisko wobec Ukrainy.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze', 'YouTube'],
      przyklad:
        'Rząd chowa 79 miliardów na zbrojenia w funduszu poza budżetem, który zadłuża się drożej niż Skarb Państwa i wymyka się kontroli Sejmu. Nie pytamy, czy wydawać na wojsko. Pytamy, czy ktoś to w ogóle rozlicza.',
    },
    {
      id: 'sieroty-po-td',
      nazwa: 'Sieroty po Trzeciej Drodze',
      opis:
        'Wyborcy proatlantyccy i prozachodni, przekonani o potrzebie silnej armii, ale zmęczeni podnoszeniem stawki i nieufni wobec obietnic bez pokrycia.',
      podstawa:
        'Ocena strategiczna. Pomiar pośredni: erozja poparcia dla zwiększania wydatków (76,7 do 67 proc.) i załamanie przy koszcie (50,6 proc., IBRiS IV 2025) sugerują grupę popierającą obronność, ale odrzucającą dodatkowe daniny. Program Trzeciej Drogi 2023 stawiał na krajowy przemysł zbrojeniowy i offset.',
      kat: 'Silna armia tak, ale rozliczona co do złotówki. Audyt zakupów i krajowy przemysł zamiast kolejnej daniny.',
      coDziala: [
        'Rozjazd planu z wykonaniem: w 2024 r. planowano 4,2 proc. PKB, wydano poniżej 4 proc. Pytanie, ile z ogłoszonych miliardów faktycznie trafia do wojska.',
        'Wspólne zakupy europejskie (European Sky Shield, PESCO) jako tańszy i skuteczniejszy sposób niż zakupy w pojedynkę.',
        'Przemysł zbrojeniowy jako inwestycja technologiczna, nie tylko wydatek, plus miejsca pracy w kraju.',
      ],
      czegoUnikac: [
        'Sugerowania, że wsparcie dla Ukrainy należy ograniczyć, bo ta grupa jest proatlantycka.',
        'Księgowego tonu, który zabrzmi jak brak troski o bezpieczeństwo.',
      ],
      kanaly: ['Facebook', 'Newsletter', 'Prasa lokalna'],
      przyklad:
        'Chcemy silnej armii i płacimy już na nią 4,7 procent PKB, więcej niż większość NATO. Różnica jest w tym, że pytamy, czy te dwieście miliardów jest wydawane dobrze. W 2024 roku plan mówił o czterech i dwóch dziesiątych procenta, a wydano poniżej czterech.',
    },
    {
      id: 'rozczarowani-ko',
      nazwa: 'Rozczarowani Koalicją Obywatelską',
      opis:
        'Najsilniejsze zaplecze finansowania zbrojeń spośród trzech grup, ale rozczarowani wykonawstwem i skłonni do rozliczania obietnic.',
      podstawa:
        'Pomiar: to jedyna grupa z poparciem dla tymczasowego podatku na modernizację armii (koalicja rządząca 50,1 proc. za, IBRiS XII 2025). Przekrój partyjny częściowy i [do weryfikacji], bo artykuł miesza kategorie opozycji. Reszta profilu to ocena strategiczna.',
      kat: 'Skoro zgadzacie się płacić więcej, tym bardziej macie prawo wiedzieć, na co idą te pieniądze. Jawność kontraktów i konsolidacja FWSZ w budżecie.',
      coDziala: [
        'Konsolidacja FWSZ w budżecie i ujednolicenie definicji długu jako test uczciwości fiskalnej państwa.',
        'European Sky Shield i wspólne zakupy europejskie, bliskie proeuropejskiej wrażliwości tej grupy.',
        'Jawność kontraktów zbrojeniowych wzorem "białej księgi zakupów", którą sama KO zapowiadała w 2023 r.',
      ],
      czegoUnikac: [
        'Kwestionowania poziomu wydatków, co zabrzmi jak stanowisko antyobronne wobec grupy popierającej finansowanie.',
        'Atakowania samej idei wspólnych zakupów europejskich, które ta grupa popiera.',
      ],
      kanaly: ['Facebook', 'X', 'Prasa ogólnopolska'],
      przyklad:
        'Nawet ci, którzy zgadzają się dopłacić na modernizację armii, mają prawo wiedzieć, gdzie idą te pieniądze. Dlatego zamiast kolejnej daniny proponujemy konsolidację funduszu zbrojeniowego w budżecie i jawność kontraktów.',
    },
  ],

  luki: [
    'Brak sondażu pytającego wprost o utrzymanie obecnego poziomu wydatków w trójpodziale "więcej / tyle samo / mniej". Wszystkie pomiary są binarne (o zwiększaniu), co zawyża odsetek "za".',
    'Brak danych o poparciu dla powszechnego szkolenia wojskowego i przywrócenia zasadniczej służby wojskowej. Wyszukiwanie w korpusie przerwane, do sprawdzenia CBOS, MON, WOT, Opinia24.',
    'Brak przekroju elektoratowego dla większości pomiarów obronnych. Tam, gdzie jest (IBRiS XII 2025), artykuł miesza kategorie opozycji i nie rozdziela PiS od Konfederacji [do weryfikacji].',
    'Brak danych o poparciu dla pomocy wojskowej i finansowej dla Ukrainy odrębnie od uchodźców. Cały materiał CBOS dotyczy wyłącznie uchodźców.',
    'Liczby CBOS o Ukrainie pochodzą ze streszczeń i konta CBOS na X, PDF komunikatu K_096_25 nie został sparsowany. Przed publikacją otworzyć oryginał.',
    'Dokładna data, N i metoda badań IBRiS (XI 2024, "Obronność 2026") oraz atrybucja zamawiającego pomiaru z kwietnia 2025 (IBRiS dla PAP czy Defence24) pozostają do potwierdzenia.',
  ],
};
