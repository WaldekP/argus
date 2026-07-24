/**
 * Model danych tematycznej bazy wiedzy (korpus per temat programowy).
 *
 * Źródło treści: docs/<temat>/. Na tym etapie dane są seedowane w module TS,
 * docelowo wjadą do tabeli `knowledge_docs` z embeddingami i będą pobierane
 * przez Edge Function. Kształt typów jest już docelowy, więc podmiana źródła
 * nie zmieni ekranów.
 */

/** Jak mocne jest źródło cytatu. Decyduje, czy wolno go użyć publicznie. */
export type Wiarygodnosc = 'stenogram' | 'relacja' | 'wideo';

export type Zrodlo = {
  tytul: string;
  url: string;
  /** Instytucja albo redakcja, np. "CBOS", "TVN24". */
  wydawca: string;
  /** Data publikacji w formacie czytelnym dla człowieka. */
  data: string;
};

/** Pojedyncza wypowiedź polityka, gotowa do przywołania w sporze. */
export type Wypowiedz = {
  id: string;
  cytat: string;
  /** Gdzie padła: program, konwencja, wywiad. */
  miejsce: string;
  /** Kiedy padła. */
  data: string;
  /** Po co ten cytat jest w bazie: co nim udowadniamy. */
  poCo: string;
  wiarygodnosc: Wiarygodnosc;
  zrodlo: Zrodlo;
};

export type Polityk = {
  id: string;
  imieNazwisko: string;
  funkcja: string;
  ugrupowanie: string;
  /** Stanowisko w jednym zdaniu. */
  stanowisko: string;
  /** Najsłabszy punkt tej osoby w tym temacie. */
  slabyPunkt: string;
  wypowiedzi: Wypowiedz[];
};

export type WynikBadania = {
  etykieta: string;
  /** Wartość w procentach. */
  procent: number;
  /** Wyróżnienie na wykresie (odpowiedź kluczowa dla wniosku). */
  kluczowy?: boolean;
};

export type Badanie = {
  id: string;
  instytut: string;
  zleceniodawca: string;
  termin: string;
  proba: string;
  pytanie: string;
  wyniki: WynikBadania[];
  /** Jak to czytać i czego z tego nie wywnioskować. */
  jakCzytac: string;
  zrodlo: Zrodlo;
};

/** Grupa odbiorców z gotowym playbookiem komunikacyjnym. */
export type SegmentOdbiorcow = {
  id: string;
  nazwa: string;
  opis: string;
  /** Skąd wiemy, że ta grupa tak ma. Puste = ocena strategiczna, nie dane. */
  podstawa: string;
  /** Rekomendowany kąt przekazu. */
  kat: string;
  coDziala: string[];
  czegoUnikac: string[];
  kanaly: string[];
  /** Gotowy przykład sformułowania. */
  przyklad: string;
};

/** Liczba, którą warto mieć w głowie przed wejściem do studia. */
export type KluczowaLiczba = {
  wartosc: string;
  opis: string;
  /** Czy nadaje się do publicznego użycia. */
  doPublikacji: boolean;
};

export type Rekomendacja = {
  /** Pytanie, na które ten temat ma odpowiedzieć. */
  pytanie: string;
  /** Rekomendowana odpowiedź, jedno zdanie. */
  odpowiedz: string;
  uzasadnienie: string[];
  /** Co przemawia przeciw. Zawsze wypełnione. */
  ryzyko: string[];
};

export type Temat = {
  slug: string;
  nazwa: string;
  /** Krótki opis pod tytułem na liście. */
  zajawka: string;
  /** Data ostatniej aktualizacji korpusu. */
  aktualizacja: string;
  /** Katalog źródłowy w repo. */
  korpus: string;
  liczbaZrodel: number;
  /** Ile danych czeka na weryfikację (nie do publikacji). */
  doWeryfikacji: number;
  rekomendacja: Rekomendacja;
  kluczoweLiczby: KluczowaLiczba[];
  badania: Badanie[];
  /** Synteza opinii społecznej w kilku zdaniach. */
  syntezaOpinii: string[];
  politycy: Polityk[];
  segmenty: SegmentOdbiorcow[];
  /** Czego w korpusie nie ma. Uczciwość wobec użytkownika. */
  luki: string[];
};
