import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AnalysisStatus } from '@/lib/api/analysis';

const STATUS_META: Record<AnalysisStatus, { label: string; color: ThemeColor }> = {
  collecting: { label: 'Zbieram dane', color: 'teal' },
  analyzing: { label: 'Analizuję', color: 'accent' },
  ready: { label: 'Gotowa', color: 'success' },
  error: { label: 'Błąd', color: 'error' },
};

/** Chip statusu analizy niespójności: Zbieram dane / Analizuję / Gotowa / Błąd. */
export function AnalysisStatusChip({ status }: { status: AnalysisStatus }) {
  const theme = useTheme();
  const meta = STATUS_META[status];

  return (
    <View style={[styles.chip, { borderColor: theme[meta.color] }]}>
      <ThemedText type="small" themeColor={meta.color} style={styles.label}>
        {meta.label}
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
    fontSize: 12,
    lineHeight: 16,
  },
});
