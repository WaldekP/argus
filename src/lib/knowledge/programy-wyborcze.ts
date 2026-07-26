/**
 * Programy wyborcze partii sejmowych 2011-2023: metadane plików PDF
 * trzymanych w publicznym buckecie Storage `programy-wyborcze`.
 * Źródła i audyt pochodzenia: docs/programy-wyborcze/README.md.
 * Mniejszość Niemiecka pominięta (decyzja usera, 2026-07-25).
 */

export type ProgramWyborczy = {
  /** Rok wyborów do Sejmu. */
  rok: 2011 | 2015 | 2019 | 2023;
  /** Nazwa komitetu w brzmieniu z danego roku. */
  partia: string;
  /** Tytuł dokumentu programowego. */
  tytul: string;
  /** Nazwa pliku w buckecie (w katalogu roku). */
  plik: string;
  /** Rozmiar pliku, do pokazania przy przycisku pobierania. */
  rozmiar: string;
  /** Kontekst wart pokazania przy dokumencie (np. że to część programu). */
  uwaga?: string;
  /**
   * Podsumowanie rozwijane na karcie, warstwowo. Streszczenie to neutralny
   * opis najważniejszych postulatów, dwa pozostałe pola to analiza pod strategię
   * tenanta (co przejąć, gdzie atakować). Wyciągnięte z dokumentów źródłowych;
   * na razie tylko elekcje 2019 i 2023.
   */
  podsumowanie?: {
    /** Najważniejsze postulaty programu, rzeczowo. */
    streszczenie: string;
    /** Co z programu warto przejąć dla elektoratu wolnościowo-liberalnego. */
    podchwycic: string;
    /** Gdzie program jest słaby lub sprzeczny z tym elektoratem. */
    uderzyc: string;
  };
};

