/**
 * Motyw aplikacji. Kolory pochodzą WYŁĄCZNIE z ./Colors (patrz CLAUDE.md
 * i ../briefy/15-mini-brief-design-argus.md). Tu: mapowanie na klucze
 * używane przez komponenty themed-*, fonty, skala i spacing.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { Colors as Palette } from '@/constants/Colors';

export { Palette };

function mapScheme(scheme: typeof Palette.dark | typeof Palette.light) {
  return {
    text: scheme.text,
    text80: scheme.text80,
    textSecondary: scheme.textSecondary,
    background: scheme.background,
    backgroundDeep: scheme.backgroundDeep,
    backgroundElement: scheme.card,
    backgroundSelected: scheme.cardAlt,
    accent: scheme.accent,
    accentLight: scheme.accentLight,
    onAccent: scheme.onAccent,
    teal: scheme.teal,
    success: scheme.success,
    error: scheme.error,
    border: scheme.border,
    borderStrong: scheme.borderStrong,
    progressTrack: scheme.progressTrack,
  } as const;
}

export const Colors = {
  light: mapScheme(Palette.light),
  dark: mapScheme(Palette.dark),
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Nagłówki i kluczowe liczby: Cormorant Garamond 600 (cytaty: italic).
 * UI, treść, dane: Inter 400/500/600. Ładowane w app/_layout.tsx.
 */
export const FontFamily = {
  /** Nagłówki, kluczowe liczby */
  serif: 'CormorantGaramond_600SemiBold',
  serifBold: 'CormorantGaramond_700Bold',
  /** Cytaty, akcenty emocjonalne */
  serifItalic: 'CormorantGaramond_600SemiBold_Italic',
  /** Tekst UI */
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

/** Skala typograficzna aplikacji (brief designu, sekcja "Skala"). */
export const FontSize = {
  /** Tytuł ekranu 28-34 */
  screenTitle: 32,
  /** Nagłówek sekcji 20-24 */
  section: 22,
  /** Treść */
  body: 15,
  /** Podpisy, meta */
  meta: 13,
} as const;

/** Kicker / etykieta: Inter UPPERCASE, szeroki tracking, złoty, min 14px. */
export const KickerStyle = {
  fontFamily: FontFamily.sansSemiBold,
  fontSize: 14,
  letterSpacing: 14 * 0.24,
  textTransform: 'uppercase',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: FontFamily.sans,
    serif: FontFamily.serif,
    rounded: FontFamily.sans,
    mono: 'ui-monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-display)',
    mono: 'var(--font-mono)',
  },
  default: {
    sans: FontFamily.sans,
    serif: FontFamily.serif,
    rounded: FontFamily.sans,
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Radiusy: 12-18, karty 14-18 (brief designu). */
export const Radius = {
  small: 12,
  card: 16,
  large: 18,
  /** Chipy, tagi */
  full: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
