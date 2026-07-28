import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
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
import { track } from '@/lib/analytics/posthog';
import { getKnowledgeDoc, type KnowledgeDoc } from '@/lib/api/knowledge';

/**
 * Dane → Badania opinii → szczegół: pytania i rozkłady odpowiedzi jednego
 * komunikatu CBOS, metryczka badania i link do oryginału na cbos.pl.
 */
export default function KnowledgeDocScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [doc, setDoc] = useState<KnowledgeDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDoc = useCallback(async () => {
    if (!id) return;
    try {
      const loadedDoc = await getKnowledgeDoc(id);
      setDoc(loadedDoc);
      setError(null);
      track('knowledge_doc_viewed', { id: loadedDoc.id, external_id: loadedDoc.external_id });
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się wczytać badania.'
      );
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadDoc();
    }, [loadDoc])
  );

  const structured = doc?.structured ?? null;
  const badania = structured?.badania ?? [];
  const metryka = [structured?.termin, structured?.proba, structured?.zleceniodawca]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}>
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
                void loadDoc();
              }}
            />
          </View>
        ) : null}

        {loaded && !error && doc ? (
          <>
            <View style={styles.header}>
              <ThemedText themeColor="accentLight" style={styles.kicker}>
                {doc.source} nr {doc.external_id}
              </ThemedText>
              <ThemedText style={styles.title}>{doc.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[doc.pub_date ?? 'brak daty', doc.author ?? null].filter(Boolean).join(' • ')}
              </ThemedText>
            </View>

            {metryka.length > 0 ? (
              <View
                style={[
                  styles.metaCard,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {metryka.join('. ')}
                </ThemedText>
              </View>
            ) : null}

            {badania.length === 0 ? (
              <View style={styles.emptyState}>
                <EyeDot size={14} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                  Ten komunikat nie ma wyodrębnionych rozkładów. Zobacz pełny tekst na cbos.pl.
                </ThemedText>
              </View>
            ) : null}

            {badania.map((badanie, index) => (
              <View key={index} style={styles.question}>
                <ThemedText style={styles.questionText}>{badanie.pytanie}</ThemedText>
                <View style={styles.results}>
                  {(badanie.wyniki ?? []).map((wynik, wIndex) => (
                    <View key={wIndex} style={styles.resultRow}>
                      <ThemedText
                        themeColor={wynik.kluczowy ? 'accent' : 'text'}
                        style={[styles.percent, wynik.kluczowy ? styles.percentKey : null]}>
                        {wynik.procent === null || wynik.procent === undefined
                          ? '—'
                          : `${wynik.procent}%`}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor={wynik.kluczowy ? 'text' : 'textSecondary'}
                        style={styles.resultLabel}>
                        {wynik.etykieta}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                {badanie.jakCzytac ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.howToRead}>
                    {badanie.jakCzytac}
                  </ThemedText>
                ) : null}
              </View>
            ))}

            {doc.report_url ? (
              <Pressable onPress={() => void Linking.openURL(doc.report_url as string)}>
                <ThemedText themeColor="accentLight" style={styles.sourceLink}>
                  Zobacz pełny komunikat na cbos.pl
                </ThemedText>
              </Pressable>
            ) : null}
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
    gap: Spacing.four,
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
  header: {
    gap: Spacing.two,
  },
  kicker: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.meta,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  question: {
    gap: Spacing.two,
  },
  questionText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.body,
  },
  results: {
    gap: Spacing.one,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  percent: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.body,
    minWidth: 52,
  },
  percentKey: {
    fontFamily: FontFamily.serif,
  },
  resultLabel: {
    flexShrink: 1,
  },
  howToRead: {
    fontStyle: 'italic',
  },
  sourceLink: {
    fontFamily: FontFamily.sansSemiBold,
    paddingVertical: Spacing.two,
  },
});