export const PROGRAMY_WYBORCZE: ProgramWyborczy[] = [
  // 2023
  {
    rok: 2023,
    partia: 'Prawo i Sprawiedliwość',
    tytul: 'Bezpieczna Przyszłość Polaków',
    plik: '2023-pis-bezpieczna-przyszlosc-polakow.pdf',
    rozmiar: '8,1 MB',
    podsumowanie: {
      streszczenie:
        'Bilans ośmiu lat rządów i obietnica kontynuacji. Filary: 800 plus, trzynasta i czternasta emerytura na stałe, emerytury stażowe, kwota wolna 30 tys. zł, PIT 12 procent, obronność do 4,5 procent PKB i armia 300 tys. żołnierzy, energetyka jądrowa, twarda granica i sprzeciw wobec relokacji migrantów. Oś to silne, opiekuńcze państwo i suwerenność wobec Unii.',
      podchwycic:
        'Rozwiązania proprzedsiębiorcze (CIT 9 procent, niższy PIT, mały ZUS) można licytować w górę, oferując jeszcze niższe i prostsze podatki.',
      uderzyc:
        'Etatyzm i rozdawnictwo, upolitycznione spółki Skarbu Państwa, kaucja wizowa dla pracodawców, konserwatyzm obyczajowy, praworządność. Popularne świadczenia atakuj od strony kosztu i formy, nie samego istnienia.',
    },
  },
  {
    rok: 2023,
    partia: 'Koalicja Obywatelska',
    tytul: '100 konkretów na pierwsze 100 dni rządów',
    plik: '2023-ko-100-konkretow.pdf',
    rozmiar: '0,6 MB',
    uwaga: 'Wersja dokumentowa programu publikowanego głównie jako strona 100konkretow.pl.',
    podsumowanie: {
      streszczenie:
        'Lista mierzalnych obietnic z datą. Sztandarowe: kwota wolna 60 tys. zł, zerowy PIT do 6000 zł brutto, zniesienie podatku Belki, babciowe 1500 zł, in vitro z budżetu, aborcja do 12. tygodnia, związki partnerskie, likwidacja Funduszu Kościelnego, praworządność i odblokowanie środków unijnych. Ton: rozliczenie PiS i hojna redystrybucja.',
      podchwycic:
        'Kwota wolna 60 tys. zł, liberalizm obyczajowy, świeckość i praworządność to wspólny grunt z rozczarowanymi wyborcami Koalicji Obywatelskiej.',
      uderzyc:
        'Najmocniejszy argument to zestawienie konkretów z datą z ich wykonaniem po dwóch latach rządu (związki, aborcja, kwota wolna niedowiezione). Do tego przewaga transferów nad realną deregulacją.',
    },
  },
  {
    rok: 2023,
    partia: 'Trzecia Droga',
    tytul: 'Wspólna Lista Spraw',
    plik: '2023-trzecia-droga-wspolna-lista-spraw.pdf',
    rozmiar: '0,1 MB',
    uwaga: 'Koalicja nie wydała jednego programu; to pierwszy z dwóch dokumentów składowych.',
    podsumowanie: {
      streszczenie:
        'Krótka deklaracja ideowo-ustrojowa koalicji PSL i Polski 2050. Oś to praworządność, odpartyjnienie państwa i świeckość. W gospodarce jedna danina od pracy, uregulowanie składki zdrowotnej po Polskim Ładzie, stabilność podatkowa i francuski model rozliczeń z dziećmi. Aborcja przez ustawę, potem referendum.',
      podchwycic:
        'Uproszczenie podatków, ulga w składce zdrowotnej i przewidywalność prawa to najbliższy nam fragment i pomost do sierot po Trzeciej Drodze.',
      uderzyc:
        'Dokument nie ma twardej oferty niskopodatkowej (brak kwoty wolnej, dobrowolnego ZUS, PIT liniowego), a formuły kompromisowe jak aborcja przez referendum czytają się jako rozmycie. To luka do zajęcia jasną, wolnościową ofertą.',
    },
  },
  {
    rok: 2023,
    partia: 'Trzecia Droga',
    tytul: '12 Gwarancji Trzeciej Drogi',
    plik: '2023-trzecia-droga-12-gwarancji.pdf',
    rozmiar: '2,7 MB',
    uwaga: 'Drugi z dwóch dokumentów składowych programu koalicji.',
    podsumowanie: {
      streszczenie:
        'Druga część programu koalicji, dwanaście konkretnych gwarancji. Gospodarka: jedna danina, zakaz podwyżek PIT, CIT i VAT przez kadencję, wakacje składkowe ZUS dla mikrofirm, cofnięcie składki zdrowotnej z Polskiego Ładu, Rodzinny PIT. Społecznie: 6 procent PKB na edukację, 7 procent na zdrowie, wizyta u specjalisty w 60 dni. Do tego protekcjonizm rolny wobec importu z Ukrainy.',
      podchwycic:
        'Ulga składkowa dla przedsiębiorców, stabilność podatkowa oraz urynkowienie spółek i energetyki pokrywają się z ofertą wolnościową.',
      uderzyc:
        'Dobrowolny ZUS obejmuje tylko mikrofirmy zagrożone niewypłacalnością, więc to półśrodek. Preambuła mówi dość rozdawnictwu, a program mnoży cele wydatkowe. Protekcjonizm rolny PSL to twarda linia podziału z proeuropejskim pozycjonowaniem.',
    },
  },
  {
    rok: 2023,
    partia: 'Nowa Lewica',
    tytul: 'Program wyborczy KW Nowa Lewica (155 punktów)',
    plik: '2023-lewica-program-wyborczy.pdf',
    rozmiar: '0,2 MB',
    podsumowanie: {
      streszczenie:
        'Program 155 punktów, socjaldemokracja z liberalizmem obyczajowym. Gospodarka: progresja PIT, podatki od korporacji i nadmiarowych zysków, płaca minimalna 66 procent średniej, 300 tys. mieszkań na tani wynajem, 8 procent PKB na zdrowie. Światopogląd: aborcja do 12. tygodnia, wypowiedzenie konkordatu, równość małżeńska, legalizacja marihuany, mapa drogowa do euro.',
      podchwycic:
        'Wspólny grunt to wyłącznie druga oś: świeckość, prawa kobiet, in vitro i prawa mniejszości, ale ujęte w języku wolności jednostki, nie sprawiedliwości społecznej.',
      uderzyc:
        'Cała ekonomia jest przeciwna: progresja, podatki dla firm, 100 procent płacy na zwolnieniu, obowiązkowa reprezentacja pracownicza, regulacja czynszów, sprzeciw wobec prywatyzacji. Czysta linia sporu: wolny rynek kontra etatyzm.',
    },
  },
  {
    rok: 2023,
    partia: 'Konfederacja',
    tytul: 'Konstytucja Wolności',
    plik: '2023-konfederacja-konstytucja-wolnosci.pdf',
    rozmiar: '21 MB',
    podsumowanie: {
      streszczenie:
        'Program celowo ekonomiczno-wolnościowy i suwerennościowy. Piątka podatkowa Mentzena: kwota wolna 43 200 zł, PIT liniowy 12 procent, zniesienie podatku Belki, dobrowolny ZUS etapami, likwidacja 15 podatków. Do tego bon edukacyjny, rozbicie monopolu NFZ, mieszkania tańsze o 30 procent od strony podaży, antyunijność i obrona węgla. Aborcji i praw mniejszości w tym dokumencie brak, twarzą jest Mentzen, nie Braun.',
      podchwycic:
        'Około dwie trzecie tekstu to język wolnościowy słowo w słowo: dobrowolny ZUS, niskie proste podatki, deregulacja, rynek w usługach publicznych. To najważniejszy elektorat, bo ten wyborca głosował na ekonomię, nie na wojnę kulturową.',
      uderzyc:
        'Klin przebiega po antyunijności i groźbie polexitu, radykalizmie i postaci Brauna, antyklimatycznej krucjacie oraz konfrontacyjnym tonie. Oferta: ta sama wolność gospodarcza, ale w Europie i bez wojny kulturowej.',
    },
  },
  // 2019
  {
    rok: 2019,
    partia: 'Prawo i Sprawiedliwość',
    tytul: 'Polski model państwa dobrobytu',
    plik: '2019-pis-polski-model-panstwa-dobrobytu.pdf',
    rozmiar: '5,1 MB',
    podsumowanie: {
      streszczenie:
        'Fundament etatystyczno-konserwatywnej tożsamości PiS. 500 plus na każde dziecko, trzynasta emerytura, PIT 17 procent i zerowy PIT do 26. roku życia, CIT 9 procent, płaca minimalna do 4000 zł w 2023. Repolonizacja banków i mediów, obrona rodziny naturalnej i bariery dla ideologii gender.',
      podchwycic:
        'CIT 9 procent, mały ZUS i ulga na start to rozwiązania bliskie wolnościowcom, warte licytowania w górę.',
      uderzyc:
        'Konserwatyzm obyczajowy, etatyzm i interwencjonizm (repolonizacja, bariery dla kapitału), praworządność. To najsilniejsza i najbardziej różnicująca oś sporu.',
    },
  },
  {
    rok: 2019,
    partia: 'Koalicja Obywatelska',
    tytul: 'Twoja Polska',
    plik: '2019-ko-twoja-polska.pdf',
    rozmiar: '2,4 MB',
    podsumowanie: {
      streszczenie:
        'Najbardziej liberalny gospodarczo program tej stawki, współtworzony w koalicji z Nowoczesną. Estoński CIT, niższy ZUS, dyscyplina fiskalna z długiem poniżej 30 procent PKB, zasada dwa za jeden przy nowych obowiązkach, zniesienie zakazu handlu w niedziele, związki partnerskie, in vitro. Oś: odbudowa praworządności kontra państwo partyjne, dobrobyt z pracy zamiast transferów.',
      podchwycic:
        'Rozdział gospodarczy jest blisko naszego DNA (estoński CIT, prostsze podatki, dyscyplina fiskalna), a warstwa obyczajowa daje liberalizm bez klerykalnego bagażu.',
      uderzyc:
        'Etatyzm w liberalnym opakowaniu (transfery pod hasłem praca się opłaca), parytety w spółkach, brak odwagi prywatyzacyjnej, bliskość establishmentu i nostalgia za PO.',
    },
  },
  {
    rok: 2019,
    partia: 'Lewica (lista SLD)',
    tytul: 'Polska jutra. Główne postulaty Lewicy',
    plik: '2019-lewica-polska-jutra.pdf',
    rozmiar: '0,8 MB',
    uwaga: 'Lewica nie wydała pełnego programu; pełna wersja istniała jako strona WWW.',
    podsumowanie: {
      streszczenie:
        'Socjaldemokracja policzona co do złotówki. Dobrowolny proporcjonalny ZUS, milion mieszkań przez państwowego dewelopera, emerytura minimalna 1600 zł, leki do 5 zł, świeckość państwa z opodatkowaniem Kościoła i religią poza szkołą, aborcja do 12. tygodnia, równość małżeńska, parytety.',
      podchwycic:
        'Część wspólna to świeckość i prawa osobiste oraz deregulacyjny wątek dobrowolnego, proporcjonalnego ZUS.',
      uderzyc:
        'Państwo jako deweloper i inwestor, nowe podatki, sztywna płaca minimalna. Linia: zgoda na świeckie państwo i wolność osobistą, nie na wyższe podatki za te wolności.',
    },
  },
  {
    rok: 2019,
    partia: 'PSL i Kukiz’15 (Koalicja Polska)',
    tytul: 'Łączymy Polaków',
    plik: '2019-psl-kp-laczymy-polakow.pdf',
    rozmiar: '1,1 MB',
    podsumowanie: {
      streszczenie:
        'Program agrarno-samorządowy i socjalny w treści, obywatelsko-ustrojowy w formie. Dobrowolny ZUS dla przedsiębiorcy, emerytura bez PIT, 50 tys. zł na pierwsze mieszkanie i 50 tys. na start, ziemia za złotówkę, silny agraryzm z dopłatami 1200 zł na hektar i blokadą umowy z Mercosur, JOW i wiążące referenda.',
      podchwycic:
        'Dobrowolny ZUS dla przedsiębiorcy to sztandarowy punkt styku, dowód, że odciążenie samozatrudnionych jest w centrum debaty, nie na skraju.',
      uderzyc:
        'Rozdawnictwo obok deregulacji, brak kwoty wolnej i liniowego PIT, protekcjonizm rolny. Warto dystansować się od plebiscytowego skrzydła po Kukizie.',
    },
  },
  {
    rok: 2019,
    partia: 'Konfederacja',
    tytul: 'Polska dla Ciebie',
    plik: '2019-konfederacja-polska-dla-ciebie.pdf',
    rozmiar: '6,0 MB',
    podsumowanie: {
      streszczenie:
        'Program wokół Piątki Konfederacji. Wolnościowa ekonomia (PIT 0 procent jako powszechna ulga, dobrowolny ZUS, paliwo 3 zł za litr, deregulacja) zrośnięta z narodowo-konserwatywnym światopoglądem: ochrona życia od poczęcia, sprzeciw wobec edukacji o LGBT, bon oświatowy, antyimigracja, eurosceptycyzm, powszechny dostęp do broni.',
      podchwycic:
        'Cały filar ekonomiczny to język liberała gospodarczego: niskie podatki, dobrowolny ZUS, mniejsze państwo, deregulacja.',
      uderzyc:
        'Klin po linii obyczaj (aborcja, prawa mniejszości), radykalizm (broń, antyimigracja) oraz stosunek do Unii i klimatu. Przekaz: ta sama ekonomia, bez wojny kulturowej i bez antyunijności.',
    },
  },
  // 2015
  {
    rok: 2015,
    partia: 'Prawo i Sprawiedliwość',
    tytul: 'Zdrowie, Praca, Rodzina (program 2014)',
    plik: '2015-pis-zdrowie-praca-rodzina.pdf',
    rozmiar: '0,8 MB',
  },
  {
    rok: 2015,
    partia: 'Platforma Obywatelska',
    tytul: 'Polska Przyszłości',
    plik: '2015-po-polska-przyszlosci.pdf',
    rozmiar: '11 MB',
  },
  {
    rok: 2015,
    partia: 'Kukiz’15',
    tytul: 'Strategia Zmiany',
    plik: '2015-kukiz15-strategia-zmiany.pdf',
    rozmiar: '0,2 MB',
  },
  {
    rok: 2015,
    partia: 'Nowoczesna',
    tytul: 'Nowa Polska — teraz! Kierunki programu',
    plik: '2015-nowoczesna-kierunki-programu.pdf',
    rozmiar: '3,3 MB',
    uwaga: 'Jedyny dokument programowy z kampanii 2015; pełny program partia wydała w 2016.',
  },
  {
    rok: 2015,
    partia: 'Polskie Stronnictwo Ludowe',
    tytul: 'Deklaracja wyborcza. Blisko ludzkich spraw',
    plik: '2015-psl-blisko-ludzkich-spraw.pdf',
    rozmiar: '0,2 MB',
  },
  // 2011
  {
    rok: 2011,
    partia: 'Platforma Obywatelska',
    tytul: 'Następny krok. Razem',
    plik: '2011-po-nastepny-krok-razem.pdf',
    rozmiar: '2,5 MB',
  },
  {
    rok: 2011,
    partia: 'Prawo i Sprawiedliwość',
    tytul: 'Nowoczesna Solidarna Bezpieczna Polska',
    plik: '2011-pis-nowoczesna-solidarna-bezpieczna-polska.pdf',
    rozmiar: '1,3 MB',
  },
  {
    rok: 2011,
    partia: 'Ruch Palikota',
    tytul: 'Nowoczesne Państwo',
    plik: '2011-ruch-palikota-nowoczesne-panstwo.pdf',
    rozmiar: '0,2 MB',
  },
  {
    rok: 2011,
    partia: 'Polskie Stronnictwo Ludowe',
    tytul: 'Program Wyborczy PSL (Człowiek jest najważniejszy)',
    plik: '2011-psl-czlowiek-jest-najwazniejszy.pdf',
    rozmiar: '0,2 MB',
  },
  {
    rok: 2011,
    partia: 'Sojusz Lewicy Demokratycznej',
    tytul: 'Jutro bez obaw. Program dla Polski',
    plik: '2011-sld-jutro-bez-obaw.pdf',
    rozmiar: '2,5 MB',
  },
];

/** Lata wyborów od najnowszych, do sekcji na ekranie. */
export const LATA_PROGRAMOW = [...new Set(PROGRAMY_WYBORCZE.map((p) => p.rok))].sort(
  (a, b) => b - a
);

export function programyZRoku(rok: number): ProgramWyborczy[] {
  return PROGRAMY_WYBORCZE.filter((p) => p.rok === rok);
}

/** Publiczny URL pliku w Storage (bucket `programy-wyborcze`, katalog = rok). */
export function urlProgramu(program: ProgramWyborczy): string {
  const baza = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${baza}/storage/v1/object/public/programy-wyborcze/${program.rok}/${encodeURIComponent(
    program.plik
  )}`;
}
