/**
 * Temat: stanowisko wobec konsolidacji finansów publicznych (plan wyborczy Petru).
 * Pytanie decyzyjne: czy deklarować własną ścieżkę do deficytu poniżej 3 proc. PKB
 * do 2028 r. Rekomendacja: tak, ale jako "tańsze, sprawniejsze państwo", nie jako
 * "cięcia"; oś sporu to "państwo marnuje wasze pieniądze", nie "państwo za duże".
 * Korpus: docs/plan-wyborczy-petru/.
 */

import type { Temat } from '../types';

export const konsolidacjaFiskalna: Temat = {
  slug: 'konsolidacja-fiskalna',
  nazwa: 'Konsolidacja finansów publicznych',
  zajawka:
    'Nie ma sondażu wprost o konsolidacji, ale liczby są jednoznaczne: obsługa długu kosztuje więcej niż wszystkie flagowe transfery razem. Ścieżka poniżej 3 proc. PKB do 2028 r. jako tańsze państwo, nie jako cięcia.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/plan-wyborczy-petru/',
  liczbaZrodel: 22,
  doWeryfikacji: 2,

  rekomendacja: {
    pytanie: 'Czy deklarować własną ścieżkę do deficytu poniżej 3 proc. PKB do 2028 r.?',
    odpowiedz:
      'Tak, ale komunikowaną jako tańsze, sprawniejsze państwo, nie jako cięcia; oś sporu to państwo marnuje wasze pieniądze, nie państwo za duże.',
    uzasadnienie: [
      'Konsolidacja i tak nastąpi. Procedura nadmiernego deficytu UE wymaga zejścia poniżej 3 proc. PKB do 2028 r., a deficyt sektora wyniósł 7,3 proc. w 2025 r. Bez własnego planu partia wolnościowa nie ma odpowiedzi na najtrudniejsze pytanie kampanii, a wybór jest między jej wersją cięć wydatków a wersją rządu opartą na wyższych podatkach.',
      'Najmocniejszy nośny fakt robi pracę za pojęcie konsolidacji: obsługa długu w 2026 r. kosztuje ok. 115 mld zł, czyli więcej niż 800 plus, 13. i 14. emerytura, renta wdowia i babciowe razem wzięte (ok. 106,5 mld zł). Odsetki są dziś drugim programem społecznym, tyle że dla posiadaczy obligacji.',
      'Oś "państwo za duże" przegrywa nawet w rdzeniu grupy docelowej, bo państwa opiekuńczego chce 68 proc. wyborców Konfederacji i 77-80 proc. w centrum (CBOS 43/2025). Działa za to oś "państwo marnuje", bo 90 proc. uważa, że pieniądze publiczne są wydawane nieracjonalnie, a 87 proc., że podatki są za wysokie wobec tego, co państwo daje (CBOS 85/2016).',
      'Kompozycja cięć zgodna z tym, na co jest przyzwolenie: administracja publiczna, fundusze pozabudżetowe, spółki Skarbu Państwa, przegląd ulg podatkowych. Poza zakresem cięć emerytury (65,3 proc. przeciw likwidacji 13. i 14. emerytury) i zdrowie (59 proc. przeciw zmniejszaniu wydatków).',
      'Postulaty przejrzystości są tanie politycznie, bo nie są wyrzeczeniem: ujednolicenie definicji długu z UE i konsolidacja funduszy BGK oraz PFR to test uczciwości fiskalnej. NIK liczy ponad 12 mld zł nadpłaconych odsetek na równoległym budżecie, IFP ponad 14,5 mld zł.',
    ],
    ryzyko: [
      'Brak sondażu mierzącego wprost poparcie dla konsolidacji, procedury nadmiernego deficytu i priorytetyzacji wydatków. Cała rekomendacja opiera się na danych pośrednich i na przekrojach dla pytań o cały pakiet, nie o ten postulat.',
      'Zgoda na cięcia w abstrakcji (72 proc. za ograniczaniem wydatków) rozpada się przy konkretach. Każda pozycja poza administracją ma większość przeciw, więc "tańsze państwo" łatwo odczytać jako zapowiedź cięcia usług.',
      'Paradoks elektoratu docelowego: wolnościowcy z Konfederacji rzadziej popierają cięcia (76 proc.) niż wyborcy KO (83 proc.) i Trzeciej Drogi (86 proc.). Przekaz oszczędnościowy słabiej trafia w rdzeń, niż podpowiada intuicja, i łatwiej go sprzedać w centrum.',
      'Bariera tożsamościowa: dla elektoratu Konfederacji Petru jest twarzą establishmentu, więc nawet policzony plan nie przeniesie tych wyborców wprost. Realistyczny cel to segment świecko-wolnościowy, sieroty po Trzeciej Drodze i rozczarowani KO, nie całość elektoratu Konfederacji.',
      'Liczby deficytu i długu w metodologii UE podlegają rewizjom Eurostatu (przykład: deficyt 2023 podniesiony z 5,1 do 5,3 proc.). Przed publikacją każdej liczby sprawdzić najnowszą notyfikację fiskalną GUS.',
    ],
    podchwycic: [
      'Rama "odsetki drugim programem społecznym": obsługa długu kosztuje więcej niż wszystkie flagowe transfery razem, a płynie do posiadaczy obligacji, nie do ludzi. To zdanie zastępuje trudne słowo "konsolidacja".',
      'Rada Fiskalna, apolityczne ciało analityczno-doradcze przy Sejmie pilnujące przejrzystości finansów (postulat SLD z 2011 r.). Gotowy, ponadpartyjny mechanizm wiarygodności, którego dziś nie ma.',
      'Ujednolicenie krajowej definicji długu z definicją Eurostatu (postulat KO z 2019 r., niewdrożony): koniec wypychania wydatków poza budżet. To postulat przejrzystości, nie cięć, więc tani politycznie.',
      'Konsolidacja funduszy pozabudżetowych BGK i PFR oraz przeniesienie emisji do Skarbu Państwa. NIK liczy ponad 12 mld zł nadpłaconych odsetek, IFP ponad 14,5 mld zł zmarnowanych na równoległym budżecie.',
      'Przegląd ulg podatkowych jako źródło dochodu bez podnoszenia stawek (echo diagnozy SLD z 2011 r.: ponad 65 mld zł rocznie na kilkuset przywilejach). Zbieżne z trwałą preferencją Polaków dla prostoty nad adresowaniem.',
    ],
    zaatakowac: [
      'Rząd nie ma żadnego planu konsolidacji poza deklaracjami, przy najwyższym deficycie w całej UE (KE: 6,5 proc. PKB w 2026 r., 6,3 proc. w 2027 r.). Polska jest w procedurze nadmiernego deficytu od lipca 2024 r., a rząd planuje na 2026 r. redukcję deficytu jedynie o ok. 0,5 pkt proc.',
      'Trik konstytucyjny: limit 60 proc. z art. 216 dotyczy państwowego długu publicznego (49,1 proc. na koniec 2025 r.), podczas gdy dług w definicji UE sięga 60 proc. i wg MF 65,1 proc. w 2026 r. Rząd chowa ponad 420 mld zł długu w funduszach BGK i obligacjach PFR.',
      'Fundusz Wsparcia Sił Zbrojnych w BGK zadłuża się drożej niż Skarb Państwa i omija kontrolę Sejmu (79,5 mld zł w planie na 2026 r.). Problem nie zniknął po 2023 r., zmienił tylko szyld z covidowego na zbrojeniowy.',
      'Konfederacja obiecuje cięcia bez rachunku: program wyceniono przez CenEA na ok. 86 mld zł ubytku rocznie, a finansowanie sprowadzono do hasła o ograniczeniu wydatków i likwidacji urzędów. Wolne pole to nie hasło cięć, lecz cięcia policzone.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '7,3 proc.',
      opis: 'Deficyt sektora finansów publicznych (general government) w 2025 r., ok. 284 mld zł. Jeden z najwyższych w UE. Metodologia UE podlega rewizjom Eurostatu.',
      doPublikacji: true,
    },
    {
      wartosc: '115 vs 106,5 mld zł',
      opis: 'Obsługa długu całego sektora w 2026 r. (ok. 115 mld zł) przewyższa 800 plus, 13. i 14. emeryturę, rentę wdowią i babciowe razem wzięte (ok. 106,5 mld zł).',
      doPublikacji: true,
    },
    {
      wartosc: 'ok. 60 proc.',
      opis: 'Dług sektora w definicji UE na koniec 2025 r., prognoza MF 65,1 proc. na 2026 r. Sektor przekroczył 60 proc. PKB w I kw. 2026, pierwszy raz po 1989 r.',
      doPublikacji: true,
    },
    {
      wartosc: '49,1 vs 60 proc.',
      opis: 'Różnica definicji: krajowy dług publiczny 49,1 proc. PKB, dług w definicji UE ok. 60 proc. Ponad 420 mld zł różnicy to fundusze w BGK i obligacje PFR. Limit konstytucyjny 60 proc. dotyczy definicji krajowej, więc formalnie nienaruszony.',
      doPublikacji: true,
    },
    {
      wartosc: 'poniżej 3 proc.',
      opis: 'Cel korekty w procedurze nadmiernego deficytu UE: deficyt sektora poniżej 3 proc. PKB do 2028 r. Zewnętrzna kotwica konsolidacji, niezależna od programu.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Nie istnieje sondaż mierzący wprost poparcie dla konsolidacji finansów publicznych, więc wnioski są pośrednie. CBOS z lipca 2024 r. pokazuje, że 72 proc. jest za ograniczaniem wydatków państwa, a 86 proc. przeciw podnoszeniu podatków.',
    'Zgoda na oszczędności w abstrakcji nie przekłada się na żadną konkretną pozycję poza administracją: administracja tak (56 proc.), zdrowie nie (59 proc. przeciw cięciom), 13. i 14. emerytura nie (65,3 proc. przeciw likwidacji). To najważniejsza asymetria w danych.',
    'Paradoks grupy docelowej: wyborcy Konfederacji rzadziej popierają cięcia (76 proc.) niż wyborcy KO (83 proc.) i Trzeciej Drogi (86 proc.). Program oszczędnościowy jest łatwiejszy do sprzedania w centrum niż u wolnościowców.',
    'Oś sporu "państwo marnuje wasze pieniądze" ma większość: 90 proc. uważa, że pieniądze publiczne są wydawane nieracjonalnie, a 87 proc., że podatki są za wysokie wobec tego, co państwo daje (CBOS 85/2016). Oś "państwo za duże" tej większości nie ma, bo państwa opiekuńczego chce 68-80 proc. we wszystkich trzech grupach docelowych.',
    'Podanie kosztu z własnej inicjatywy obniża poparcie, ale go nie zabija. To argument za mówieniem o pieniądzach wprost, a nie za chowaniem kosztu.',
  ],

  badania: [
    {
      id: 'cbos-ciecia-2024',
      instytut: 'CBOS',
      zleceniodawca: 'badanie własne, "Aktualne problemy i wydarzenia"',
      termin: '4-14 lipca 2024',
      proba: '1076 osób, próba reprezentatywna dorosłych mieszkańców Polski',
      pytanie: 'Czy w obecnej sytuacji finansowej Polski należy ograniczyć wydatki państwa? (poparcie wg elektoratów)',
      wyniki: [
        { etykieta: 'Trzecia Droga', procent: 86 },
        { etykieta: 'Koalicja Obywatelska', procent: 83 },
        { etykieta: 'Konfederacja', procent: 76, kluczowy: true },
        { etykieta: 'PiS', procent: 62 },
      ],
      jakCzytac:
        'Ogółem za ograniczaniem wydatków jest 72 proc., przeciw podnoszeniu podatków 86 proc. Kluczowy jest paradoks: elektorat docelowy Konfederacji popiera cięcia rzadziej niż centrum. Zgoda znika przy konkretach, bo 56 proc. dopuszcza cięcia na administracji, ale 59 proc. jest przeciw cięciom na zdrowiu. Odsetek 76 proc. dla Konfederacji pochodzi z relacji o tym samym badaniu i nie ma go w opublikowanej tabeli elektoratowej, więc jest oznaczony do weryfikacji.',
      zrodlo: {
        tytul: 'Zdecydowana większość Polaków przeciwna podnoszeniu podatków. Wolimy ograniczyć wydatki państwa',
        url: 'https://www.bankier.pl/wiadomosc/Zdecydowana-wiekszosc-Polakow-przeciwna-podnoszeniu-podatkow-Wolimy-by-ograniczyc-wydatki-panstwa-8791952.html',
        wydawca: 'Bankier.pl',
        data: '2 sierpnia 2024',
      },
    },
    {
      id: 'sw-koszt-2025',
      instytut: 'SW Research',
      zleceniodawca: 'Onet',
      termin: '2-3 września 2025',
      proba: '830 osób, CAWI, SW Panel, dobór kwotowy',
      pytanie: 'Czy podniesienie kwoty wolnej od podatku powinno być priorytetem rządu, nawet kosztem zwiększenia deficytu budżetowego?',
      wyniki: [
        { etykieta: 'Tak', procent: 39.9, kluczowy: true },
        { etykieta: 'Nie', procent: 29.2 },
        { etykieta: 'Trudno powiedzieć', procent: 31 },
      ],
      jakCzytac:
        'To jedyne polskie badanie z ceną wprost w pytaniu. Bez wzmianki o koszcie poparcie dla podniesienia kwoty wolnej sięgało 79 proc. (Pollster 2021). Mechanizm jest uniwersalny dla całej debaty fiskalnej: podanie kosztu obniża poparcie, ale go nie zabija, a duża grupa 31 proc. bez zdania jest do przekonania. Uwaga: pytanie dotyczy kwoty wolnej, nie konsolidacji wprost, więc służy jako dowód siły sformułowania, a nie jako pomiar poparcia dla oszczędności.',
      zrodlo: {
        tytul: 'Co z kwotą wolną od podatku. Wiemy, co sądzą Polacy',
        url: 'https://polskieradio24.pl/artykul/3575612,co-z-kwota-wolna-od-podatku-wiemy-co-sadza-polacy',
        wydawca: 'Polskie Radio 24',
        data: 'wrzesień 2025',
      },
    },
  ],

  zagranica: [
    {
      kraj: 'Unia Europejska (procedura nadmiernego deficytu)',
      opis: 'Polska objęta procedurą nadmiernego deficytu w lipcu 2024 r. (czwarty raz w historii). Zalecenie Rady UE oparte na ścieżce wydatków netto: korekta deficytu poniżej 3 proc. PKB do 2028 r. i wyjście z procedury ok. 2029 r. Krajowa klauzula wyjścia na wydatki obronne obowiązuje do 2028 r.',
      wniosek:
        'Konsolidacja nastąpi tak czy inaczej, bo wymusi ją zewnętrzna kotwica. Wybór jest między wersją cięć wydatków i tańszego państwa a wersją rządu opartą na wyższych podatkach. To zdejmuje z programu zarzut, że oszczędności są dobrowolnym okrucieństwem.',
      zrodlo: {
        tytul: 'Polska objęta procedurą nadmiernego deficytu',
        url: 'https://www.prawo.pl/podatki/polska-objeta-procedura-nadmiernego-deficytu,527535.html',
        wydawca: 'Prawo.pl',
        data: 'lipiec 2024',
      },
    },
    {
      kraj: 'Porównanie w UE (koszt obsługi długu)',
      opis: 'Polska płaci jedne z najwyższych odsetek w UE: implikowany koszt obsługi długu ok. 4,5 proc. w 2025 r., drugi najwyższy w Unii po Rumunii, ok. dwukrotność średniej unijnej.',
      wniosek:
        'Wiarygodność fiskalna ma cenę wymierną w miliardach. Teza programowa: tańsze, rozliczające się państwo oznacza tańszy kredyt, a tańszy kredyt oznacza niższe podatki w przyszłości.',
      zrodlo: {
        tytul: 'Polska z rekordowym kosztem długu, jedno z najwyższych obciążeń w całej UE',
        url: 'https://ksiegowosc.infor.pl/wiadomosci/7601379,polska-z-rekordowym-kosztem-dlugu-jedno-z-najwyzszych-obciazen-w-calej-ue.html',
        wydawca: 'Infor.pl',
        data: '2025',
      },
    },
  ],

  politycy: [
    {
      id: 'domanski',
      imieNazwisko: 'Andrzej Domański',
      funkcja: 'minister finansów',
      ugrupowanie: 'Koalicja Obywatelska',
      stanowisko:
        'Utrzymuje wszystkie transfery i odkłada obniżki podatków, powołując się na wydatki obronne, przy deficycie sektora 7,3 proc. PKB i bez ogłoszonego planu konsolidacji.',
      slabyPunkt:
        'Brak jakiegokolwiek planu konsolidacji poza deklaracjami przy najwyższym deficycie w UE (KE, NIK, FOR), a Polska od lipca 2024 r. jest w procedurze nadmiernego deficytu.',
      wypowiedzi: [],
    },
    {
      id: 'mentzen',
      imieNazwisko: 'Sławomir Mentzen',
      funkcja: 'poseł, lider Nowej Nadziei',
      ugrupowanie: 'Konfederacja',
      stanowisko:
        'Radykalne cięcia i obniżki danin, ale finansowanie sprowadzone do hasła o ograniczeniu wydatków i likwidacji urzędów, bez rachunku ubytku dochodów.',
      slabyPunkt:
        'Program bez policzonego pokrycia: CenEA szacuje ok. 86 mld zł ubytku rocznie, a partia ma udokumentowaną wpadkę wykonawczą przy własnym projekcie kwoty wolnej.',
      wypowiedzi: [],
    },
  ],

  segmenty: [
    {
      id: 'wolnosciowcy-konfederacji',
      nazwa: 'Wolnościowcy z Konfederacji',
      opis: 'Wyborcy Konfederacji o profilu gospodarczo wolnościowym, nieakceptujący konserwatyzmu światopoglądowego.',
      podstawa:
        'CBOS lipiec 2024: 76 proc. za ograniczaniem wydatków, mniej niż KO (83 proc.). CBOS 43/2025: najniższe wśród elektoratów poparcie państwa opiekuńczego (68 proc.), ale wciąż większość; 50 proc. za podatkiem liniowym.',
      kat: 'Państwo marnuje wasze pieniądze, nie państwo za duże. Przejrzystość funduszy pozabudżetowych i ujednolicenie definicji długu jako test uczciwości, nie zapowiedź wyrzeczeń.',
      coDziala: [
        'Rama "odsetki drugim programem społecznym": obsługa długu drożej niż wszystkie flagowe transfery razem.',
        'Konsolidacja funduszy BGK i PFR: ponad 12 mld zł nadpłaconych odsetek na równoległym budżecie.',
        'Pozycja "wolnościowiec, który umie liczyć" w kontrze do Konfederacji obiecującej cięcia bez rachunku.',
      ],
      czegoUnikac: [
        'Języka "państwo minimum".',
        'Cięć w zdrowiu i emeryturach.',
        'Licytowania się z Konfederacją na radykalne obniżki bez pokazanego pokrycia.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze', 'YouTube'],
      przyklad:
        'Sam koszt odsetek od długu jest w 2026 r. wyższy niż 800 plus, trzynastka, czternastka, renta wdowia i babciowe razem. Państwo nie jest za duże, państwo marnuje wasze pieniądze. Zacznijmy od pokazania, gdzie one znikają.',
    },
    {
      id: 'sieroty-po-td',
      nazwa: 'Sieroty po Trzeciej Drodze',
      opis: 'Wyborcy dawnej Trzeciej Drogi, centrowi, ceniący odpowiedzialność fiskalną i sprawne państwo.',
      podstawa:
        'CBOS lipiec 2024: 86 proc. za ograniczaniem wydatków, najwyższe ze wszystkich elektoratów. CBOS 43/2025: 80 proc. za państwem opiekuńczym.',
      kat: 'Sprawne, policzalne państwo. Rada Fiskalna i przegląd ulg jako gwarancja porządku, nie zapowiedź wyrzeczeń.',
      coDziala: [
        'Tabela finansowania per postulat, której nie zrobił nikt od Lewicy w 2019 r.',
        'Rada Fiskalna jako apolityczna instytucja pilnująca przejrzystości (postulat SLD 2011).',
        'Przejrzystość funduszy pozabudżetowych zamiast równoległego budżetu.',
      ],
      czegoUnikac: [
        'Języka "państwo minimum".',
        'Cięć w zdrowiu i emeryturach.',
        'Radykalizmu i haseł bez pokrycia.',
      ],
      kanaly: ['Facebook', 'Newsletter', 'Prasa lokalna'],
      przyklad:
        'Chcemy państwa, które umie policzyć swoje wydatki. Rada Fiskalna przy Sejmie, jawny rachunek każdej obietnicy i koniec chowania długu poza budżetem. Nie mniej państwa, lecz sprawniejsze.',
    },
    {
      id: 'rozczarowani-ko',
      nazwa: 'Rozczarowani Koalicją Obywatelską',
      opis: 'Rdzeń z wyższym wykształceniem i wyższym dochodem, dawni wyborcy KO zawiedzeni niedowiezionymi obietnicami.',
      podstawa:
        'CBOS lipiec 2024: 83 proc. za ograniczaniem wydatków. CBOS 43/2025: 77 proc. za państwem opiekuńczym. SW Research VII 2026: 53,3 proc. uważa rozliczenie rządów PiS za niewystarczające, najostrzej osoby z wyższym wykształceniem (59 proc.) i dochodem powyżej 7000 zł netto (58 proc.).',
      kat: 'Państwo, które się rozlicza. Wiarygodność liczb przeciw niedowiezionym obietnicom, bez pogardy wobec wyborców KO.',
      coDziala: [
        'Rama "odsetki drożej niż transfery": twardy fakt, nie ideologia.',
        'Ujednolicenie definicji długu z Eurostatem, czyli dokładnie postulat KO z 2019 r., którego rząd nie wdrożył.',
        'Każdy konkret z kosztorysem: kontra wobec obietnic odkładanych pięć razy w dwa lata.',
      ],
      czegoUnikac: [
        'Języka "państwo minimum".',
        'Cięć w zdrowiu i emeryturach.',
        'Pogardy wobec wyborców KO, bo to potencjalny elektorat.',
      ],
      kanaly: ['Facebook', 'X', 'Newsletter', 'Prasa'],
      przyklad:
        'W 2019 r. obiecano ujednolicenie definicji długu z Eurostatem, żeby rząd nie chował wydatków poza budżetem. Do dziś ponad 420 mld zł długu siedzi w funduszach BGK i PFR. My to po prostu zrobimy, z kosztorysem na stole.',
    },
  ],

  luki: [
    'Brak sondażu mierzącego wprost poparcie dla konsolidacji fiskalnej, procedury nadmiernego deficytu i priorytetyzacji wydatków przy ograniczonym budżecie, z przekrojem elektoratowym.',
    'Brak badania mierzącego świadomość kosztów obsługi długu, czyli czy wyborcy wiedzą, że odsetki kosztują więcej niż 800 plus. To najmocniejszy dostępny argument, a nie wiadomo, ilu ludzi go zna.',
    'Odsetek 76 proc. poparcia dla cięć u wyborców Konfederacji pochodzi z relacji o badaniu CBOS z lipca 2024 r., a nie z opublikowanej tabeli elektoratowej (która wymienia tylko Trzecią Drogę, KO i PiS). Oznaczony do weryfikacji.',
    'CBOS 80/2024 o obszarach dozwolonych oszczędności (u Konfederacji administracja na pierwszym miejscu, wsparcie rodziny na drugim, 38 proc., a renty i emerytury tylko 9 proc.) cytowany za dokumentem rekomendacji, bez sięgnięcia do komunikatu CBOS. Oznaczony do weryfikacji.',
    'Dane o wpływach, kosztach obsługi długu i wielkości funduszy pozabudżetowych pochodzą częściowo ze źródeł wtórnych (Bankier, PAP, money.pl, infor.pl). Do publikacji sięgnąć do sprawozdań MF, analiz NIK i notyfikacji fiskalnej GUS.',
    'Liczby deficytu i długu w metodologii UE podlegają rewizjom Eurostatu; krajowy dług publiczny dla 2026 r. i część prognoz są w źródłach oznaczone do weryfikacji.',
  ],
};
