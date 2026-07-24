import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalysisStatusChip } from '@/components/analysis-status-chip';
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
  addDocument,
  deleteAnalysis,
  getAnalysis,
  reanalyze,
  runAnalyze,
  runCollect,
  type Analysis,
  type AnalyzeStepResult,
  type ClaimVerdict,
  type CollectStepResult,
  type FindingSeverity,
} from '@/lib/api/analysis';
import { pickAnalysisDocument } from '@/lib/documents';
import { formatDate, polishPlural } from '@/lib/format';

import type { ThemeColor } from '@/constants/theme';

const DELETE_CONFIRM_MS = 3000;

const SEVERITY_META: Record<FindingSeverity, { label: string; color: ThemeColor }> = {
  3: { label: 'Poważna', color: 'error' },
  2: { label: 'Istotna', color: 'accent' },
  1: { label: 'Drobna', color: 'textSecondary' },
};

const VERDICT_META: Record<ClaimVerdict, { label: string; color: ThemeColor }> = {
  sprzeczne: { label: 'Sprzeczne', color: 'error' },
  potwierdzone: { label: 'Potwierdzone', color: 'success' },
  'brak danych': { label: 'Brak danych', color: 'textSecondary' },
};

const COLLECT_LABELS: Record<CollectStepResult['phase'], string> = {
  statements: 'Zbieram wystąpienia',
  votes: 'Zbieram głosowania',
  embeddings: 'Liczę wektory',
  done: 'Porządkuję dane',
};

const ANALYZE_LABELS: Record<AnalyzeStepResult['phase'], string> = {
  retrieval: 'Szukam niespójności',
  findings: 'Szukam niespójności',
  documents: 'Weryfikuję dokumenty',
  done: 'Porządkuję wyniki',
};

const EVIDENCE_TYPE_LABELS: Record<'statement' | 'vote', string> = {
  statement: 'wypowiedź',
  vote: 'głosowanie',
};

type InlineProgress = {
  label: string;
  processed: number;
  total: number;
};

/** Meta źródeł: "48 wypowiedzi, 120 głosowań, 1 dokument". */
function sourcesLine(summary: Analysis['findings']['sources_summary']): string {
  const parts = [
    polishPlural(summary.statements, 'wypowiedź', 'wypowiedzi', 'wypowiedzi'),
    polishPlural(summary.votes, 'głosowanie', 'głosowania', 'głosowań'),
  ];
  if (summary.documents > 0) {
    parts.push(polishPlural(summary.documents, 'dokument', 'dokumenty', 'dokumentów'));
  }
  return parts.join(', ');
}

