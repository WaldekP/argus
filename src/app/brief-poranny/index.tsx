import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import { EyeDot } from '@/components/eye-dot';
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
import {
  listMentions,
  listTopics,
  markMentionsRead,
  syncMentions,
  type Mention,
  type WatchedTopic,
} from '@/lib/api/mentions';
import { formatWeekday, relativeTime } from '@/lib/format-time';

type TopicGroup = {
  topic: WatchedTopic;
  mentions: Mention[];
};

/**
 * Brief poranny: co się dziś pisze na tematy, które użytkownik wskazał jako
 * ważne. Źródłem jest Google News RSS, pobierany przez `argus-mentions`.
 *
 * Świadomie nie ma tu wykresów ani liczników zasięgu. To nie dashboard
 * monitoringu mediów, tylko lista rzeczy, o które ktoś dziś zapyta.
 */
export default function MorningBriefScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [topics, setTopics] = useState<WatchedTopic[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Samo pobranie, bez dotykania stanu: dzięki temu efekt montujący ekran
  // zapisuje stan dopiero w callbacku, a nie synchronicznie w swoim ciele.
  const fetchBrief = useCallback(async () => {
    const [topicsResult, mentionsResult] = await Promise.all([
      listTopics(),
      listMentions({ limit: 200 }),
    ]);
    return { topics: topicsResult.topics, mentions: mentionsResult.mentions };
  }, []);

  useEffect(() => {
    let active = true;
    track('morning_brief_read');

    fetchBrief()
      .then((data) => {
        if (!active) return;
        setTopics(data.topics);
        setMentions(data.mentions);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Nie udało się pobrać wzmianek.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchBrief]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await syncMentions();
      track('mentions_synced', { inserted: result.inserted, topics: result.results.length });
      const data = await fetchBrief();
      setTopics(data.topics);
      setMentions(data.mentions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się odświeżyć wzmianek.');
    } finally {
      setSyncing(false);
    }
  }, [fetchBrief]);

  const handleOpen = useCallback(async (mention: Mention) => {
    track('mention_opened', { source: mention.source_name ?? 'nieznane' });
    // Oznaczenie w stanie lokalnym od razu: użytkownik wraca z przeglądarki
    // i ma widzieć efekt kliknięcia, nie czekać na kolejne pobranie listy.
    setMentions((current) =>
      current.map((item) =>
        item.id === mention.id ? { ...item, read_at: new Date().toISOString() } : item,
      ),
    );
    void markMentionsRead(mention.id).catch(() => undefined);
    await Linking.openURL(mention.url);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setMentions((current) =>
      current.map((item) => (item.read_at ? item : { ...item, read_at: now })),
    );
    await markMentionsRead().catch(() => undefined);
  }, []);

  /** Wzmianki pogrupowane po haśle, hasła bez wzmianek też widoczne. */
  const groups = useMemo<TopicGroup[]>(() => {
    const byTopic = new Map<string, Mention[]>();
    for (const mention of mentions) {
      const list = byTopic.get(mention.topic_id);
      if (list) list.push(mention);
      else byTopic.set(mention.topic_id, [mention]);
    }
    return topics
      .filter((topic) => topic.active)
      .map((topic) => ({ topic, mentions: byTopic.get(topic.id) ?? [] }));
  }, [mentions, topics]);

  const unreadTotal = useMemo(
    () => mentions.filter((mention) => !mention.read_at).length,
    [mentions],
  );

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={handleSync} tintColor={theme.accent} />
        }>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wróć"
            onPress={() => router.back()}
            style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.topBarActions}>
            {/* Jawny przycisk, bo RefreshControl nie działa na webie, a web
                jest u nas pierwszorzędny. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Odśwież wzmianki"
              onPress={handleSync}
              disabled={syncing}
              style={styles.iconButton}>
              {syncing ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <Ionicons name="refresh-outline" size={22} color={theme.text} />
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zarządzaj hasłami"
              onPress={() => router.push('/brief-poranny/hasla')}
              style={styles.iconButton}>
              <Ionicons name="options-outline" size={22} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <EyeDot size={8} />
            <ThemedText themeColor="accentLight" style={styles.kicker}>
              {formatWeekday(new Date())}
            </ThemedText>
          </View>
          <ThemedText style={styles.title}>Brief poranny</ThemedText>
          <ThemedText themeColor="textSecondary">
            Co się pisze na tematy, które wskazał_aś jako ważne. Prasa i portale, bez social
            mediów.
          </ThemedText>
        </View>

        {error ? (
          <View style={[styles.alert, { borderLeftColor: theme.error }]}>
            <ThemedText type="small">{error}</ThemedText>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="eye-outline" size={40} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              Nie ma jeszcze żadnych haseł. Dodaj nazwisko, nazwę partii albo temat, a Argus zacznie
              zbierać wzmianki z prasy.
            </ThemedText>
            <PrimaryButton
              title="Dodaj hasła"
              onPress={() => router.push('/brief-poranny/hasla')}
            />
          </View>
        ) : (
          <>
            <View style={styles.actions}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.actionsSummary}>
                {unreadTotal > 0
                  ? `Nowych wzmianek: ${unreadTotal}`
                  : 'Wszystko przejrzane.'}
              </ThemedText>
              {unreadTotal > 0 ? (
                <Pressable accessibilityRole="button" onPress={handleMarkAllRead}>
                  <ThemedText type="small" themeColor="accentLight">
                    Oznacz jako przeczytane
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>

            {groups.map(({ topic, mentions: items }) => (
              <View key={topic.id} style={styles.group}>
                <View style={styles.groupHeader}>
                  <ThemedText style={styles.groupTitle}>{topic.phrase}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {items.length > 0 ? `${items.length} z ${topic.window_days} dni` : 'brak'}
                  </ThemedText>
                </View>

                {topic.last_sync_error ? (
                  <View style={[styles.alert, { borderLeftColor: theme.error }]}>
                    <ThemedText type="small">
                      Ostatnie pobranie nie powiodło się: {topic.last_sync_error}
                    </ThemedText>
                  </View>
                ) : null}

                {items.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Brak wzmianek w tym oknie czasowym. To nie błąd: przy wąskich hasłach cisza jest
                    normalna.
                  </ThemedText>
                ) : (
                  items.map((mention) => (
                    <Pressable
                      key={mention.id}
                      accessibilityRole="link"
                      accessibilityLabel={`Otwórz artykuł: ${mention.title}`}
                      onPress={() => handleOpen(mention)}
                      style={({ pressed }) => [
                        styles.card,
                        {
                          backgroundColor: pressed
                            ? theme.backgroundSelected
                            : theme.backgroundElement,
                          borderColor: theme.border,
                        },
                      ]}>
                      <View style={styles.cardMeta}>
                        {!mention.read_at ? <EyeDot size={7} /> : null}
                        <ThemedText type="small" themeColor="textSecondary">
                          {mention.source_name ?? 'źródło nieznane'} ·{' '}
                          {relativeTime(mention.published_at)}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.cardTitle}>{mention.title}</ThemedText>
                      {mention.snippet ? (
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                          {mention.snippet}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  ))
                )}
              </View>
            ))}

            <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
              Wzmianki pochodzą z wyszukiwarek prasowych i obejmują prasę oraz portale. Nie ma tu
              social mediów ani forów. Ocena tonu wypowiedzi pojawi się w kolejnym kroku.
            </ThemedText>
          </>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconButton: {
    padding: Spacing.one,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  actionsSummary: {
    flexShrink: 1,
  },
  group: {
    gap: Spacing.two,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  groupTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
    flexShrink: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    lineHeight: 24,
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
  footnote: {
    paddingTop: Spacing.two,
  },
});
