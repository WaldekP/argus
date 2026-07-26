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
};

export const PROGRAMY_WYBORCZE: ProgramWyborczy[] = [
  // 2023
  {
    rok: 2023,
    partia: 'Prawo i Sprawiedliwość',
    tytul: 'Bezpieczna Przyszłość Polaków',
    plik: '2023-pis-bezpieczna-przyszlosc-polakow.pdf',
    rozmiar: '8,1 MB',
  },
  {
    rok: 2023,
    partia: 'Koalicja Obywatelska',
    tytul: '100 konkretów na pierwsze 100 dni rządów',
    plik: '2023-ko-100-konkretow.pdf',
    rozmiar: '0,6 MB',
    uwaga: 'Wersja dokumentowa programu publikowanego głównie jako strona 100konkretow.pl.',
  },
  {
    rok: 2023,
    partia: 'Trzecia Droga',
    tytul: 'Wspólna Lista Spraw',
    plik: '2023-trzecia-droga-wspolna-lista-spraw.pdf',
    rozmiar: '0,1 MB',
    uwaga: 'Koalicja nie wydała jednego programu; to pierwszy z dwóch dokumentów składowych.',
  },
  {
    rok: 2023,
    partia: 'Trzecia Droga',
    tytul: '12 Gwarancji Trzeciej Drogi',
    plik: '2023-trzecia-droga-12-gwarancji.pdf',
    rozmiar: '2,7 MB',
    uwaga: 'Drugi z dwóch dokumentów składowych programu koalicji.',
  },
  {
    rok: 2023,
    partia: 'Nowa Lewica',
    tytul: 'Program wyborczy KW Nowa Lewica (155 punktów)',
    plik: '2023-lewica-program-wyborczy.pdf',
    rozmiar: '0,2 MB',
  },
  {
    rok: 2023,
    partia: 'Konfederacja',
    tytul: 'Konstytucja Wolności',
    plik: '2023-konfederacja-konstytucja-wolnosci.pdf',
    rozmiar: '21 MB',
  },
  // 2019
  {
    rok: 2019,
    partia: 'Prawo i Sprawiedliwość',
    tytul: 'Polski model państwa dobrobytu',
    plik: '2019-pis-polski-model-panstwa-dobrobytu.pdf',
    rozmiar: '5,1 MB',
  },
  {
    rok: 2019,
    partia: 'Koalicja Obywatelska',
    tytul: 'Twoja Polska',
    plik: '2019-ko-twoja-polska.pdf',
    rozmiar: '2,4 MB',
  },
  {
    rok: 2019,
    partia: 'Lewica (lista SLD)',
    tytul: 'Polska jutra. Główne postulaty Lewicy',
    plik: '2019-lewica-polska-jutra.pdf',
    rozmiar: '0,8 MB',
    uwaga: 'Lewica nie wydała pełnego programu; pełna wersja istniała jako strona WWW.',
  },
  {
    rok: 2019,
    partia: 'PSL i Kukiz’15 (Koalicja Polska)',
    tytul: 'Łączymy Polaków',
    plik: '2019-psl-kp-laczymy-polakow.pdf',
    rozmiar: '1,1 MB',
  },
  {
    rok: 2019,
    partia: 'Konfederacja',
    tytul: 'Polska dla Ciebie',
    plik: '2019-konfederacja-polska-dla-ciebie.pdf',
    rozmiar: '6,0 MB',
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
