import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DraftStatus } from '@/lib/api/content';

const STATUS_META: Record<DraftStatus, { label: string; color: ThemeColor }> = {
  draft: { label: 'Szkic', color: 'textSecondary' },
  accepted: { label: 'Zaakceptowany', color: 'success' },
  rejected: { label: 'Odrzucony', color: 'error' },
};

/** Chip statusu draftu przekazu: Szkic / Zaakceptowany / Odrzucony. */
export function DraftStatusChip({ status }: { status: DraftStatus }) {
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
