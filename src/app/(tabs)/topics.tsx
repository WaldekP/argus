import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EyeDot } from '@/components/eye-dot';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  FontFamily,
  FontSize,
  KickerStyle,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import { tematy } from '@/lib/knowledge/kwota-wolna';

/**
 * Lista tematów programowych. Wejście w temat otwiera korpus: syntezę opinii
 * społecznej, wypowiedzi polityków ze źródłami i playbooki komunikacyjne.
 */
export default function TopicsScreen() {
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
          <ThemedText style={styles.title}>Tematy</ThemedText>
          <ThemedText themeColor="textSecondary">
            Tematy ważne programowo, z gotowym korpusem: co mówią badania, co mówią politycy i jak o
            tym mówić do poszczególnych grup.
          </ThemedText>
        </View>

        {tematy.map((temat) => (
          <Pressable
            key={temat.slug}
            accessibilityRole="button"
            accessibilityLabel={`Otwórz temat: ${temat.nazwa}`}
            onPress={() => {
              track('topic_opened', { topic: temat.slug });
              router.push({ pathname: '/temat/[slug]', params: { slug: temat.slug } });
            }}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <View style={styles.cardHeader}>
              <View style={styles.kickerRow}>
                <EyeDot size={8} />
                <ThemedText themeColor="accentLight" style={styles.kicker}>
                  Korpus tematyczny
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </View>

            <ThemedText style={styles.cardTitle}>{temat.nazwa}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {temat.zajawka}
            </ThemedText>

            <View style={[styles.meta, { borderColor: theme.border }]}>
              <View style={styles.metaItem}>
                <ThemedText style={styles.metaValue} themeColor="accentLight">
                  {temat.liczbaZrodel}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  źródeł
                </ThemedText>
              </View>
              <View style={styles.metaItem}>
                <ThemedText style={styles.metaValue} themeColor="accentLight">
                  {temat.politycy.length}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  polityków
                </ThemedText>
              </View>
              <View style={styles.metaItem}>
                <ThemedText style={styles.metaValue} themeColor="accentLight">
                  {temat.segmenty.length}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  segmenty
                </ThemedText>
              </View>
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              Aktualizacja: {temat.aktualizacja}
            </ThemedText>
          </Pressable>
        ))}

        <View style={styles.emptyState}>
          <Ionicons name="add-circle-outline" size={28} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            Kolejne tematy dodajemy po ustaleniu programu. Każdy przechodzi ten sam tryb: źródła z
            przypisami, audyt i oznaczenie danych niegotowych do publikacji.
          </ThemedText>
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
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
  },
  cardTitle: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    lineHeight: 30,
  },
  meta: {
    flexDirection: 'row',
    gap: Spacing.four,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  metaValue: {
    fontFamily: FontFamily.serifBold,
    fontSize: 22,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
});
