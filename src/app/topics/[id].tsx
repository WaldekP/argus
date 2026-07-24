import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import {
  addTopicDocument,
  askTopic,
  deleteTopic,
  getTopic,
  regenerateTopic,
  runTopicGeneration,
  type GeneratePhase,
  type QuestionAsker,
  type Topic,
  type TopicStatus,
} from '@/lib/api/topics';
import { pickAnalysisDocument } from '@/lib/documents';
import { formatDate, polishPlural } from '@/lib/format';

import type { ThemeColor } from '@/constants/theme';

const DELETE_CONFIRM_MS = 3000;

const STATUS_META: Record<TopicStatus, { label: string; color: ThemeColor }> = {
  generating: { label: 'W trakcie', color: 'accentLight' },
  ready: { label: 'Gotowe', color: 'success' },
  error: { label: 'Błąd', color: 'error' },
};

const NUMBER_STATUS_META: Record<'zweryfikowane' | 'do weryfikacji', { label: string; color: ThemeColor }> = {
  zweryfikowane: { label: 'Zweryfikowane', color: 'success' },
  'do weryfikacji': { label: 'Do weryfikacji', color: 'textSecondary' },
};

const ASKER_META: Record<QuestionAsker, { label: string; color: ThemeColor }> = {
  dziennikarz: { label: 'Dziennikarz', color: 'teal' },
  rywal: { label: 'Rywal', color: 'accent' },
};

const GENERATE_LABELS: Record<GeneratePhase, string> = {
  summary: 'Streszczam materiał',
  numbers: 'Wyciągam kluczowe liczby',
  questions: 'Układam przewidywane pytania',
  attack_defense: 'Szykuję linie ataku i obrony',
  done: 'Porządkuję dossier',
};

type InlineProgress = {
  label: string;
  processed: number;
  total: number;
};

/** Chip statusu dossier tematu. */
function TopicStatusChip({ status }: { status: TopicStatus }) {
  const theme = useTheme();
  const meta = STATUS_META[status];
  return (
    <View style={[styles.badge, { borderColor: theme[meta.color] }]}>
      <ThemedText type="small" themeColor={meta.color} style={styles.badgeLabel}>
        {meta.label}
      </ThemedText>
    </View>
  );
}

/** Pasek postępu pętli generacji w treści ekranu. */
function InlineProgressBar({ progress }: { progress: InlineProgress | null }) {
  const theme = useTheme();
  const label = progress?.label ?? 'Przygotowuję dossier';
  const showCount = progress !== null && progress.total > 0;
  const ratio = showCount ? Math.min(progress.processed / progress.total, 1) : 0;

  return (
    <ThemedView type="backgroundElement" style={[styles.progressCard, { borderColor: theme.border }]}>
      <View style={styles.progressRow}>
        <ActivityIndicator color={theme.accent} />
        <ThemedText type="small" themeColor="text80">
          {label}
        </ThemedText>
      </View>
      {showCount ? (
        <>
          <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.accent, width: `${Math.round(ratio * 100)}%` },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {progress.processed} z {progress.total}
          </ThemedText>
        </>
      ) : null}
    </ThemedView>
  );
}

