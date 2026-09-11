/**
 * Daty logiczne aplikacji.
 *
 * Argus liczy dobę w strefie Warszawy, nie w UTC. Różnica to jedna albo dwie
 * godziny po północy, ale wypada dokładnie tam, gdzie boli: brief dnia, wzmianki
 * „z dzisiaj" i odcięcie przyszłych posiedzeń Sejmu. Wołanie po północy czasu
 * polskiego trafiałoby w UTC na dzień poprzedni i pokazywało wczorajsze dane
 * jako dzisiejsze.
 *
 * Funkcja mieszka w osobnym module, a nie w `daily-brief.ts`, bo tamten ciągnie
 * za sobą model językowy, zoda i cztery kolektory newsów. Funkcje, którym
 * potrzebna jest wyłącznie data, nie mają powodu płacić za to przy starcie.
 */

/** Dzisiejsza data (YYYY-MM-DD) w strefie Warszawy. */
export function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}

/** Data sprzed `days` dni (YYYY-MM-DD), również w strefie Warszawy. */
export function daysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}
