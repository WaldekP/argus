/**
 * Chip statusu: obwódka i tekst w kolorze roli.
 *
 * Ten sam kształt był zaimplementowany osobno dla draftu przekazu, analizy
 * i dossier tematu, przy czym temat miał DWIE różne implementacje: na liście
 * chip był węższy i zawsze w kolorze `accentLight`, a na ekranie tematu
 * szerszy i w kolorze zależnym od statusu. Ten sam status wyglądał więc
 * inaczej w zależności od ekranu.
 *
 * Rozmiar etykiety to 13 px, czyli dolna granica dla tekstu meta z briefu
 * designu. Kopie miały 12 px.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Opis statusu: co pokazać i w jakim kolorze roli. */
export type StatusMeta = {
  label: string;
  color: ThemeColor;
};

export function StatusChip({ label, color }: StatusMeta) {
  const theme = useTheme();

  return (
    <View style={[styles.chip, { borderColor: theme[color] }]}>
      <ThemedText type="small" themeColor={color} style={styles.label}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
  label: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
});
