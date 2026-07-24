/**
 * Formatowanie czasu na potrzeby interfejsu: odstępy i daty czytane słowami.
 * Polski, pełne wyrazy, bez skrótów typu "2h temu": doradca mówi zdaniami,
 * nie skrótami z czytnika RSS.
 *
 * Formatowanie liczb, kwot i dat z bazy (RRRR-MM-DD) mieszka w `format.ts`.
 * Tu są wyłącznie znaczniki czasu ISO.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Odmiana rzeczownika przez liczebnik: 1 minuta, 2 minuty, 5 minut. */
function plural(value: number, one: string, few: string, many: string): string {
  if (value === 1) return one;
  const rest10 = value % 10;
  const rest100 = value % 100;
  if (rest10 >= 2 && rest10 <= 4 && (rest100 < 10 || rest100 >= 20)) return few;
  return many;
}

/**
 * Odstęp czasu w formie czytanej: "przed chwilą", "3 godziny temu",
 * "wczoraj", a powyżej tygodnia konkretna data.
 */
export function relativeTime(iso: string | null): string {
  if (!iso) return 'bez daty';

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'bez daty';

  const diff = Date.now() - then;
  if (diff < 0) return formatLongDate(iso);
  if (diff < 2 * MINUTE) return 'przed chwilą';

  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes} ${plural(minutes, 'minutę', 'minuty', 'minut')} temu`;
  }

  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} ${plural(hours, 'godzinę', 'godziny', 'godzin')} temu`;
  }

  const days = Math.floor(diff / DAY);
  if (days === 1) return 'wczoraj';
  if (days < 7) return `${days} ${plural(days, 'dzień', 'dni', 'dni')} temu`;

  return formatLongDate(iso);
}

/** Znacznik ISO na zapis słowny: "22 lipca 2026". */
export function formatLongDate(iso: string | null): string {
  if (!iso) return 'bez daty';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'bez daty';
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Nagłówek dnia: "czwartek, 24 lipca". */
export function formatWeekday(date: Date): string {
  return date.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
