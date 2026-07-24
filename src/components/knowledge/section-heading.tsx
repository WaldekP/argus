import { StyleSheet, View } from 'react-native';

import { EyeDot } from '@/components/eye-dot';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, FontSize, KickerStyle, Spacing } from '@/constants/theme';

export type SectionHeadingProps = {
  /** Etykieta nad tytułem: Inter UPPERCASE, złota (brief designu). */
  kicker: string;
  title: string;
  /** Krótkie wyjaśnienie, po co ta sekcja. */
  lead?: string;
};

/** Nagłówek sekcji na ekranie tematu: kicker, tytuł serif, opcjonalny lead. */
export function SectionHeading({ kicker, title, lead }: SectionHeadingProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.kickerRow}>
        <EyeDot size={8} />
        <ThemedText themeColor="accentLight" style={styles.kicker}>
          {kicker}
        </ThemedText>
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      {lead ? (
        <ThemedText type="small" themeColor="textSecondary">
          {lead}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.two,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
});
