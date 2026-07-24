/**
 * Temat: likwidacja drugiego progu i liniowy PIT 12% (program Konfederacji 2023).
 * Postulat programowy bez projektu ustawy. Najostrzejszy fiskalnie i najbardziej
 * regresywny element pakietu.
 */

import type { Temat } from '../types';

export const pitLiniowy: Temat = {
  slug: 'pit-liniowy',
  nazwa: 'PIT liniowy 12% i likwidacja II progu',
  zajawka:
    'Jedna stawka 12% zamiast 12/32%. Postulat tożsamościowy Konfederacji, kosztowny i regresywny.',
  aktualizacja: '24 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 12,
  doWeryfikacji: 2,

  rekomendacja: {
    pytanie: 'Poprzeć, zignorować czy zaatakować postulat liniowego PIT 12%?',
    odpowiedz:
      'Nie przejmować. Przejąć hasło prostoty, ale zaatakować liniowość jako ulgę dla najbogatszych kosztem usług publicznych.',
    uzasadnienie: [
      'To jedyny postulat gospodarczy, który realnie spaja i wyróżnia elektorat Konfederacji, więc wejście w niego wprost oznacza granie na jego boisku i jego zasadami.',
      'Liniowy PIT jest w skali kraju rozwiązaniem mniejszościowym: popiera go 35 proc. Polaków wobec 51 proc. za progresją. Przejęcie go zniechęca szerszy elektorat, którego szukamy.',
      'Regresywność jest tu twardym, policzalnym argumentem, a nie kwestią gustu: korzyść rośnie z dochodem.',
    ],
    ryzyko: [
      'Poparcie dla podatku liniowego rośnie od 1997 r. (z 18 do 35 proc.). Atak zbyt frontalny może zrazić młodszą, aspirującą część elektoratu.',
      'Argument Mentzena, że drugi próg i tak jest omijany przez najbogatszych, jest częściowo trafny i trzeba mieć na niego odpowiedź.',
    ],
    podchwycic: [
      'Hasło prostoty systemu, nie jego spłaszczenia. Można obiecać mniej formularzy i stabilność przepisów bez rezygnacji z progresji.',
      'Krytyka daniny solidarnościowej i drugiego progu jako źle skonstruowanych da się przejąć bez wchodzenia w jedną stawkę dla wszystkich.',
    ],
    zaatakowac: [
      'Koszt: sam liniowy PIT 12% to ok. 60,5 mld zł ubytku rocznie (FOR), a cały pakiet Konfederacji to ok. 182 mld zł. To nie mieści się w żadnym realnym budżecie.',
      'Regresywność: im więcej zarabiasz, tym więcej zyskujesz. Przy jednoczesnej likwidacji ulg klasa średnia może nawet stracić. To ulga dla najlepiej zarabiających sprzedawana jako ulga dla wszystkich.',
      'Badania (choć zagraniczne) pokazują, że „niskie podatki dla bogatych” nie mają poparcia niezależnie od podawanych kosztów. Ta rama przegrywa.',
    ],
  },

  kluczoweLiczby: [
    {
      wartosc: '60,5 mld zł',
      opis: 'Roczny ubytek dochodów z samego liniowego PIT 12% według FOR.',
      doPublikacji: true,
    },
    {
      wartosc: '182 mld zł',
      opis: 'Szacowany koszt całego programu wyborczego Konfederacji według FOR.',
      doPublikacji: true,
    },
    {
      wartosc: '35% / 51%',
      opis: 'Poparcie dla podatku liniowego wobec progresji w skali kraju (CBOS 2025). Liniowy jest mniejszościowy.',
      doPublikacji: true,
    },
    {
      wartosc: '120 tys. zł',
      opis: 'Próg, od którego dziś obowiązuje stawka 32%. Konfederacja chce go zlikwidować.',
      doPublikacji: true,
    },
  ],

  syntezaOpinii: [
    'Podatek liniowy popiera 35 proc. Polaków, progresję 51 proc. (CBOS 43/2025). Ale poparcie dla liniowego rośnie nieprzerwanie od 1997 r., gdy wynosiło 18 proc.',
    'Elektorat Konfederacji to jedyny, w którym zwolennicy liniowego (50 proc.) przeważają nad zwolennikami progresji (39 proc.). To jego znak rozpoznawczy.',
    'Poparcie dla liniowego jest realnym, nie tylko deklaratywnym predyktorem głosu na Konfederację (regresja logistyczna CBOS).',
    'Uwaga strategiczna: baza Konfederacji nie jest spójnie wolnorynkowa. 68 proc. jej wyborców chce państwa opiekuńczego, 57 proc. chce utrzymania własności państwowej. Radykalna liniowość wyprzedza poglądy własnego elektoratu poza samą stawką.',
  ],

  politycy: [
    {
      id: 'mentzen',
      imieNazwisko: 'Sławomir Mentzen',
      funkcja: 'poseł, lider Nowej Nadziei',
      ugrupowanie: 'Konfederacja',
      stanowisko: 'Główny autor i twarz postulatu liniowego PIT.',
      slabyPunkt:
        'Broni liniowości argumentem, że bogaci i tak omijają próg 32%, co jednocześnie przyznaje, że reforma niewiele zmienia dla najbogatszych, a kosztuje 60 mld.',
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
      stanowisko: 'PiS został przy progresji (12/32%) i podnoszeniu kwoty wolnej, nie poparł liniowości.',
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
        'Nie obiecuję jednej stawki dla milionera i dla kasjerki, bo to kosztuje 60 miliardów i pomaga głównie najbogatszym. Obiecuję system, w którym rozliczenie zajmuje godziny, nie tygodnie.',
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
        'Liniowy PIT 12% brzmi ładnie, dopóki nie policzysz, kto zyskuje najwięcej. Zyskuje najlepiej zarabiający, płaci wspólna kasa na szpitale.',
    },
  ],

  luki: [
    'Postulat nie ma projektu ustawy, więc brak oficjalnego szacunku MF dla wariantu „liniowy 12% + likwidacja 32%”.',
    'Rozbicie kosztów FOR (60,5 / 33 / 47 mld) pochodzi z relacji medialnej, nie z odczytanego dokumentu FOR.',
    'Badanie o braku poparcia dla „niskich podatków dla bogatych” (Bremer, Bürgisser) dotyczy czterech krajów zachodnich, nie Polski. Ostrożnie z ekstrapolacją.',
  ],
};
