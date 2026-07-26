/**
 * Jedyne źródło kolorów w aplikacji. Zero hardkodowanych hexów w komponentach.
 *
 * Kierunek (decyzja usera 2026-07-26): nowoczesny, czysty minimalizm zamiast
 * dawnego "pergamin + złoto". Neutralne, chłodne powierzchnie (biel / grafit),
 * subtelne szare obramowania zamiast złotych linii, jeden zdecydowany akcent
 * (granatowy błękit). Kolory ról (dane, sukces, alert) czytelne i współczesne.
 *
 * Oba motywy są w użyciu: jasny jest domyślny, ciemny włącza przełącznik
 * w Profilu (store src/store/theme.ts). Zmieniając kolory, sprawdzaj oba zestawy.
 * Zasada: akcent oszczędnie, hierarchię buduje kontrast powierzchni i światło,
 * nie kolorowe ramki.
 */

export const Colors = {
  dark: {
    /** Główne tło ekranów: głęboki chłodny grafit (atrament). */
    background: '#0F1420',
    /** Tło głębsze: krawędzie, gradienty, cień */
    backgroundDeep: '#0A0E17',
    /** Karty, modale, pola */
    card: '#161C29',
    /** Drugi ton kart, wiersze, stany zaznaczenia */
    cardAlt: '#1D2434',
    /** Tekst główny (nigdy czysta biel) */
    text: '#F2F4F8',
    /** Akapity (tekst ~76%) */
    text80: 'rgba(242,244,248,0.76)',
    /** Podpisy, meta (tekst ~55%) */
    textSecondary: 'rgba(242,244,248,0.55)',
    /** Akcent: błękit, elementy interaktywne, kluczowe akcenty */
    accent: '#6E88FF',
    /** Akcent jasny: hover, podświetlenia, tekst chipów */
    accentLight: '#93A9FF',
    /** Tło głównych przycisków (CTA) */
    cta: '#5A78F0',
    /** Tekst na tle akcentu/CTA */
    onAccent: '#FFFFFF',
    /** Teal: dane, drugi akcent, wykresy, alerty info */
    teal: '#2DD4BF',
    /** Sukces */
    success: '#3FB950',
    /** Ostrzeżenia, kryzys */
    error: '#F0645C',
    /** Obramowania kart: subtelna jasna linia */
    border: 'rgba(242,244,248,0.10)',
    /** Obramowania mocniejsze (chipy, wyróżnienia) */
    borderStrong: 'rgba(242,244,248,0.20)',
    /** Tor pasków postępu */
    progressTrack: 'rgba(242,244,248,0.10)',
  },
  light: {
    /** Główne tło ekranów: chłodna, jasna szarość */
    background: '#F4F6F9',
    /** Tło głębsze: krawędzie, gradienty, cień */
    backgroundDeep: '#E7EAF0',
    /** Karty, modale, pola: czysta biel */
    card: '#FFFFFF',
    /** Drugi ton kart, wiersze, stany zaznaczenia */
    cardAlt: '#F1F4F9',
    /** Tekst główny: grafit (nie czysta czerń) */
    text: '#0C1524',
    /** Akapity (tekst ~74%) */
    text80: 'rgba(12,21,36,0.74)',
    /** Podpisy, meta (tekst ~54%) */
    textSecondary: 'rgba(12,21,36,0.54)',
    /** Akcent: granatowy błękit, elementy interaktywne */
    accent: '#3554D4',
    /** Akcent na jasnym tle jako drobny tekst/etykieta: głębszy, czytelny */
    accentLight: '#2A44B0',
    /** Tło głównych przycisków (CTA) */
    cta: '#3554D4',
    /** Tekst na tle akcentu/CTA */
    onAccent: '#FFFFFF',
    /** Teal: dane, drugi akcent, wykresy, alerty info */
    teal: '#0E9488',
    /** Sukces */
    success: '#15A34A',
    /** Ostrzeżenia, kryzys */
    error: '#E5484D',
    /** Obramowania kart: neutralna szara linia (nie złoto) */
    border: '#E4E7EE',
    /** Obramowania mocniejsze (chipy, wyróżnienia) */
    borderStrong: '#D2D8E2',
    /** Tor pasków postępu */
    progressTrack: 'rgba(12,21,36,0.08)',
  },
} as const;

export type ColorToken = keyof typeof Colors.dark & keyof typeof Colors.light;
