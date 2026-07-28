import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { znajdzTemat } from '@/lib/knowledge';
import { listKnowledgeDocs, type KnowledgeDocListItem } from '@/lib/api/knowledge';

type TopicGroup = {
  slug: string;
  label: string;
  docs: KnowledgeDocListItem[];
};

/** Do filtrowania bez polskich znaków. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');
}

function questionLabel(n: number): string {
  if (n === 1) return '1 pytanie';
  if (n >= 2 && n <= 4) return `${n} pytania`;
  return `${n} pytań`;
}

function docCountLabel(n: number): string {
  if (n === 1) return '1 badanie';
  if (n >= 2 && n <= 4) return `${n} badania`;
  return `${n} badań`;
}

function topicLabel(slug: string): string {
  return znajdzTemat(slug)?.nazwa ?? slug;
}

/**
 * Dane → Badania opinii: globalna baza badań opinii publicznej (CBOS),
 * zasilana z narzędzia cbos-crawler. Grupowanie po temacie programowym,
 * wejście w wiersz otwiera pytania i rozkłady odpowiedzi.
 */
export default function KnowledgeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [docs, setDocs] = useState<KnowledgeDocListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadDocs = useCallback(async () => {
    try {
      const list = await listKnowledgeDocs();
      setDocs(list);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się wczytać badań opinii.'
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDocs();
    }, [loadDocs])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDocs();
    setRefreshing(false);
  }, [loadDocs]);

  const handleRetry = () => {
    setLoaded(false);
    setError(null);
    void loadDocs();
  };

  // Wyszukiwanie: event po ustaniu pisania (debounce), bez treści zapytania.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => track('badania_searched', { query_length: q.length }), 500);
    return () => clearTimeout(timer);
  }, [query]);

  const groups = useMemo<TopicGroup[]>(() => {
    const q = normalize(query.trim());
    const filtered = q
      ? docs.filter((doc) =>
          [doc.title, doc.external_id, doc.topic_slugs.map(topicLabel).join(' ')].some((field) =>
            normalize(field).includes(q)
          )
        )
      : docs;

    // Badanie trafia do każdego swojego tematu (może dotyczyć kilku).
    const bySlug = new Map<string, KnowledgeDocListItem[]>();
    for (const doc of filtered) {
      const slugs = doc.topic_slugs.length > 0 ? doc.topic_slugs : ['inne'];
      for (const slug of slugs) {
        const bucket = bySlug.get(slug);
        if (bucket) bucket.push(doc);
        else bySlug.set(slug, [doc]);
      }
    }

    return [...bySlug.entries()]
      .map(([slug, list]) => ({
        slug,
        label: slug === 'inne' ? 'Inne' : topicLabel(slug),
        docs: [...list].sort((a, b) => (b.pub_date ?? '').localeCompare(a.pub_date ?? '')),
      }))
      .sort((a, b) => b.docs.length - a.docs.length || a.label.localeCompare(b.label, 'pl'));
  }, [docs, query]);

  const totalShown = useMemo(
    () => new Set(groups.flatMap((group) => group.docs.map((doc) => doc.id))).size,
    [groups]
  );

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
          <ThemedText style={styles.title}>Badania opinii</ThemedText>
          <ThemedText themeColor="textSecondary">
            Komunikaty z badań CBOS z rozkładami odpowiedzi, pogrupowane po temacie. Dane
            reprezentatywne, z jawną metodologią i datą.
          </ThemedText>
        </View>

        <FormTextInput
          label="Szukaj"
          value={query}
          onChangeText={setQuery}
          placeholder="Tytuł, numer, temat..."
          autoCapitalize="none"
          autoCorrect={false}
        />

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error && docs.length === 0 ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetry} />
          </View>
        ) : null}

        {loaded && !error && docs.length === 0 ? (
          <View style={styles.emptyState}>
            <EyeDot size={14} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Baza badań jest jeszcze pusta. Pojawią się tu komunikaty CBOS po pierwszym
              załadowaniu danych.
            </ThemedText>
          </View>
        ) : null}

        {loaded && !error && docs.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {docCountLabel(totalShown)}
          </ThemedText>
        ) : null}

        {loaded && !error && docs.length > 0 && totalShown === 0 ? (
          <View style={styles.emptyState}>
            <EyeDot size={14} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Nic nie pasuje do tego wyszukiwania.
            </ThemedText>
          </View>
        ) : null}

        {groups.map((group) => (
          <View key={group.slug} style={styles.group}>
            <View style={styles.sectionHeader}>
              <EyeDot size={8} />
              <ThemedText themeColor="accentLight" style={styles.kicker}>
                {group.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {group.docs.length}
              </ThemedText>
            </View>

            {group.docs.map((doc) => (
              <Pressable
                key={`${group.slug}:${doc.id}`}
                onPress={() => router.push(`/badania-opinii/${doc.id}`)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed ? styles.cardPressed : null,
                ]}>
                <ThemedText style={styles.cardTitle} numberOfLines={3}>
                  {doc.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {doc.source} nr {doc.external_id}
                  {doc.pub_date ? ` • ${doc.pub_date}` : ''} • {questionLabel(doc.question_count)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
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
  emptyState: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  group: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
    flexShrink: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.body,
  },
});
