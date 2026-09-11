import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { track } from '@/lib/analytics/posthog';
import { normalizePath } from '@/lib/screen-path';

/**
 * Wysyła `screen_view` przy każdej zmianie ekranu.
 *
 * Po co: zdarzenia akcji (wygenerowano przekaz, otwarto wzmiankę) mówią, co
 * ktoś kliknął, ale nie jak się porusza po aplikacji. Do pytania „jak pilot
 * z tego korzysta" potrzebna jest ścieżka: od czego zaczyna, gdzie zawraca,
 * których ekranów w ogóle nie otwiera.
 */
export function useScreenTracking(): void {
  const pathname = usePathname();
  // Ostatnio wysłany ekran: expo-router potrafi przerenderować tę samą trasę,
  // a powtórzone `screen_view` zafałszowałoby liczbę wejść.
  const ostatni = useRef<string | null>(null);

  useEffect(() => {
    const ekran = normalizePath(pathname);
    if (ekran === ostatni.current) return;
    ostatni.current = ekran;
    track('screen_view', { ekran });
  }, [pathname]);
}
