import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { EyeDot } from '@/components/eye-dot';
import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
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
import { track } from '@/lib/analytics/posthog';
import { getProgram, type ProgramDetails, type ProgramEpisode } from '@/lib/api/media';
import { formatDate, polishPlural } from '@/lib/format';

/** Do filtrowania bez polskich znaków. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');
}

/**
 * Ostatnie odcinki jednego programu. Filtr działa na nazwisku gościa i na
 * temacie naraz, bo przygotowując się do rozmowy szuka się raz jednego,
 * raz drugiego: „czy była u niej Konfederacja" i „czy pytała o budżet".
 */
export default function ProgramScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [program, setProgram] = useState<ProgramDetails | null>(null);
  const [episodes, setEpisodes] = useState<ProgramEpisode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadProgram = useCallback(async () => {
    if (!slug) return;
    try {
      const data = await getProgram(slug);
      setProgram(data.program);
      setEpisodes(data.episodes);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się wczytać programu.'
      );
    } finally {
      setLoaded(true);
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      void loadProgram();
    }, [loadProgram])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProgram();
    setRefreshing(false);
  }, [loadProgram]);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return episodes;
    return episodes.filter((episode) =>
      [episode.title, episode.guests.join(' '), episode.summary ?? ''].some((field) =>
        normalize(field).includes(needle)
      )
    );
  }, [episodes, query]);

  /**
   * `program_guest_searched` po zatrzymaniu pisania. Wysyłamy długość frazy
   * i liczbę trafień, nigdy samej frazy: szuka się tu po nazwiskach.
   */
  useEffect(() => {
    const fraza = query.trim();
    if (fraza.length < 2) return;
    const id = setTimeout(() => {
      track('program_guest_searched', { dlugosc: fraza.length, wynikow: filtered.length });
    }, 1200);
    return () => clearTimeout(id);
  }, [query, filtered.length]);

  const openEpisode = (episode: ProgramEpisode) => {
    track('program_episode_opened', { program: slug, odcinek: episode.external_id });
    void Linking.openURL(episode.url);
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

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton
              title="Spróbuj ponownie"
              variant="secondary"
              onPress={() => {
                setLoaded(false);
                setError(null);
                void loadProgram();
              }}
            />
          </View>
        ) : null}

        {program ? (
          <>
            <View style={styles.header}>
              <ThemedText style={styles.title}>{program.name}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {[program.outlet_name, program.schedule_note].filter(Boolean).join(', ') ||
                  'Program publicystyczny'}
              </ThemedText>
              {program.hosts.length > 0 ? (
                <ThemedText type="small" themeColor="accentLight">
                  Prowadzi: {program.hosts.join(', ')}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {polishPlural(episodes.length, 'odcinek', 'odcinki', 'odcinków')} w archiwum.
                Źródło udostępnia ostatnią serię, starsze wejścia nie są dostępne.
              </ThemedText>
            </View>

            <FormTextInput
              label="Szukaj"
              value={query}
              onChangeText={setQuery}
              placeholder="Nazwisko gościa albo temat..."
              autoCapitalize="none"
              autoCorrect={false}
            />

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <EyeDot size={14} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                  {episodes.length === 0
                    ? 'Ten program nie ma jeszcze zaciągniętych odcinków.'
                    : 'Żaden odcinek nie pasuje do tego wyszukiwania.'}
                </ThemedText>
              </View>
            ) : null}

            {filtered.map((episode) => (
              <Pressable
                key={episode.id}
                onPress={() => openEpisode(episode)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <ThemedText themeColor="accentLight" style={styles.kicker}>
                  {episode.published_at ? formatDate(episode.published_at) : 'bez daty'}
                </ThemedText>
                <ThemedText style={styles.cardName}>{episode.title}</ThemedText>
                {episode.guests.length > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {episode.guests.join(', ')}
                  </ThemedText>
                ) : null}
                {episode.summary ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={6}>
                    {episode.summary}
                  </ThemedText>
                ) : null}
              </Pressable>
            ))}
          </>
        ) : null}
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
  kicker: {
    ...KickerStyle,
  },
  cardName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.body,
  },
});
