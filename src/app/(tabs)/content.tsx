import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  FontFamily,
  FontSize,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Pozycja katalogu danych referencyjnych. */
type DataEntry = {
  title: string;
  description: string;
  route: Href;
  accessibilityLabel: string;
};

/**
 * Na razie jedna pozycja (programy wyborcze). Katalog jest listą, żeby kolejne
 * zestawienia dokładać bez przebudowy ekranu.
 */
const DATA_ENTRIES: DataEntry[] = [
  {
    title: 'Programy wyborcze',
    description:
      'Oficjalne dokumenty partii sejmowych z wyborów 2011, 2015, 2019 i 2023, do pobrania jako PDF.',
    route: '/programy-wyborcze',
    accessibilityLabel: 'Programy wyborcze partii sejmowych, pliki PDF do pobrania',
  },
];

/**
 * Zakładka Dane: katalog materiałów źródłowych i zestawień. Generacja przekazu
 * przeniesiona do tematów (zakładka Tematy oraz ekran korpusu/dossieru).
 */
export default function DataScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: BottomTabInset + Spacing.four },
        ]}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Dane</ThemedText>
          <ThemedText themeColor="textSecondary">
            Materiały źródłowe i zestawienia, z których korzystasz przy briefach i przekazie.
          </ThemedText>
        </View>

        <View style={styles.cards}>
          {DATA_ENTRIES.map((entry) => (
            <Pressable
              key={entry.title}
              accessibilityRole="button"
              accessibilityLabel={entry.accessibilityLabel}
              onPress={() => router.push(entry.route)}
              style={({ pressed }) => [
                styles.libraryCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                pressed && styles.dimmed,
              ]}>
              <View style={styles.libraryTexts}>
                <ThemedText style={styles.libraryTitle}>{entry.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {entry.description}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
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
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  cards: {
    gap: Spacing.three,
  },
  libraryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
  },
  libraryTexts: {
    flex: 1,
    gap: Spacing.one,
  },
  libraryTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  dimmed: {
    opacity: 0.7,
  },
});
