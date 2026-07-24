/**
 * Helpery formatowania tekstów UI (po polsku).
 *
 * Konwencja dla danych z rejestru: brak danych zawsze jako „brak danych",
 * nigdy jako zero ani pusty tekst, bo zero to konkretna informacja.
 */

const MONTHS_GENITIVE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
] as const;

/**
 * Data w formacie "23 lipca 2026". Bez zależności od Intl
 * (spójny wynik na iOS, Androidzie i webie). Nieparsowalna data = pusty tekst.
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Data w zapisie DD.MM.RRRR. Osobno od `formatDate`, bo w gęstych kartach
 * rejestrowych (rola, kapitał, sprawozdanie obok siebie) zapis słowny się nie
 * mieści, a brak daty musi być widoczny jako „brak danych", nie jako pustka.
 */
export function formatDateNumeric(value: string | null | undefined): string {
  if (!value) return 'brak danych';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return 'brak danych';
  return `${day}.${month}.${year}`;
}

/** Sam rok z daty. Do etykiet okresów rozliczeniowych. */
export function formatYear(value: string | null | undefined): string {
  if (!value) return 'brak danych';
  return value.slice(0, 4);
}

/**
 * Polska liczba mnoga: 1 wariant, 2-4 warianty, 5+ wariantów
 * (z wyjątkiem 12-14). Zwraca tekst razem z liczbą.
 */
export function polishPlural(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count);
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (abs === 1) {
    return `${count} ${one}`;
  }
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} ${few}`;
  }
  return `${count} ${many}`;
}

/**
 * Kwota w formacie polskim, ze spacją nierozdzielającą jako separatorem tysięcy.
 * Duże liczby skracamy do mln, bo kapitał zakładowy w pełnym zapisie rozsadza
 * kartę, a różnica między 46 580 831 a 46,6 mln nie zmienia decyzji.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined = 'PLN',
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'brak danych';
  }
  const unit = currency ?? 'PLN';
  const abs = Math.abs(amount);

  if (abs >= 1_000_000) {
    const millions = amount / 1_000_000;
    const rounded = millions.toFixed(millions >= 100 ? 0 : 1).replace('.', ',');
    return `${rounded} mln ${unit}`;
  }
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString('pl-PL').replace(/ /g, ' ')} ${unit}`;
}

/** Ile pełnych lat minęło od daty. Null gdy daty nie znamy. */
export function yearsSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  const diff = Date.now() - start.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

/** Staż w latach: 1 rok, 2 lata, 5 lat. */
export function yearsLabel(years: number): string {
  // "0 lat" brzmi jak błąd, a chodzi o powiązanie młodsze niż rok.
  if (years === 0) return 'poniżej roku';
  return polishPlural(years, 'rok', 'lata', 'lat');
}
