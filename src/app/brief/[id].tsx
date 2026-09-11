import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, KickerStyle, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getBrief,
  markQuestionAsked,
  rateBrief,
  type BriefQuestion,
  type InterviewBrief,
} from '@/lib/api/brief';

/** Prawdopodobieństwo modelu na etykietę. Nie udajemy precyzji do procenta. */
function probabilityLabel(p: number | null): string {
  if (p === null) return 'brak oceny';
  if (p >= 0.7) return 'bardzo prawdopodobne';
  if (p >= 0.45) return 'prawdopodobne';
  return 'możliwe';
}

export default function BriefDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const [brief, setBrief] = useState<InterviewBrief | null>(null);
  const [questions, setQuestions] = useState<BriefQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState<number | null>(null);

  useEffect(() => {
    if (!params.id) return;
    let active = true;
    getBrief(params.id)
      .then((result) => {
        if (!active) return;
        setBrief(result.brief);
        setQuestions(result.questions);
        setRated(result.brief.rating);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Nie udało się pobrać briefu.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  const handleRate = useCallback(
    async (rating: number) => {
      if (!brief) return;
      setRated(rating);
      try {
        await rateBrief(brief.id, rating);
      } catch {
        // Ocena to sygnal produktowy, nie operacja krytyczna: nie zatrzymujemy
        // uzytkownika komunikatem o bledzie, stan wroci przy nastepnym wejsciu.
      }
    },
    [brief]
  );

  const handleAsked = useCallback(async (question: BriefQuestion) => {
    const next = !question.was_asked;
    setQuestions((current) =>
      current.map((q) => (q.id === question.id ? { ...q, was_asked: next } : q))
    );
    try {
      await markQuestionAsked(question.id, next);
    } catch {
      // jak wyzej
    }
  }, []);

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

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : error ? (
          <View style={[styles.alert, { borderLeftColor: theme.error }]}>
            <ThemedText type="small">{error}</ThemedText>
          </View>
        ) : brief ? (
          <>
            <View style={styles.header}>
              <ThemedText style={styles.title}>{brief.topic}</ThemedText>
              {brief.journalists ? (
                <ThemedText themeColor="textSecondary">
                  {brief.journalists.full_name}
                  {brief.journalists.outlets ? `, ${brief.journalists.outlets.name}` : ''}
                </ThemedText>
              ) : null}
            </View>

            {brief.status !== 'ready' ? (
              <ThemedText type="small" themeColor="textSecondary">
                {brief.status === 'generating'
                  ? 'Brief jest w przygotowaniu. Wróć za chwilę.'
                  : 'Przygotowanie briefu się nie powiodło. Zamów go ponownie.'}
              </ThemedText>
            ) : (
              <>
                <Sekcja tytul="KTO PYTA" tresc={brief.content.profil_rozmowcy} theme={theme} />
                <Sekcja tytul="PUBLICZNOŚĆ" tresc={brief.content.publicznosc} theme={theme} />

                <ThemedText type="small" themeColor="textSecondary" style={KickerStyle}>
                  PRZEWIDYWANE PYTANIA
                </ThemedText>
                {questions.map((q) => (
                  <ThemedView
                    key={q.id}
                    type="backgroundElement"
                    style={[styles.card, { borderColor: theme.border }]}>
                    <View style={styles.cardHeader}>
                      <ThemedText type="small" themeColor="accentLight">
                        {probabilityLabel(q.probability)}
                      </ThemedText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          q.was_asked ? 'Odznacz: pytanie padło' : 'Zaznacz: pytanie padło'
                        }
                        onPress={() => handleAsked(q)}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {q.was_asked ? 'Padło ✓' : 'Padło?'}
                        </ThemedText>
                      </Pressable>
                    </View>
                    <ThemedText style={styles.question}>{q.question}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {q.recommended_answer.teza}
                    </ThemedText>
                    {q.recommended_answer.punkty?.map((punkt, i) => (
                      <ThemedText key={i} type="small" themeColor="textSecondary">
                        • {punkt}
                      </ThemedText>
                    ))}
                    {q.recommended_answer.ryzyko ? (
                      <View style={[styles.risk, { borderLeftColor: theme.error }]}>
                        <ThemedText type="small">{q.recommended_answer.ryzyko}</ThemedText>
                      </View>
                    ) : null}
                  </ThemedView>
                ))}

                <ThemedText type="small" themeColor="textSecondary" style={KickerStyle}>
                  PUŁAPKI I MOSTY
                </ThemedText>
                {brief.content.pulapki?.map((p, i) => (
                  <ThemedView
                    key={i}
                    type="backgroundElement"
                    style={[styles.card, { borderColor: theme.border }]}>
                    <ThemedText type="small">{p.pulapka}</ThemedText>
                    <ThemedText type="small" themeColor="accentLight">
                      Most: {p.most}
                    </ThemedText>
                  </ThemedView>
                ))}

                <ThemedText type="small" themeColor="textSecondary" style={KickerStyle}>
                  PRZEKAZY DNIA
                </ThemedText>
                {brief.content.przekazy_dnia?.map((m, i) => (
                  <ThemedView
                    key={i}
                    type="backgroundElement"
                    style={[styles.card, { borderColor: theme.border }]}>
                    <ThemedText>{m}</ThemedText>
                  </ThemedView>
                ))}

                <View style={styles.rating}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Jak oceniasz ten brief po wywiadzie?
                  </ThemedText>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable
                        key={n}
                        accessibilityRole="button"
                        accessibilityLabel={`Ocena ${n} z 5`}
                        onPress={() => handleRate(n)}
                        style={[
                          styles.ratingButton,
                          {
                            borderColor: rated === n ? theme.accent : theme.border,
                            backgroundColor:
                              rated === n ? theme.backgroundSelected : 'transparent',
                          },
                        ]}>
                        <ThemedText themeColor={rated === n ? 'accent' : 'textSecondary'}>
                          {n}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function Sekcja({
  tytul,
  tresc,
  theme,
}: {
  tytul: string;
  tresc: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary" style={KickerStyle}>
        {tytul}
      </ThemedText>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="small">{tresc}</ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  iconButton: { padding: Spacing.one, alignSelf: 'flex-start' },
  header: { gap: Spacing.two },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  section: { gap: Spacing.two },
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
    gap: Spacing.two,
  },
  question: {
    fontFamily: FontFamily.sansSemiBold,
  },
  risk: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
  },
  rating: { gap: Spacing.two, paddingTop: Spacing.three },
  ratingRow: { flexDirection: 'row', gap: Spacing.two },
  ratingButton: {
    borderWidth: 1,
    borderRadius: Radius.full,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alert: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
  },
  centered: { paddingVertical: Spacing.six, alignItems: 'center' },
});
