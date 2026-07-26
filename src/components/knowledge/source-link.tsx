import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Zrodlo } from '@/lib/knowledge/types';
import { openExternalUrl } from '@/lib/open-url';

export type SourceLinkProps = {
  zrodlo: Zrodlo;
};

/**
 * Odnośnik do źródła: wydawca, data i tytuł. Każda liczba i cytat w bazie
 * wiedzy ma taki przypis, żeby dało się go sprawdzić przed publikacją.
 */
export function SourceLink({ zrodlo }: SourceLinkProps) {
  const theme = useTheme();

  const open = () => {
    void openExternalUrl(zrodlo.url);
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Źródło: ${zrodlo.tytul}, ${zrodlo.wydawca}, ${zrodlo.data}`}
      onPress={open}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: theme.border,
          backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
        },
      ]}>
      <Ionicons name="link-outline" size={14} color={theme.teal} />
      <View style={styles.texts}>
        <ThemedText type="small" themeColor="teal" numberOfLines={2}>
          {zrodlo.tytul}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {zrodlo.wydawca}, {zrodlo.data}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  texts: {
    flex: 1,
    gap: Spacing.half,
  },
});
