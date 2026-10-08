/**
 * Formatowanie pozycji teczki oponenta na ekranie. Osobno od klienta API,
 * bo ten ciągnie Supabase i React Native, a to ma być testowalne w Node.
 */

/** Data pozycji po polsku: „14.03.2026", „03.2026" albo „bez daty". */
export function formatItemDate(date: string | null): string {
  if (!date) return 'bez daty';
  const [year, month, day] = date.split('-');
  return day ? `${day}.${month}.${year}` : `${month}.${year}`;
}

/** Czy cytat jest parafrazą (model oznacza to prefiksem). */
export function isParaphrase(quote: string): boolean {
  return quote.trimStart().toLowerCase().startsWith('[parafraza]');
}

/** Cytat bez znacznika parafrazy, do wyświetlenia. */
export function quoteText(quote: string): string {
  return quote.replace(/^\s*\[parafraza\]\s*/i, '');
}

/** Host źródła do etykiety linku („rmf24.pl"). */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
