import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SourceLink } from '@/components/knowledge/source-link';
import { FontFamily, KickerStyle, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Wiarygodnosc, Wypowiedz } from '@/lib/knowledge/types';

const OPIS_WIARYGODNOSCI: Record<Wiarygodnosc, string> = {
  stenogram: 'Zapis oficjalny',
  relacja: 'Relacja redakcji',
  wideo: 'Materiał wideo, nie zweryfikowano z nagraniem',
};

export type QuoteCardProps = {
  wypowiedz: Wypowiedz;
};

/** Karta cytatu: dosłowna wypowiedź, okoliczności, po co jest i skąd pochodzi. */
export function QuoteCard({ wypowiedz }: QuoteCardProps) {
  const theme = useTheme();
  const ostrzezenie = wypowiedz.wiarygodnosc === 'wideo';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <View style={[styles.quoteBar, { backgroundColor: theme.accent }]} />

      <View style={styles.body}>
        <ThemedText style={styles.quote}>„{wypowiedz.cytat}”</ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {wypowiedz.miejsce}, {wypowiedz.data}
        </ThemedText>

        <View style={[styles.poCo, { borderColor: theme.border }]}>
          <ThemedText themeColor="accentLight" style={styles.poCoKicker}>
            Po co ten cytat
          </ThemedText>
          <ThemedText type="small">{wypowiedz.poCo}</ThemedText>
        </View>

        <View style={styles.footer}>
          <View
            style={[
              styles.chip,
              {
                borderColor: ostrzezenie ? theme.error : theme.borderStrong,
              },
            ]}>
            <ThemedText type="small" themeColor={ostrzezenie ? 'error' : 'accentLight'}>
              {OPIS_WIARYGODNOSCI[wypowiedz.wiarygodnosc]}
            </ThemedText>
          </View>
        </View>

        <SourceLink zrodlo={wypowiedz.zrodlo} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  quoteBar: {
    width: 2,
  },
  body: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  quote: {
    fontFamily: FontFamily.serifItalic,
    fontSize: 19,
    lineHeight: 28,
  },
  poCo: {
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  poCoKicker: {
    ...KickerStyle,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
