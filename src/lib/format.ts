/** Helpery formatowania tekstów UI (po polsku). */

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
