import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listDailyBriefs, type DailyBriefSummary } from '@/lib/api/daily-brief';
import { formatLongDate } from '@/lib/format-time';

/**
 * Zakładka Briefy: archiwum briefów dnia. Dzisiejszy brief żyje na ekranie
 * Brief poranny (zakładka Pulpit); tu jest cała dostępna historia.
 *
 * Docelowo obok briefów dnia trafią tu briefy przedwywiadowe (TASK 5), zapewne
 * pod przełącznikiem sekcji.
 */
export default function BriefsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [briefs, setBriefs] = useState<DailyBriefSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Odświeżamy przy każdym wejściu w zakładkę: user mógł właśnie wygenerować
  // nowy brief na ekranie Dziś i ma go tu zobaczyć bez restartu.
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
    <ScreenPlaceholder
      title="Briefy"
      description="Archiwum briefów dnia: syntetyczny przegląd polityki pod Twoją strategię, dzień po dniu.">
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
            wygenerowaniu na ekranie Dziś.
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
    </ScreenPlaceholder>
  );
}

const styles = StyleSheet.create({
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
