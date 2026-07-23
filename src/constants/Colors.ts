/**
 * Jedyne źródło kolorów w aplikacji.
 * Źródło prawdy designu: ../briefy/15-mini-brief-design-argus.md ("quiet power",
 * muzeum nocą). Dark mode first. Zero hardkodowanych hexów w komponentach.
 * Zasady: złoto = biżuteria (oszczędnie), teal tylko przy danych,
 * zakaz fioletu/różu "AI", neonów, czystej bieli i czerni.
 */

export const Colors = {
  dark: {
    /** Główne tło ekranów */
    background: '#0A0F2C',
    /** Tło głębsze: krawędzie, gradienty, cień */
    backgroundDeep: '#080C22',
    /** Karty, modale, pola */
    card: '#0E1436',
    /** Drugi ton kart, wiersze, stany zaznaczenia */
    cardAlt: '#0B1026',
    /** Tekst główny (nigdy czysta biel) */
    text: '#F4F1E8',
    /** Akapity (tekst 80%) */
    text80: 'rgba(244,241,232,0.8)',
    /** Podpisy, meta (tekst 50%) */
    textSecondary: 'rgba(244,241,232,0.5)',
    /** Złoto: linie, akcenty, kluczowe liczby, CTA */
    accent: '#C9A227',
    /** Złoto jasne: hover, podświetlenia, iris, tekst chipów */
    accentLight: '#E6C65A',
    /** Tekst na tle złota */
    onAccent: '#0A0F2C',
    /** Teal (pawi): dane, drugi akcent, wykresy, alerty info */
    teal: '#14857A',
    /** Sukces w alertach = złoto (patrz brief designu) */
    success: '#C9A227',
    /** Ostrzeżenia, kryzys */
    error: '#E0483A',
    /** Obramowania kart (złoto 25%) */
    border: 'rgba(201,162,39,0.25)',
    /** Obramowania chipów (złoto 40%) */
    borderStrong: 'rgba(201,162,39,0.4)',
    /** Tor pasków postępu */
    progressTrack: 'rgba(244,241,232,0.08)',
  },
  light: {
    /** Tło pergaminowe (tryb jasny wg briefu implementacyjnego) */
    background: '#F7F5EF',
    backgroundDeep: '#EFEBDF',
    card: '#FFFFFF',
    cardAlt: '#F2EFE6',
    text: '#0A0F2C',
    text80: 'rgba(10,15,44,0.8)',
    textSecondary: 'rgba(10,15,44,0.55)',
    accent: '#C9A227',
    accentLight: '#A9871B',
    onAccent: '#0A0F2C',
    teal: '#14857A',
    success: '#C9A227',
    error: '#E0483A',
    border: 'rgba(201,162,39,0.35)',
    borderStrong: 'rgba(201,162,39,0.5)',
    progressTrack: 'rgba(10,15,44,0.08)',
  },
} as const;

export type ColorToken = keyof typeof Colors.dark & keyof typeof Colors.light;
