import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { TopicStatusChip } from '@/components/topic-status-chip';
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
import { listTopics, type TopicListItem } from '@/lib/api/topics';
import { formatDate, polishPlural } from '@/lib/format';
import { tematy } from '@/lib/knowledge';
import { buildKnowledgeTopicAssistantQuestion } from '@/lib/topic-assistant';

/**
 * Analiza zagadnień (dawna zakładka Tematy, teraz pod zakładką Analizy):
 * u góry własne dossiery (upload analizy → podsumowanie, liczby, pytania,
 * linie ataku i obrony), niżej gotowe zagadnienia programowe.
 */
export default function TopicsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    try {
      const list = await listTopics();
      setTopics(list);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się wczytać zagadnień.'
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTopics();
    }, [loadTopics])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTopics();
    setRefreshing(false);
  }, [loadTopics]);

  const handleRetry = () => {
    setLoaded(false);
    setError(null);
    void loadTopics();
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
          <ThemedText style={styles.title}>Analiza zagadnień</ThemedText>
          <ThemedText themeColor="textSecondary">
            Wgraj gotową analizę, a Argus zrobi z niej dossier: podsumowanie, kluczowe liczby,
            przewidywane pytania i linie ataku oraz obrony.
          </ThemedText>
        </View>

        <PrimaryButton title="Nowe zagadnienie" onPress={() => router.push('/topics/new')} />

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error && topics.length === 0 ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetry} />
          </View>
        ) : null}

        {/* Brak własnych dossier to nie pusty ekran: niżej czekają gotowe
            zagadnienia, więc komunikat jest jedną linią, nie wielkim empty state. */}
        {loaded && !error && topics.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Własnych analiz jeszcze tu nie ma. Wgraj plik PDF albo MD przyciskiem powyżej, a na
            start korzystaj z gotowych zagadnień poniżej.
          </ThemedText>
        ) : null}

        {topics.length > 0 ? (
          <View style={styles.cards}>
            {topics.map((topic) => (
              <Pressable
                key={topic.id}
                accessibilityRole="button"
                onPress={() => router.push(`/topics/${topic.id}`)}
                style={({ pressed }) => [
                  styles.dossierCard,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.dimmed,
                ]}>
                <ThemedText style={styles.dossierTitle}>{topic.title}</ThemedText>
                <TopicStatusChip status={topic.status} />
                <View style={styles.cardMeta}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(topic.created_at)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {polishPlural(topic.documents_count, 'dokument', 'dokumenty', 'dokumentów')}
                  </ThemedText>
                  {topic.questions_count > 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {polishPlural(topic.questions_count, 'pytanie', 'pytania', 'pytań')}
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.corpusHeader}>
          <View style={styles.kickerRow}>
            <EyeDot size={8} />
            <ThemedText themeColor="accentLight" style={styles.kicker}>
              Gotowe zagadnienia
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Zagadnienia ważne programowo, z gotową bazą wiedzy: co mówią badania, co mówią
            politycy i jak o tym mówić do poszczególnych grup.
          </ThemedText>
        </View>

        {tematy.map((temat) => (
          <Pressable
            key={temat.slug}
            accessibilityRole="button"
            accessibilityLabel={`Otwórz zagadnienie: ${temat.nazwa}`}
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
                  Zagadnienie
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

            {/* Wewnętrzny Pressable (PrimaryButton) wygrywa z kartą, więc
                dotknięcie CTA nie otwiera zagadnienia, tylko rozmowę. */}
            <PrimaryButton
              title="Rozmawiaj z asystentem"
              onPress={() => {
                track('assistant_question_asked', { source: 'knowledge_topic_list' });
                router.push({
                  pathname: '/asystent-argus',
                  params: {
                    q: buildKnowledgeTopicAssistantQuestion(temat),
                    ts: String(Date.now()),
                  },
                });
              }}
            />
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
  cards: {
    gap: Spacing.three,
  },
  dossierCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  dossierTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  corpusHeader: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
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
  dimmed: {
    opacity: 0.7,
  },
});
