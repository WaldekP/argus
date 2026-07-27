import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EyeDot } from '@/components/eye-dot';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  FontFamily,
  FontSize,
  KickerStyle,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listDailyBriefs, type DailyBriefSummary } from '@/lib/api/daily-brief';
import { formatLongDate } from '@/lib/format-time';

/**
 * Archiwum briefów dnia: cała dostępna historia, od najnowszego. Dzisiejszy
 * brief żyje na ekranie Brief poranny; wejście tu prowadzi z linku
 * „Wszystkie" na Pulpicie.
 *
 * Docelowo obok briefów dnia trafią tu briefy przedwywiadowe (TASK 5), zapewne
 * pod przełącznikiem sekcji.
 */
export default function BriefArchiveScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [briefs, setBriefs] = useState<DailyBriefSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Odświeżamy przy każdym wejściu: user mógł właśnie wygenerować nowy brief
  // na ekranie Brief poranny i ma go tu zobaczyć bez restartu.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listDailyBriefs()
        .then((result) => {
          if (!active) return;
          setBriefs(result.briefs);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : 'Nie udało się pobrać briefów.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć"
          onPress={() => router.back()}
          style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <EyeDot size={8} />
            <ThemedText themeColor="accentLight" style={styles.kicker}>
              Archiwum
            </ThemedText>
          </View>
          <ThemedText style={styles.title}>Wszystkie briefy</ThemedText>
          <ThemedText themeColor="textSecondary">
            Syntetyczny przegląd polityki pod Twoją strategię, dzień po dniu.
          </ThemedText>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : error ? (
          <View style={[styles.alert, { borderLeftColor: theme.error }]}>
            <ThemedText type="small">{error}</ThemedText>
          </View>
        ) : briefs.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="eye-outline" size={40} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              Nie ma jeszcze żadnego briefu dnia. Pierwszy pojawi się rano albo po ręcznym
              wygenerowaniu na ekranie Brief poranny.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {briefs.map((brief) => (
              <Pressable
                key={brief.brief_date}
                accessibilityRole="button"
                accessibilityLabel={`Otwórz brief z ${brief.brief_date}`}
                onPress={() => router.push(`/brief-poranny/${brief.brief_date}`)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardDate}>{formatLongDate(brief.brief_date)}</ThemedText>
                  {brief.status === 'ready' ? (
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {brief.status === 'generating' ? 'w toku' : 'błąd'}
                    </ThemedText>
                  )}
                </View>
                {brief.lead ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                    {brief.lead}
                  </ThemedText>
                ) : null}
              </Pressable>
            ))}
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
    gap: Spacing.four,
  },
  iconButton: {
    padding: Spacing.one,
    alignSelf: 'flex-start',
  },
  header: {
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
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  list: {
    gap: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardDate: {
    fontFamily: FontFamily.serif,
    fontSize: 20,
    lineHeight: 26,
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  alert: {
    borderLeftWidth: 2,
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
  centered: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  centeredText: {
    textAlign: 'center',
  },
});
