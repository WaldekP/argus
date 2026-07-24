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
  aktualizacja: '24 lipca 2026',
  korpus: 'docs/konfederacja-podatki/',
  liczbaZrodel: 14,
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
  ],

  syntezaOpinii: [
    'Podniesienie kwoty wolnej jest popularne jako hasło, ale poparcie topnieje, gdy w pytaniu pojawia się cena. Szczegóły w temacie „Kwota wolna od podatku”.',
    'Sam pomysł indeksacji do płacy minimalnej nie był osobno badany sondażowo. Brak danych.',
    'Elektorat Konfederacji, do którego ten postulat jest adresowany, to w 52 proc. „aspirujący liberałowie” CBOS, wyróżniani poparciem dla niskich, prostych podatków.',
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
