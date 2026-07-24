import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WynikBadania } from '@/lib/knowledge/types';

export type PollBarsProps = {
  wyniki: WynikBadania[];
};

/**
 * Poziome słupki wyników sondażu. Odpowiedź kluczowa dla wniosku dostaje
 * złoto, reszta teal. Złoto oszczędnie, zgodnie z briefem designu.
 */
export function PollBars({ wyniki }: PollBarsProps) {
  const theme = useTheme();
  const max = Math.max(...wyniki.map((wynik) => wynik.procent), 1);

  return (
    <View style={styles.wrapper}>
      {wyniki.map((wynik) => (
        <View key={wynik.etykieta} style={styles.row}>
          <View style={styles.labelRow}>
            <ThemedText type="small" themeColor={wynik.kluczowy ? 'text' : 'textSecondary'}>
              {wynik.etykieta}
            </ThemedText>
            <ThemedText
              themeColor={wynik.kluczowy ? 'accentLight' : 'textSecondary'}
              style={styles.value}>
              {wynik.procent.toLocaleString('pl-PL')}%
            </ThemedText>
          </View>
          <View style={[styles.track, { backgroundColor: theme.progressTrack }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${(wynik.procent / max) * 100}%`,
                  backgroundColor: wynik.kluczowy ? theme.accent : theme.teal,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.one,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  value: {
    fontFamily: FontFamily.serifBold,
    fontSize: 20,
  },
  track: {
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