/** Widok dossier tematu: podsumowanie, liczby, pytania, linie, dopytanie AI. */
export default function TopicScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [working, setWorking] = useState(false);
  const [workProgress, setWorkProgress] = useState<InlineProgress | null>(null);
  const [workError, setWorkError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const mountedRef = useRef(true);
  const viewTrackedRef = useRef(false);
  const startedRef = useRef(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  const loadTopic = useCallback(async () => {
    if (!id) {
      setError('Nie znaleziono tematu.');
      setLoading(false);
      return;
    }
    try {
      const loaded = await getTopic(id);
      if (!mountedRef.current) {
        return;
      }
      setTopic(loaded);
      setError(null);
      if (!viewTrackedRef.current) {
        viewTrackedRef.current = true;
        track('topic_viewed', { status: loaded.status });
      }
    } catch (loadError) {
      if (mountedRef.current) {
        setError(loadError instanceof Error ? loadError.message : 'Nie udało się wczytać tematu.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void loadTopic();
    }
  }, [loadTopic]);

  const handleRetryLoad = () => {
    setLoading(true);
    setError(null);
    void loadTopic();
  };

  const setProgress = useCallback((label: string, processed: number, total: number) => {
    if (mountedRef.current) {
      setWorkProgress({ label, processed, total });
    }
  }, []);

  /** Dokończenie przerwanej generacji (kroki idempotentne, ruszają dalej). */
  const handleResume = async () => {
    if (!topic || working) {
      return;
    }
    setWorking(true);
    setWorkError(null);
    setWorkProgress(null);
    try {
      await runTopicGeneration(topic.id, (step) => {
        setProgress(GENERATE_LABELS[step.phase], step.processed, step.total);
      });
      await loadTopic();
    } catch (resumeError) {
      if (mountedRef.current) {
        setWorkError(
          resumeError instanceof Error ? resumeError.message : 'Nie udało się dokończyć generacji.'
        );
      }
    } finally {
      if (mountedRef.current) {
        setWorking(false);
        setWorkProgress(null);
      }
    }
  };

  /** Dodanie dokumentu i ponowne wygenerowanie dossier. */
  const handleAddDocument = async () => {
    if (!topic || working) {
      return;
    }
    setWorkError(null);
    let picked;
    try {
      picked = await pickAnalysisDocument();
    } catch (pickError) {
      setWorkError(pickError instanceof Error ? pickError.message : 'Nie udało się dodać dokumentu.');
      return;
    }
    if (!picked) {
      return;
    }

    setWorking(true);
    setWorkProgress({ label: 'Wysyłam dokument', processed: 0, total: 0 });
    try {
      await addTopicDocument({
        topic_id: topic.id,
        filename: picked.filename,
        mime: picked.mime,
        text: picked.text,
        content_base64: picked.contentBase64,
      });
      track('topic_document_added', { mime: picked.mime });
      await regenerateTopic(topic.id);
      await runTopicGeneration(topic.id, (step) => {
        setProgress(GENERATE_LABELS[step.phase], step.processed, step.total);
      });
      await loadTopic();
    } catch (docError) {
      if (mountedRef.current) {
        setWorkError(docError instanceof Error ? docError.message : 'Nie udało się dodać dokumentu.');
      }
    } finally {
      if (mountedRef.current) {
        setWorking(false);
        setWorkProgress(null);
      }
    }
  };

  /** Ponowne wygenerowanie dossier bez nowego dokumentu. */
  const handleRegenerate = async () => {
    if (!topic || working) {
      return;
    }
    setWorking(true);
    setWorkError(null);
    setWorkProgress(null);
    try {
      await regenerateTopic(topic.id);
      await runTopicGeneration(topic.id, (step) => {
        setProgress(GENERATE_LABELS[step.phase], step.processed, step.total);
      });
      await loadTopic();
    } catch (regenError) {
      if (mountedRef.current) {
        setWorkError(
          regenError instanceof Error ? regenError.message : 'Nie udało się wygenerować ponownie.'
        );
      }
    } finally {
      if (mountedRef.current) {
        setWorking(false);
        setWorkProgress(null);
      }
    }
  };

  const handleAsk = async () => {
    if (!topic || asking) {
      return;
    }
    const trimmed = question.trim();
    if (trimmed.length < 3) {
      setAskError('Wpisz pytanie, co najmniej 3 znaki.');
      return;
    }
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      const result = await askTopic(topic.id, trimmed);
      if (mountedRef.current) {
        setAnswer(result);
        track('topic_question_asked', {});
      }
    } catch (askErr) {
      if (mountedRef.current) {
        setAskError(askErr instanceof Error ? askErr.message : 'Nie udało się uzyskać odpowiedzi.');
      }
    } finally {
      if (mountedRef.current) {
        setAsking(false);
      }
    }
  };

  /** Usunięcie z potwierdzeniem: drugie tapnięcie w ciągu 3 sekund. */
  const handleDelete = async () => {
    if (!topic || deleting) {
      return;
    }
    if (!deleteArmed) {
      setDeleteArmed(true);
      deleteTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setDeleteArmed(false);
        }
      }, DELETE_CONFIRM_MS);
      return;
    }
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
    }
    setDeleting(true);
    setWorkError(null);
    try {
      await deleteTopic(topic.id);
      router.back();
    } catch (deleteError) {
      if (mountedRef.current) {
        setWorkError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć tematu.');
        setDeleting(false);
        setDeleteArmed(false);
      }
    }
  };

  const dossier = topic?.dossier;
  const numbers = dossier?.key_numbers ?? [];
  const questions = dossier?.questions ?? [];
  const journalistQuestions = questions.filter((q) => q.asker === 'dziennikarz');
  const rivalQuestions = questions.filter((q) => q.asker === 'rywal');
  const attack = dossier?.attack_defense.attack ?? [];
  const defense = dossier?.attack_defense.defense ?? [];
  const isGenerating = topic?.status === 'generating';
  const hasDossier =
    !!dossier &&
    (dossier.summary.length > 0 ||
      numbers.length > 0 ||
      questions.length > 0 ||
      attack.length > 0 ||
      defense.length > 0);

  const renderQuestions = (list: typeof questions, asker: QuestionAsker) => {
    if (list.length === 0) {
      return null;
    }
    const meta = ASKER_META[asker];
    return (
      <View style={styles.subSection}>
        <View style={[styles.badge, { borderColor: theme[meta.color] }]}>
          <ThemedText type="small" themeColor={meta.color} style={styles.badgeLabel}>
            {meta.label}
          </ThemedText>
        </View>
        {list.map((item, index) => (
          <ThemedView
            key={`${asker}-${index}`}
            type="backgroundElement"
            style={[styles.card, { borderColor: theme.border }]}>
            {item.asker_detail ? (
              <ThemedText type="small" themeColor="textSecondary">
                {item.asker_detail}
              </ThemedText>
            ) : null}
            <ThemedText style={styles.findingTitle}>{item.question}</ThemedText>
            <ThemedText type="small" themeColor="text80">
              {item.answer}
            </ThemedText>
            {item.trap ? (
              <View style={[styles.trapBlock, { borderLeftColor: theme.error }]}>
                <ThemedText type="smallBold" themeColor="error">
                  Uwaga
                </ThemedText>
                <ThemedText type="small" themeColor="text80">
                  {item.trap}
                </ThemedText>
              </View>
            ) : null}
          </ThemedView>
        ))}
      </View>
    );
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Wróć
          </ThemedText>
        </Pressable>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {!loading && error && !topic ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetryLoad} />
          </View>
        ) : null}

        {topic ? (
          <>
            <View style={styles.header}>
              <ThemedText style={styles.title}>{topic.title}</ThemedText>
              <View style={styles.headerMeta}>
                <TopicStatusChip status={topic.status} />
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(topic.created_at)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {polishPlural(topic.documents.length, 'dokument', 'dokumenty', 'dokumentów')}
                {topic.source_chars > 0
                  ? `, ${polishPlural(topic.source_chars, 'znak', 'znaki', 'znaków')}`
                  : ''}
              </ThemedText>
            </View>

            {working ? <InlineProgressBar progress={workProgress} /> : null}

            {workError ? (
              <ThemedText type="small" themeColor="error">
                {workError}
              </ThemedText>
            ) : null}

            {isGenerating && !working ? (
              <View style={styles.section}>
                <ThemedText type="small" themeColor="text80">
                  Generacja dossier nie została dokończona. Możesz ją wznowić w miejscu, w którym
                  się zatrzymała.
                </ThemedText>
                <PrimaryButton title="Dokończ generację" onPress={() => void handleResume()} />
              </View>
            ) : null}

            {dossier && dossier.summary ? (
              <View style={styles.section}>
                <ThemedText themeColor="accent" style={styles.kicker}>
                  Podsumowanie
                </ThemedText>
                <ThemedText themeColor="text80" style={styles.summary}>
                  {dossier.summary}
                </ThemedText>
              </View>
            ) : null}

            {numbers.length > 0 ? (
              <View style={styles.section}>
                <ThemedText themeColor="accent" style={styles.kicker}>
                  Kluczowe liczby
                </ThemedText>
                {numbers.map((num, index) => {
                  const meta = NUMBER_STATUS_META[num.status];
                  return (
                    <ThemedView
                      key={index}
                      type="backgroundElement"
                      style={[styles.card, { borderColor: theme.border }]}>
                      <ThemedText style={styles.numberValue} themeColor="accentLight">
                        {num.value}
                      </ThemedText>
                      <ThemedText style={styles.findingTitle}>{num.label}</ThemedText>
                      {num.context ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {num.context}
                        </ThemedText>
                      ) : null}
                      <View style={[styles.badge, { borderColor: theme[meta.color] }]}>
                        <ThemedText type="small" themeColor={meta.color} style={styles.badgeLabel}>
                          {meta.label}
                        </ThemedText>
                      </View>
                    </ThemedView>
                  );
                })}
              </View>
            ) : null}

            {questions.length > 0 ? (
              <View style={styles.section}>
                <ThemedText themeColor="accent" style={styles.kicker}>
                  Przewidywane pytania
                </ThemedText>
                {renderQuestions(journalistQuestions, 'dziennikarz')}
                {renderQuestions(rivalQuestions, 'rywal')}
              </View>
            ) : null}

            {attack.length > 0 || defense.length > 0 ? (
              <View style={styles.section}>
                <ThemedText themeColor="accent" style={styles.kicker}>
                  Linie ataku i obrony
                </ThemedText>

                {attack.length > 0 ? (
                  <View style={styles.subSection}>
                    <ThemedText type="smallBold" themeColor="accentLight">
                      Atak
                    </ThemedText>
                    {attack.map((line, index) => (
                      <ThemedView
                        key={`attack-${index}`}
                        type="backgroundElement"
                        style={[styles.card, styles.attackCard, { borderColor: theme.border, borderLeftColor: theme.accent }]}>
                        {line.target ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            {line.target}
                          </ThemedText>
                        ) : null}
                        <ThemedText style={styles.findingTitle}>{line.claim}</ThemedText>
                        {line.evidence ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            {line.evidence}
                          </ThemedText>
                        ) : null}
                        {line.message ? (
                          <View style={[styles.quoteBlock, { borderLeftColor: theme.accent }]}>
                            <ThemedText style={styles.quoteText} themeColor="text80">
                              {line.message}
                            </ThemedText>
                          </View>
                        ) : null}
                        {line.caution ? (
                          <View style={[styles.trapBlock, { borderLeftColor: theme.error }]}>
                            <ThemedText type="smallBold" themeColor="error">
                              Uwaga na kontrę
                            </ThemedText>
                            <ThemedText type="small" themeColor="text80">
                              {line.caution}
                            </ThemedText>
                          </View>
                        ) : null}
                      </ThemedView>
                    ))}
                  </View>
                ) : null}

                {defense.length > 0 ? (
                  <View style={styles.subSection}>
                    <ThemedText type="smallBold" themeColor="teal">
                      Obrona
                    </ThemedText>
                    {defense.map((line, index) => (
                      <ThemedView
                        key={`defense-${index}`}
                        type="backgroundElement"
                        style={[styles.card, styles.attackCard, { borderColor: theme.border, borderLeftColor: theme.teal }]}>
                        <ThemedText style={styles.findingTitle}>{line.attack}</ThemedText>
                        {line.response ? (
                          <ThemedText type="small" themeColor="text80">
                            {line.response}
                          </ThemedText>
                        ) : null}
                        {line.bridge ? (
                          <View style={styles.suggestedUse}>
                            <ThemedText type="smallBold" themeColor="teal">
                              Most
                            </ThemedText>
                            <ThemedText type="small" themeColor="text80">
                              {line.bridge}
                            </ThemedText>
                          </View>
                        ) : null}
                      </ThemedView>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {topic.status === 'ready' && hasDossier ? (
              <View style={styles.section}>
                <ThemedText themeColor="accent" style={styles.kicker}>
                  Zapytaj o ten temat
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Odpowiedź opiera się wyłącznie na wgranym materiale. Poza nim usłyszysz, że brak
                  danych w źródle.
                </ThemedText>
                <FormTextInput
                  label="Pytanie"
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="Na przykład ile kosztuje kwota wolna 60 tys.?"
                  autoCapitalize="sentences"
                  multiline
                />
                {askError ? (
                  <ThemedText type="small" themeColor="error">
                    {askError}
                  </ThemedText>
                ) : null}
                <PrimaryButton
                  title="Zapytaj"
                  variant="secondary"
                  loading={asking}
                  onPress={() => void handleAsk()}
                />
                {answer ? (
                  <ThemedView
                    type="backgroundElement"
                    style={[styles.card, { borderColor: theme.border }]}>
                    <ThemedText themeColor="text80">{answer}</ThemedText>
                  </ThemedView>
                ) : null}
              </View>
            ) : null}

            {!isGenerating ? (
              <View style={styles.actions}>
                <PrimaryButton
                  title="Dodaj dokument"
                  variant="secondary"
                  disabled={working}
                  onPress={() => void handleAddDocument()}
                />
                <PrimaryButton
                  title="Wygeneruj ponownie"
                  variant="secondary"
                  disabled={working}
                  onPress={() => void handleRegenerate()}
                />
                <PrimaryButton
                  title={deleteArmed ? 'Potwierdź usunięcie' : 'Usuń temat'}
                  variant="secondary"
                  loading={deleting}
                  disabled={working}
                  onPress={() => void handleDelete()}
                />
              </View>
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
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
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
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  subSection: {
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
  },
  summary: {
    fontSize: FontSize.body,
    lineHeight: FontSize.body * 1.55,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  attackCard: {
    borderLeftWidth: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
  badgeLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  numberValue: {
    fontFamily: FontFamily.serifBold,
    fontSize: 26,
    lineHeight: 32,
  },
  findingTitle: {
    fontFamily: FontFamily.sansSemiBold,
  },
  quoteBlock: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    gap: Spacing.one,
  },
  quoteText: {
    fontFamily: FontFamily.serifItalic,
    fontSize: 18,
    lineHeight: 26,
  },
  trapBlock: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    gap: Spacing.one,
  },
  suggestedUse: {
    gap: Spacing.one,
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  actions: {
    gap: Spacing.two,
  },
});