/** Pasek postępu pętli wznowienia albo ponownej analizy, w treści ekranu. */
function InlineProgressBar({ progress }: { progress: InlineProgress | null }) {
  const theme = useTheme();
  const label = progress?.label ?? 'Przygotowuję analizę';
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

/** Widok analizy niespójności: ustalenia, weryfikacja dokumentów, akcje. */
export default function AnalysisScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [working, setWorking] = useState(false);
  const [workProgress, setWorkProgress] = useState<InlineProgress | null>(null);
  const [workError, setWorkError] = useState<string | null>(null);

  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const mountedRef = useRef(true);
  const viewTrackedRef = useRef(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  const loadAnalysis = useCallback(async () => {
    if (!id) {
      setError('Nie znaleziono analizy.');
      setLoading(false);
      return;
    }
    try {
      const loaded = await getAnalysis(id);
      if (!mountedRef.current) {
        return;
      }
      setAnalysis(loaded);
      setError(null);
      if (!viewTrackedRef.current) {
        viewTrackedRef.current = true;
        track('analysis_viewed', { status: loaded.status });
      }
    } catch (loadError) {
      if (mountedRef.current) {
        setError(
          loadError instanceof Error ? loadError.message : 'Nie udało się wczytać analizy.'
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [id]);

  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void loadAnalysis();
    }
  }, [loadAnalysis]);

  const handleRetryLoad = () => {
    setLoading(true);
    setError(null);
    void loadAnalysis();
  };

  const setProgress = useCallback((label: string, processed: number, total: number) => {
    if (mountedRef.current) {
      setWorkProgress({ label, processed, total });
    }
  }, []);

  /** Pętla analyze z postępem inline i przeładowaniem wyniku na końcu. */
  const runAnalyzeLoop = useCallback(
    async (analysisId: string) => {
      await runAnalyze(analysisId, (step) => {
        setProgress(ANALYZE_LABELS[step.phase], step.processed, step.total);
      });
      await loadAnalysis();
    },
    [loadAnalysis, setProgress]
  );

  /** Wznowienie przerwanej analizy: collect (gdy trzeba), potem analyze. */
  const handleResume = async () => {
    if (!analysis || working) {
      return;
    }
    setWorking(true);
    setWorkError(null);
    setWorkProgress(null);
    try {
      if (analysis.status === 'collecting') {
        await runCollect(analysis.id, (step) => {
          setProgress(COLLECT_LABELS[step.phase], step.processed, step.total);
        });
      }
      await runAnalyzeLoop(analysis.id);
    } catch (resumeError) {
      if (mountedRef.current) {
        setWorkError(
          resumeError instanceof Error ? resumeError.message : 'Nie udało się wznowić analizy.'
        );
      }
    } finally {
      if (mountedRef.current) {
        setWorking(false);
        setWorkProgress(null);
      }
    }
  };

  /** Dodanie dokumentu do gotowej analizy: picker → add_document → reanalyze. */
  const handleAddDocument = async () => {
    if (!analysis || working) {
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
      await addDocument({
        analysis_id: analysis.id,
        filename: picked.filename,
        mime: picked.mime,
        text: picked.text,
        content_base64: picked.contentBase64,
      });
      track('analysis_document_added', { mime: picked.mime });
      await reanalyze(analysis.id);
      await runAnalyzeLoop(analysis.id);
    } catch (docError) {
      if (mountedRef.current) {
        setWorkError(
          docError instanceof Error ? docError.message : 'Nie udało się dodać dokumentu.'
        );
      }
    } finally {
      if (mountedRef.current) {
        setWorking(false);
        setWorkProgress(null);
      }
    }
  };

  /** Usunięcie z potwierdzeniem: drugie tapnięcie w ciągu 3 sekund. */
  const handleDelete = async () => {
    if (!analysis || deleting) {
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
      await deleteAnalysis(analysis.id);
      router.back();
    } catch (deleteError) {
      if (mountedRef.current) {
        setWorkError(
          deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć analizy.'
        );
        setDeleting(false);
        setDeleteArmed(false);
      }
    }
  };

  const findings = analysis?.findings;
  const items = findings?.items ?? [];
  const reviews = findings?.document_review ?? [];
  const summary = findings?.sources_summary;
  const hasSources = summary
    ? summary.statements > 0 || summary.votes > 0 || summary.documents > 0
    : false;
  const inProgress = analysis?.status === 'collecting' || analysis?.status === 'analyzing';

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

        {!loading && error && !analysis ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetryLoad} />
          </View>
        ) : null}

        {analysis ? (
          <>
            <View style={styles.header}>
              <ThemedText style={styles.title}>{analysis.topic}</ThemedText>
              <ThemedText themeColor="text80">{analysis.target_name}</ThemedText>
              <View style={styles.headerMeta}>
                <AnalysisStatusChip status={analysis.status} />
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(analysis.created_at)}
                </ThemedText>
              </View>
              {hasSources && summary ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Źródła: {sourcesLine(summary)}
                </ThemedText>
              ) : null}
            </View>

            {working ? <InlineProgressBar progress={workProgress} /> : null}

            {workError ? (
              <ThemedText type="small" themeColor="error">
                {workError}
              </ThemedText>
            ) : null}

            {inProgress && !working ? (
              <View style={styles.section}>
                <ThemedText type="small" themeColor="text80">
                  Ta analiza została przerwana przed zakończeniem. Możesz ją wznowić w miejscu,
                  w którym się zatrzymała.
                </ThemedText>
                <PrimaryButton title="Wznów" onPress={() => void handleResume()} />
              </View>
            ) : null}

            {analysis.status === 'error' && !working ? (
              <View style={styles.section}>
                <ThemedText type="small" themeColor="error">
                  Analiza zakończyła się błędem. Możesz spróbować ponownie.
                </ThemedText>
                <PrimaryButton title="Wznów" onPress={() => void handleResume()} />
              </View>
            ) : null}

            {items.length > 0 ? (
              <View style={styles.section}>
                <ThemedText themeColor="accent" style={styles.kicker}>
                  Ustalenia
                </ThemedText>
                {items.map((item, index) => {
                  const severity = SEVERITY_META[item.severity];
                  return (
                    <ThemedView
                      key={index}
                      type="backgroundElement"
                      style={[styles.card, { borderColor: theme.border }]}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.severityBadge, { borderColor: theme[severity.color] }]}>
                          <ThemedText
                            type="small"
                            themeColor={severity.color}
                            style={styles.badgeLabel}>
                            {severity.label}
                          </ThemedText>
                        </View>
                        {item.mp_name ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            {item.mp_name}
                          </ThemedText>
                        ) : null}
                      </View>

                      <ThemedText style={styles.findingTitle}>{item.title}</ThemedText>
                      <ThemedText type="small" themeColor="text80">
                        {item.description}
                      </ThemedText>

                      {item.evidence.map((evidence, evidenceIndex) => (
                        <View
                          key={evidenceIndex}
                          style={[styles.quoteBlock, { borderLeftColor: theme.accent }]}>
                          <ThemedText style={styles.quoteText} themeColor="text80">
                            {evidence.quote}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {[formatDate(evidence.date), EVIDENCE_TYPE_LABELS[evidence.type]]
                              .filter((part) => part.length > 0)
                              .join(', ')}
                          </ThemedText>
                        </View>
                      ))}

                      {item.suggested_use ? (
                        <View style={styles.suggestedUse}>
                          <ThemedText type="smallBold" themeColor="accentLight">
                            Jak wykorzystać
                          </ThemedText>
                          <ThemedText type="small" themeColor="text80">
                            {item.suggested_use}
                          </ThemedText>
                        </View>
                      ) : null}
                    </ThemedView>
                  );
                })}
              </View>
            ) : null}

            {analysis.status === 'ready' && items.length === 0 ? (
              <ThemedView
                type="backgroundElement"
                style={[styles.card, { borderColor: theme.border }]}>
                <ThemedText themeColor="text80">
                  Nie znalazłem istotnych niespójności w zebranych danych.
                </ThemedText>
              </ThemedView>
            ) : null}

            {reviews.length > 0 ? (
              <View style={styles.section}>
                <ThemedText themeColor="accent" style={styles.kicker}>
                  Weryfikacja dokumentu
                </ThemedText>
                {reviews.map((review) => (
                  <ThemedView
                    key={review.document_id}
                    type="backgroundElement"
                    style={[styles.card, { borderColor: theme.border }]}>
                    <ThemedText style={styles.findingTitle}>{review.filename}</ThemedText>
                    {review.claims.map((claim, claimIndex) => {
                      const verdict = VERDICT_META[claim.verdict];
                      return (
                        <View key={claimIndex} style={styles.claim}>
                          <ThemedText type="small" themeColor="text80">
                            {claim.claim}
                          </ThemedText>
                          <View
                            style={[styles.severityBadge, { borderColor: theme[verdict.color] }]}>
                            <ThemedText
                              type="small"
                              themeColor={verdict.color}
                              style={styles.badgeLabel}>
                              {verdict.label}
                            </ThemedText>
                          </View>
                          {claim.explanation ? (
                            <ThemedText type="small" themeColor="textSecondary">
                              {claim.explanation}
                            </ThemedText>
                          ) : null}
                        </View>
                      );
                    })}
                  </ThemedView>
                ))}
              </View>
            ) : null}

            {!inProgress ? (
              <View style={styles.actions}>
                <PrimaryButton
                  title="Dodaj dokument"
                  variant="secondary"
                  disabled={working}
                  onPress={() => void handleAddDocument()}
                />
                <PrimaryButton
                  title={deleteArmed ? 'Potwierdź usunięcie' : 'Usuń analizę'}
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
  kicker: {
    ...KickerStyle,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  severityBadge: {
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
  suggestedUse: {
    gap: Spacing.one,
  },
  claim: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
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
