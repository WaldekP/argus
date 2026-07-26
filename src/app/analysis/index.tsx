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

import { AnalysisStatusChip } from '@/components/analysis-status-chip';
import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
import { BackLink } from '@/components/back-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  FontFamily,
  FontSize,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listAnalyses, type AnalysisListItem } from '@/lib/api/analysis';
import { formatDate, polishPlural } from '@/lib/format';

/** Lista analiz niespójności + wejście do nowej analizy. */
export default function AnalysisListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalyses = useCallback(async () => {
    try {
      const list = await listAnalyses();
      setAnalyses(list);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się wczytać analiz.');
    } finally {
      setLoaded(true);
    }
  }, []);

  // Odświeżamy listę przy każdym wejściu na ekran (powrót z analizy,
  // zakończona pętla analizy itd.).
  useFocusEffect(
    useCallback(() => {
      void loadAnalyses();
    }, [loadAnalyses])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalyses();
    setRefreshing(false);
  }, [loadAnalyses]);

  const handleRetry = () => {
    setLoaded(false);
    setError(null);
    void loadAnalyses();
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
          <ThemedText style={styles.title}>Analizy niespójności</ThemedText>
          <ThemedText themeColor="textSecondary">
            Wskaż temat i cel, a Argus przejrzy wystąpienia i głosowania z Sejmu w poszukiwaniu
            sprzeczności.
          </ThemedText>
        </View>

        <PrimaryButton title="Nowa analiza" onPress={() => router.push('/analysis/new')} />

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error && analyses.length === 0 ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetry} />
          </View>
        ) : null}

        {loaded && !error && analyses.length === 0 ? (
          <View style={styles.emptyState}>
            <EyeDot size={14} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Nie masz jeszcze żadnej analizy. Podaj temat oraz posłów albo klub, a Argus znajdzie
              niespójności w ich wypowiedziach i głosowaniach.
            </ThemedText>
          </View>
        ) : null}

        {analyses.length > 0 ? (
          <View style={styles.cards}>
            {analyses.map((analysis) => (
              <Pressable
                key={analysis.id}
                accessibilityRole="button"
                onPress={() => router.push(`/analysis/${analysis.id}`)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.dimmed,
                ]}>
                <ThemedText style={styles.cardTopic}>{analysis.topic}</ThemedText>
                <ThemedText type="small" themeColor="text80">
                  {analysis.target_name}
                </ThemedText>
                <AnalysisStatusChip status={analysis.status} />
                <View style={styles.cardMeta}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(analysis.created_at)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {polishPlural(analysis.findings_count, 'ustalenie', 'ustalenia', 'ustaleń')}
                  </ThemedText>
                  {analysis.documents_count > 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {polishPlural(
                        analysis.documents_count,
                        'dokument',
                        'dokumenty',
                        'dokumentów'
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
