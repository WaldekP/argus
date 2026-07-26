/**
 * Wskaźniki postępu dla operacji porcjowanych (generacja przekazu, dossier
 * tematu, analiza niespójności, import z Sejmu).
 *
 * Dwa warianty, bo mamy dwie sytuacje:
 * - `FullScreenProgress` zastępuje całą treść ekranu, gdy nie ma jeszcze czego
 *   pokazać (ekrany "nowy X" w trakcie pracy),
 * - `InlineProgress` to karta wewnątrz gotowego ekranu, gdy dogrywamy resztę.
 *
 * Wcześniej pierwszy wariant istniał w czterech znakowo identycznych kopiach
 * (content/new, analysis/new, topics/new, onboarding/import), a drugi w dwóch
 * (analysis/[id], topics/[id]). Kopie zaczynały się już rozjeżdżać: import
 * gubił `textAlign: center` na etykiecie.
 *
 * Etykietę liczy wywołujący: każda domena nazywa swoje kroki inaczej
 * ("Wariant 2 z 8", "Sprawdzam spójność"), a to jedyna różnica między kopiami.
 */

import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Udział wykonanej pracy, przycięty do zakresu 0-1. */
function ratioOf(processed: number, total: number): number {
  return total > 0 ? Math.min(Math.max(processed / total, 0), 1) : 0;
}

type ProgressBarProps = {
  processed: number;
  total: number;
  /** Pasek na całą szerokość karty (wariant inline) albo do 320 px (pełny ekran). */
  wide?: boolean;
};

function ProgressBar({ processed, total, wide = false }: ProgressBarProps) {
  const theme = useTheme();
  const percent = Math.round(ratioOf(processed, total) * 100);

  return (
    <View
      style={[
        styles.track,
        wide ? null : styles.trackNarrow,
        { backgroundColor: theme.progressTrack },
      ]}>
      <View style={[styles.fill, { backgroundColor: theme.accent, width: `${percent}%` }]} />
    </View>
  );
}

type FullScreenProgressProps = {
  /** Co się teraz dzieje, np. "Zbieram wystąpienia". */
  label: string;
  processed: number;
  total: number;
  /** Zdanie pod paskiem. Domyślne mówi, żeby nie zamykać aplikacji. */
  hint?: string;
  /**
   * Licznik "x z y" pod paskiem. Wyłącz tam, gdzie etykieta już zawiera
   * numerację (generator przekazu pisze "Wariant 2 z 8"), żeby ta sama
   * informacja nie stała dwa razy pod sobą.
   */
  showCount?: boolean;
};

/**
 * Postęp na całym ekranie: spinner, etykieta, pasek i zdanie wyjaśniające.
 * Pasek pojawia się dopiero, gdy znamy całość: przy starcie kroku `total`
 * bywa zerem, a pusty tor wygląda jak zawieszona operacja.
 */
export function FullScreenProgress({
  label,
  processed,
  total,
  hint = 'Operacja może potrwać kilka minut. Nie zamykaj aplikacji.',
  showCount = true,
}: FullScreenProgressProps) {
  const theme = useTheme();
  const known = total > 0;

  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color={theme.accent} />
      <ThemedText style={styles.label}>{label}</ThemedText>
      {known ? (
        <>
          <ProgressBar processed={processed} total={total} />
          {showCount ? (
            <ThemedText type="small" themeColor="textSecondary">
              {processed} z {total}
            </ThemedText>
          ) : null}
        </>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {hint}
      </ThemedText>
    </View>
  );
}

type InlineProgressProps = {
  label: string;
  processed: number;
  total: number;
};

/**
 * Postęp jako karta w treści ekranu. Licznik "x z y" pokazujemy tylko, gdy
 * znamy całość: przy starcie kroku total bywa zerem i "0 z 0" wygląda na błąd.
 */
export function InlineProgress({ label, processed, total }: InlineProgressProps) {
  const theme = useTheme();
  const showCount = total > 0;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.row}>
        <ActivityIndicator color={theme.accent} />
        <ThemedText type="small" themeColor="text80">
          {label}
        </ThemedText>
      </View>
      {showCount ? (
        <>
          <ProgressBar processed={processed} total={total} wide />
          <ThemedText type="small" themeColor="textSecondary">
            {processed} z {total}
          </ThemedText>
        </>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  label: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
    textAlign: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  trackNarrow: {
    maxWidth: 320,
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
