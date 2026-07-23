import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, FontFamily, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScreenPlaceholderProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/**
 * Wspólny szkielet ekranu zakładki: tytuł (serif), opis i subtelny
 * empty state z motywem oka.
 */
export function ScreenPlaceholder({ title, description, children }: ScreenPlaceholderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: BottomTabInset + Spacing.four },
        ]}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{description}</ThemedText>

        {children ?? (
          <View style={styles.emptyState}>
            <Ionicons name="eye-outline" size={40} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              Argus jeszcze się tu rozgląda. Ta sekcja pojawi się wkrótce.
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 32,
    lineHeight: 40,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
  },
});
