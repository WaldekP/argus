/**
 * Jedyne źródło kolorów w aplikacji.
 * Źródło prawdy designu: ../briefy/15-mini-brief-design-argus.md ("quiet power",
 * muzeum nocą). Dark mode first. Zero hardkodowanych hexów w komponentach.
 * Zasady: złoto = biżuteria (oszczędnie), teal tylko przy danych,
 * zakaz fioletu/różu "AI", neonów, czystej bieli i czerni.
 */

export const Colors = {
  dark: {
    /**
     * Główne tło ekranów. Jaśniejszy granat niż w decku (#0A0F2C):
     * decyzja usera z 2026-07-23, apka nie może być tak ciemna jak prezentacja.
     */
    background: '#161D45',
    /** Tło głębsze: krawędzie, gradienty, cień */
    backgroundDeep: '#0F1535',
    /** Karty, modale, pola */
    card: '#1F2755',
    /** Drugi ton kart, wiersze, stany zaznaczenia */
    cardAlt: '#1A214C',
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
    /** Tło głównych przycisków (CTA): cieplejsze, jaśniejsze złoto */
    cta: '#E3B93C',
    /** Tekst na tle złota/CTA */
    onAccent: '#10173A',
    /** Teal (pawi): dane, drugi akcent, wykresy, alerty info */
    teal: '#14857A',
    /** Sukces w alertach = złoto (patrz brief designu) */
    success: '#C9A227',
    /** Ostrzeżenia, kryzys */
    error: '#E0483A',
    /** Obramowania kart (złoto 28%) */
    border: 'rgba(201,162,39,0.28)',
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
    cta: '#C9A227',
    onAccent: '#10173A',
    teal: '#14857A',
    success: '#C9A227',
    error: '#E0483A',
    border: 'rgba(201,162,39,0.35)',
    borderStrong: 'rgba(201,162,39,0.5)',
    progressTrack: 'rgba(10,15,44,0.08)',
  },
} as const;

export type ColorToken = keyof typeof Colors.dark & keyof typeof Colors.light;
