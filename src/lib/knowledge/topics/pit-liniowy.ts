/**
 * Temat: likwidacja drugiego progu i liniowy PIT 12% (program Konfederacji 2023).
 * Postulat programowy bez projektu ustawy. Najostrzejszy fiskalnie i najbardziej
 * regresywny element pakietu. Kluczowy argument: region wycofuje się z liniowego.
 */

import type { Temat } from '../types';

export const pitLiniowy: Temat = {
  slug: 'pit-liniowy',
  nazwa: 'PIT liniowy 12% i likwidacja II progu',
  zajawka:
    'Jedna stawka 12% zamiast 12/32%. Postulat tożsamościowy Konfederacji, kosztowny, regresywny i wbrew trendowi regionu.',
  aktualizacja: '25 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 51,
  doWeryfikacji: 3,

  rekomendacja: {
    pytanie: 'Poprzeć, zignorować czy zaatakować postulat liniowego PIT 12%?',
    odpowiedz:
      'Nie przejmować. Przejąć hasło prostoty, ale zaatakować liniowość jako ulgę dla najbogatszych wbrew trendowi całego regionu.',
    uzasadnienie: [
      'To jedyny postulat gospodarczy, który realnie spaja i wyróżnia elektorat Konfederacji, więc wejście w niego wprost oznacza granie na jego boisku i jego zasadami.',
      'Liniowy PIT jest w skali kraju rozwiązaniem mniejszościowym: popiera go 35 proc. Polaków wobec 51 proc. za progresją (CBOS 2023).',
      'Region idzie w przeciwną stronę: od 2013 r. z liniowego wycofały się Słowacja, Łotwa, Litwa, Czechy i Rosja. To fakt, nie opinia, i rozbraja narrację, że „cała Europa Środkowa upraszcza”.',
      'Regresywność jest tu twardym, policzalnym argumentem: gros korzyści z likwidacji drugiego progu trafia do ok. 10 proc. najlepiej zarabiających (FOR).',
    ],
    ryzyko: [
      'Poparcie dla podatku liniowego rośnie nieprzerwanie od 1997 r. (z 18 do 35 proc.). Atak zbyt frontalny może zrazić młodszą, aspirującą część elektoratu.',
      'Badanie Maison pokazuje, że poparcie dla liniowego skacze do 60 proc., gdy pytanie zawiera konkretną kwotę. Framing przeciwnika bywa skuteczny, trzeba mieć na to odpowiedź.',
      'Argument Mentzena, że drugi próg i tak jest omijany przez najbogatszych, jest częściowo trafny.',
    ],
    podchwycic: [
      'Hasło prostoty systemu, nie jego spłaszczenia. Można obiecać mniej formularzy i stabilność przepisów bez rezygnacji z progresji.',
      'Krytyka daniny solidarnościowej i drugiego progu jako źle skonstruowanych da się przejąć bez wchodzenia w jedną stawkę dla wszystkich.',
    ],
    zaatakowac: [
      'Trend regionalny: Słowacja porzuciła liniowy w 2013 r. właśnie z powodu rozczarowujących dochodów i regresywności. Czechy, Łotwa, Litwa i Rosja poszły tą samą drogą. Konfederacja proponuje to, z czego sąsiedzi zrezygnowali.',
      'Koszt: sam liniowy PIT 12% to ok. 60,5 mld zł ubytku rocznie (FOR), a cały pakiet Konfederacji to ok. 182 mld zł. To nie mieści się w żadnym realnym budżecie.',
      'Regresywność: im więcej zarabiasz, tym więcej zyskujesz. W UE liniowy utrzymują tylko cztery kraje o wyraźnie niższych wydatkach socjalnych (Bułgaria, Rumunia, Węgry, Estonia). Żaden duży kraj Zachodu.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '5 krajów',
      opis: 'Tyle krajów regionu wycofało się z liniowego PIT od 2013 r.: Słowacja, Łotwa, Litwa, Czechy, Rosja.',
      doPublikacji: true,
    },
    {
      wartosc: '60,5 mld zł',
      opis: 'Roczny ubytek dochodów z samego liniowego PIT 12% według FOR.',
      doPublikacji: true,
    },
    {
      wartosc: '35% / 51%',
      opis: 'Poparcie dla podatku liniowego wobec progresji w skali kraju (CBOS 2023). Liniowy jest mniejszościowy.',
      doPublikacji: true,
    },
    {
      wartosc: '~10%',
      opis: 'Do tylu najlepiej zarabiających trafia gros korzyści z likwidacji drugiego progu (FOR).',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Podatek liniowy popiera 35 proc. Polaków, progresję 51 proc. (CBOS 2023). Ale poparcie dla liniowego rośnie nieprzerwanie od 1997 r., gdy wynosiło 18 proc.',
    'Elektorat Konfederacji to jedyny, w którym zwolennicy liniowego (50 proc.) przeważają nad zwolennikami progresji (39 proc.). To jego znak rozpoznawczy.',
    'Poparcie jest silnie zależne od sposobu zadania pytania. Badanie Maison (ZPP): przy pytaniu bez wyjaśnienia liniowy popiera 20 proc., ale z konkretnym przykładem kwotowym poparcie skacze do 60 proc. To pole do framingu po obu stronach.',
    'Uwaga strategiczna: baza Konfederacji nie jest spójnie wolnorynkowa. 68 proc. jej wyborców chce państwa opiekuńczego, 57 proc. chce utrzymania własności państwowej. Radykalna liniowość wyprzedza poglądy własnego elektoratu poza samą stawką.',
  ],

  badania: [
    {
      id: 'maison-zpp-2017',
      instytut: 'prof. Dominika Maison (UW)',
      zleceniodawca: 'Związek Przedsiębiorców i Pracodawców',
      termin: '2017',
      proba: '1063 osoby, próba ogólnopolska reprezentatywna',
      pytanie: 'Podatek liniowy czy progresywny? (pytanie bez wyjaśnienia mechanizmu)',
      wyniki: [
        { etykieta: 'Bez zdania', procent: 69, kluczowy: true },
        { etykieta: 'Za liniowym', procent: 20 },
        { etykieta: 'Za progresją', procent: 10 },
      ],
      jakCzytac:
        'Najciekawsze badanie do komunikacji. Gdy tego samego respondenta zapytać z konkretnym przykładem kwotowym, poparcie dla liniowego rośnie trzykrotnie do 60 proc. Deklaracje o podatkach są kruche i podatne na framing, co działa w obie strony.',
      zrodlo: {
        tytul: 'Czego Polacy nie wiedzą o podatkach (badanie Maison dla ZPP)',
        url: 'https://zpp.net.pl/wp-content/uploads/2017/11/or9w4u_23.03.2017BadanieCzegoPolacyniewiedzopodatkach2.pdf',
        wydawca: 'ZPP',
        data: '2017',
      },
    },
    {
      id: 'pollster-2021-progresja',
      instytut: 'Instytut Badań Pollster',
      zleceniodawca: 'Super Express',
      termin: '19-20 maja 2021',
      proba: '1013 osób',
      pytanie: 'Czy osoby zarabiające ponad 10 000 zł brutto miesięcznie powinny płacić wyższe podatki niż obecnie?',
      wyniki: [
        { etykieta: 'Tak (za progresją)', procent: 54, kluczowy: true },
        { etykieta: 'Nie', procent: 35 },
        { etykieta: 'Brak opinii', procent: 11 },
      ],
      jakCzytac:
        'Pytane wprost o „czy bogatsi mają płacić więcej”, większość Polaków popiera progresję. To lustrzane odbicie CBOS i argument, że liniowy jest sprzeczny z dominującym poczuciem sprawiedliwości.',
      zrodlo: {
        tytul: 'Ponad połowa Polaków uważa, że bogaci powinni płacić wyższe podatki',
        url: 'https://www.bankier.pl/wiadomosc/Ponad-polowa-Polakow-uwaza-ze-bogaci-powinni-placic-wyzsze-podatki-Sondaz-8122298.html',
        wydawca: 'Bankier.pl',
        data: 'maj 2021',
      },
    },
  ],

  zagranica: [
    {
      kraj: 'Słowacja',
      opis: 'Wprowadziła sztandarowy liniowy 19 proc. (PIT, CIT, VAT) w 2004 r. jako symbol prorynkowej transformacji. Porzuciła go w 2013 r., dodając drugi próg 25 proc. Powód: niskie dochody budżetu, słaba ściągalność i wysokie obciążenie najgorzej zarabiających.',
      wniosek:
        'Kraj, który był ikoną podatku liniowego w regionie, sam go zdemontował po dekadzie. To najmocniejszy pojedynczy kontrargument.',
      zrodlo: {
        tytul: 'Slovakia to abandon flat tax',
        url: 'https://blogs.lse.ac.uk/europpblog/2013/03/18/slovakia-abandon-flat-tax/',
        wydawca: 'LSE EUROPP',
        data: '2013',
      },
    },
    {
      kraj: 'Czechy, Łotwa, Litwa, Rosja',
      opis: 'Wszystkie wycofały się z liniowego PIT: Łotwa w 2018 r., Litwa w 2019 r. (od 2026 trzy progi 20/25/32), Czechy w 2021 r. (próg 23 proc.), Rosja w 2021 r. (dalej zaostrzana do 22 proc. od 2025). Estonia została jedynym krajem bałtyckim z liniowym.',
      wniosek:
        'Trend regionalny idzie wyraźnie OD liniowego KU progresji. Narracja „region upraszcza podatki liniowym” jest nieprawdziwa. Branżowy magazyn ACCA podsumował to tytułem „Flat-tax revolution fades”.',
      zrodlo: {
        tytul: 'Flat-tax revolution fades',
        url: 'https://abmagazine.accaglobal.com/content/abmagazine/global/articles/2021/may/practice/Flat-tax-revolution-fades.html',
        wydawca: 'ACCA',
        data: '2021',
      },
    },
    {
      kraj: 'Bułgaria, Rumunia, Węgry',
      opis: 'Kraje UE, które przy liniowym zostały: Bułgaria i Rumunia 10 proc., Węgry 15 proc. Łączą go jednak z bardzo szeroką bazą, wysokim regresywnym VAT i niższymi wydatkami socjalnymi. To nie jest model „niskich podatków ogółem”, tylko przesunięcie ciężaru z dochodu na konsumpcję.',
      wniosek:
        'Stawka 12 proc. nie byłaby światowym ewenementem, ale w UE liniowy utrzymują tylko cztery kraje o innej strukturze państwa. Żaden duży kraj Zachodu (Niemcy, Francja, Włochy) nie ma liniowego PIT; stawki krańcowe sięgają tam 45-54 proc.',
      zrodlo: {
        tytul: 'Recent Changes in Top Personal Income Tax Rates in Europe',
        url: 'https://taxfoundation.org/data/all/eu/recent-changes-top-personal-income-tax-rates-europe-2021/',
        wydawca: 'Tax Foundation',
        data: '2021',
      },
    },
  ],

  politycy: [
    {
      id: 'mentzen',
      imieNazwisko: 'Sławomir Mentzen',
      funkcja: 'poseł, lider Nowej Nadziei',
      ugrupowanie: 'Konfederacja',
      stanowisko: 'Główny autor i twarz postulatu liniowego PIT.',
      slabyPunkt:
        'Broni liniowości argumentem, że bogaci i tak omijają próg 32 proc., co jednocześnie przyznaje, że reforma niewiele zmienia dla najbogatszych, a kosztuje 60 mld.',
      wypowiedzi: [
        {
          id: 'mentzen-najprostszy',
          cytat:
            'Będziemy mieli najprostszy system podatkowy w całej Unii Europejskiej. ZUS będzie dla przedsiębiorców dobrowolny, powrócimy też do składki zdrowotnej sprzed Nowego Ładu.',
          miejsce: 'Prezentacja programu kampanii prezydenckiej 2025',
          data: 'kampania prezydencka 2025',
          poCo: 'Pokazuje, że liniowość jest częścią szerszej obietnicy „najprostszego systemu w UE”. Prostota jest do przejęcia, liniowość nie.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Program Mentzena: reforma podatków, dobrowolny ZUS',
            url: 'https://www.pap.pl/aktualnosci/program-mentzena-nie-dla-aborcji-konkurencja-w-systemie-ochrony-zdrowia-i-reforma',
            wydawca: 'PAP',
            data: '2025',
          },
        },
      ],
    },
    {
      id: 'morawiecki',
      imieNazwisko: 'Mateusz Morawiecki',
      funkcja: 'poseł, były premier',
      ugrupowanie: 'Prawo i Sprawiedliwość',
      stanowisko: 'PiS został przy progresji (12/32 proc.) i podnoszeniu kwoty wolnej, nie poparł liniowości.',
      slabyPunkt: 'Podpisuje się pod częścią postulatów Konfederacji, ale nie pod liniowym PIT, co pokazuje, że nawet prawica uważa go za zbyt kosztowny.',
      wypowiedzi: [
        {
          id: 'morawiecki-podpisujemy',
          cytat:
            'Z programu Konfederacji jak najbardziej podpisujemy się pod postulatem, w którym również my mamy wiarygodność.',
          miejsce: 'Konferencja na Giełdzie Papierów Wartościowych, Warszawa',
          data: '17 listopada 2023',
          poCo: 'Wybiórcze poparcie PiS. Warto podkreślić, że pod liniowym PIT prawica się NIE podpisała, co izoluje ten postulat jako skrajny.',
          wiarygodnosc: 'relacja',
          zrodlo: {
            tytul: 'Premier obiecuje coś, czego nie chciał jego rząd. „Podpisujemy się”',
            url: 'https://biznes.interia.pl/podatki/news-premier-obiecuje-cos-czego-nie-chcial-jego-rzad-podpisujemy-,nId,7160494',
            wydawca: 'Interia Biznes',
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
      opis: 'Grupa, dla której liniowy PIT jest kwestią tożsamości, nie kalkulacji.',
      podstawa: 'CBOS 43/2025: jedyny elektorat z przewagą zwolenników liniowego (50% vs 39%).',
      kat: 'Prostota, nie spłaszczenie. Nie da się ich przekonać do progresji, ale można odebrać część, oferując prosty i stabilny system bez jednej stawki.',
      coDziala: [
        'Obietnica realnego uproszczenia rozliczeń i stabilności przepisów.',
        'Przyznanie, że dzisiejszy system jest absurdalnie skomplikowany (334 godziny rocznie na rozliczenia).',
      ],
      czegoUnikac: [
        'Moralizowania o „sprawiedliwości” progresji. Ta grupa słyszy w tym redystrybucję.',
        'Obrony status quo. Oni chcą zmiany, trzeba dać im inną zmianę niż liniowość.',
      ],
      kanaly: ['X', 'Podcasty gospodarcze', 'Media dla przedsiębiorców'],
      przyklad:
        'Nie obiecuję jednej stawki dla milionera i dla kasjerki. Słowacja próbowała i wycofała się po dekadzie. Obiecuję system, w którym rozliczenie zajmuje godziny, nie tygodnie.',
    },
    {
      id: 'rozczarowani-ko',
      nazwa: 'Rozczarowani Koalicją Obywatelską',
      opis: 'Wyborcy centrolewicy, dla których liniowy PIT jest odstraszający.',
      podstawa: 'CBOS 43/2025: elektorat KO w 48% za progresją, 38% za liniowym. Podzielony, ale przechylony ku progresji.',
      kat: 'Liniowy PIT jako prezent dla najbogatszych. Tu argument regresywności działa wprost.',
      coDziala: [
        'Konkret: kto ile zyskuje. Im wyższy dochód, tym większa korzyść.',
        'Koszt usług publicznych: 60 mld mniej to mniej na zdrowie i szkołę.',
      ],
      czegoUnikac: [
        'Języka antypodatkowego. Ta grupa nie utożsamia się z hasłem „państwo bierze za dużo”.',
      ],
      kanaly: ['Facebook', 'Prasa ogólnopolska', 'Radio'],
      przyklad:
        'Liniowy PIT 12% brzmi ładnie, dopóki nie policzysz, kto zyskuje najwięcej. Zyskuje najlepiej zarabiający, płaci wspólna kasa na szpitale. Słowacja to sprawdziła i zawróciła.',
    },
  ],

  luki: [
    'Postulat nie ma projektu ustawy, więc brak oficjalnego szacunku MF dla wariantu „liniowy 12% + likwidacja 32%”.',
    'Rozbicie kosztów FOR (60,5 / 33 / 47 mld) pochodzi z relacji medialnej, nie z odczytanego dokumentu FOR.',
    'Bieżące stawki liniowe Uzbekistanu i Mołdawii (12 proc.) do potwierdzenia w PwC Tax Summaries.',
    'Próba i dokładne brzmienie pytania CBOS z sierpnia 2023 do potwierdzenia w oryginalnym komunikacie.',
  ],
};
