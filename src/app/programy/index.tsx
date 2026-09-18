import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import { listPrograms, type ProgramListItem } from '@/lib/api/media';
import { formatDate, polishPlural } from '@/lib/format';

/**
 * Dane → Programy: archiwum programów publicystycznych. Pokazuje, czym dana
 * redakcja żyje w ostatnich tygodniach i kogo zaprasza, co jest materiałem
 * do przygotowania się na rozmowę w tym paśmie.
 *
 * Źródło oddaje ostatnie kilkadziesiąt odcinków i nie pozwala wejść głębiej
 * (blokada paginacji w robots.txt), więc archiwum jest z założenia płytkie.
 */
export default function ProgramsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [programs, setPrograms] = useState<ProgramListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrograms = useCallback(async () => {
    try {
      setPrograms(await listPrograms());
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się wczytać listy programów.'
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPrograms();
    }, [loadPrograms])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPrograms();
    setRefreshing(false);
  }, [loadPrograms]);

  const handleRetry = () => {
    setLoaded(false);
    setError(null);
    void loadPrograms();
  };

  const openProgram = (program: ProgramListItem) => {
    track('program_viewed', { program: program.slug, odcinkow: program.episodes_count });
    router.push({ pathname: '/programy/[slug]', params: { slug: program.slug } });
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }>
        <BackLink />

        <View style={styles.header}>
          <ThemedText style={styles.title}>Programy</ThemedText>
          <ThemedText themeColor="textSecondary">
            Ostatnie odcinki programów publicystycznych: kto był gościem, o czym była rozmowa
            i kiedy. Materiał do przygotowania się na wejście w tym paśmie.
          </ThemedText>
        </View>

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error && programs.length === 0 ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetry} />
          </View>
        ) : null}

        {loaded && !error && programs.length === 0 ? (
          <View style={styles.emptyState}>
            <EyeDot size={14} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Archiwum programów jest jeszcze puste. Pojawi się tu po pierwszym przebiegu
              zbierania odcinków.
            </ThemedText>
          </View>
        ) : null}

        {programs.map((program) => (
          <Pressable
            key={program.id}
            onPress={() => openProgram(program)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <View style={styles.cardHeader}>
              <EyeDot size={8} />
              <ThemedText style={styles.cardName}>{program.name}</ThemedText>
            </View>

            {program.outlet_name ? (
              <ThemedText type="small" themeColor="textSecondary">
                {program.outlet_name}
                {program.schedule_note ? `, ${program.schedule_note}` : ''}
              </ThemedText>
            ) : null}

            {program.hosts.length > 0 ? (
              <ThemedText type="small" themeColor="accentLight">
                Prowadzi: {program.hosts.join(', ')}
              </ThemedText>
            ) : null}

            <ThemedText type="small" themeColor="textSecondary">
              {polishPlural(program.episodes_count, 'odcinek', 'odcinki', 'odcinków')}
              {program.last_episode_at
                ? `, ostatni ${formatDate(program.last_episode_at)}`
                : ', brak dat'}
            </ThemedText>
          </Pressable>
        ))}
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
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
  errorBox: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
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
    gap: Spacing.two,
  },
  cardName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.body,
    flexShrink: 1,
  },
});
