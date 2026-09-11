/**
 * Normalizacja ścieżki ekranu na potrzeby analityki.
 *
 * Moduł jest celowo czysty, bez importów z React Native i expo-router, żeby dał
 * się przetestować runnerem Node (konwencja repo: testujemy logikę, nie render).
 * Hook wysyłający zdarzenia siedzi w `@/hooks/use-screen-tracking`.
 *
 * Po co normalizacja: bez niej do PostHoga wychodzą identyfikatory briefów
 * i analiz, a statystyki rozsypują się na setki jednorazowych ścieżek
 * `/brief/<uuid>`, z których nic nie da się policzyć.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** `/brief/f8182c0a-...` → `/brief/:id`, `/brief-poranny/2026-09-11` → `/brief-poranny/:date`. */
export function normalizePath(pathname: string): string {
  const segmenty = pathname.split('/').map((s) => {
    if (UUID.test(s)) return ':id';
    if (DATA.test(s)) return ':date';
    return s;
  });
  const sciezka = segmenty.join('/');
  return sciezka.length > 1 && sciezka.endsWith('/') ? sciezka.slice(0, -1) : sciezka;
}
