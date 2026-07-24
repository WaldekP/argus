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

import { DraftStatusChip } from '@/components/draft-status-chip';
import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
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
import { listDrafts, type DraftListItem } from '@/lib/api/content';
import { formatDate, polishPlural } from '@/lib/format';

/** Zakładka Przekaz: lista draftów generatora + wejście do nowego przekazu. */
export default function ContentScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    try {
      const list = await listDrafts();
      setDrafts(list);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się wczytać przekazów.'
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  // Odświeżamy listę przy każdym wejściu na zakładkę (powrót z draftu,
  // zakończona generacja itd.).
  useFocusEffect(
    useCallback(() => {
      void loadDrafts();
    }, [loadDrafts])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDrafts();
    setRefreshing(false);
  }, [loadDrafts]);

  const handleRetry = () => {
    setLoaded(false);
    setError(null);
    void loadDrafts();
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: BottomTabInset + Spacing.four },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Przekaz</ThemedText>
          <ThemedText themeColor="textSecondary">
            Jeden temat, warianty treści per segment wyborców i kanał, w Twoim stylu.
          </ThemedText>
        </View>

        <PrimaryButton title="Nowy przekaz" onPress={() => router.push('/content/new')} />

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error && drafts.length === 0 ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetry} />
          </View>
        ) : null}

        {loaded && !error && drafts.length === 0 ? (
          <View style={styles.emptyState}>
            <EyeDot size={14} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Nie masz jeszcze żadnego przekazu. Podaj temat, a Argus przygotuje warianty dla
              Twoich segmentów i kanałów.
            </ThemedText>
          </View>
        ) : null}

        {drafts.length > 0 ? (
          <View style={styles.cards}>
            {drafts.map((draft) => (
              <Pressable
                key={draft.id}
                accessibilityRole="button"
                onPress={() => router.push(`/content/${draft.id}`)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.dimmed,
                ]}>
                <ThemedText style={styles.cardTopic}>{draft.topic}</ThemedText>
                <DraftStatusChip status={draft.status} />
                <View style={styles.cardMeta}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(draft.created_at)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {polishPlural(draft.variants_count, 'wariant', 'warianty', 'wariantów')}
                  </ThemedText>
                  {draft.alerts_count > 0 ? (
                    <ThemedText type="small" themeColor="error">
                      {polishPlural(
                        draft.alerts_count,
                        'alert spójności',
                        'alerty spójności',
                        'alertów spójności'
                      )}
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
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
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  cards: {
    gap: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardTopic: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  dimmed: {
    opacity: 0.7,
  },
});
