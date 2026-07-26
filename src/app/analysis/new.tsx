import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  addDocument,
  createAnalysis,
  runAnalyze,
  runCollect,
  searchTargets,
  type AnalyzeStepResult,
  type CollectStepResult,
  type TargetClub,
  type TargetMp,
} from '@/lib/api/analysis';
import { formatDocumentSize, pickAnalysisDocument, type PickedDocument } from '@/lib/documents';
import { polishPlural } from '@/lib/format';

const TOPIC_MIN_LENGTH = 5;
const MAX_MPS = 5;
const SEARCH_DEBOUNCE_MS = 400;

type TargetMode = 'mps' | 'club';
type Phase = 'form' | 'running';
type RunStage = 'documents' | 'collect' | 'analyze';

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

type RunProgress = {
  stage: RunStage;
  label: string;
  processed: number;
  total: number;
};

/** Pełnoekranowy stan pracy z realnym postępem z pętli collect/analyze. */
function AnalysisLoader({ progress }: { progress: RunProgress | null }) {
  const theme = useTheme();
  const label = progress?.label ?? 'Przygotowuję analizę';
  const showCount = progress !== null && progress.total > 0;
  const ratio = showCount ? Math.min(progress.processed / progress.total, 1) : 0;

  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={theme.accent} />
      <ThemedText style={styles.loaderStep}>{label}</ThemedText>
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
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        Pierwsza analiza nowego celu może potrwać kilkanaście minut, kolejne są szybsze. Nie
        zamykaj aplikacji.
      </ThemedText>
    </View>
  );
}

/** Formularz nowej analizy: temat, cel (posłowie albo klub), dokumenty. */
export default function NewAnalysisScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('form');
  const [topic, setTopic] = useState('');
  const [targetMode, setTargetMode] = useState<TargetMode>('mps');

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [mpResults, setMpResults] = useState<TargetMp[]>([]);
  const [clubResults, setClubResults] = useState<TargetClub[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedMps, setSelectedMps] = useState<TargetMp[]>([]);
  const [selectedClub, setSelectedClub] = useState<TargetClub | null>(null);

  const [documents, setDocuments] = useState<PickedDocument[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);

  // Analiza i postęp wysyłki utrzymywane między próbami: kroki są
  // idempotentne, więc "Spróbuj ponownie" wznawia pętlę w tym samym miejscu.
  const analysisIdRef = useRef<string | null>(null);
  const uploadedDocsRef = useRef(0);
  const collectDoneRef = useRef(false);
  const mountedRef = useRef(true);
  const latestQueryRef = useRef('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  /** Wyszukiwanie celu z debounce, wspólne dla trybu posłów i klubu. */
  const handleQueryChange = (text: string) => {
    setQuery(text);
    const trimmed = text.trim();
    latestQueryRef.current = trimmed;

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (trimmed.length < 2) {
      setMpResults([]);
      setClubResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const result = await searchTargets(trimmed);
        if (latestQueryRef.current === trimmed && mountedRef.current) {
          setMpResults(result.mps);
          setClubResults(result.clubs);
          setSearchError(null);
        }
      } catch (error) {
        if (latestQueryRef.current === trimmed && mountedRef.current) {
          setMpResults([]);
          setClubResults([]);
          setSearchError(
            error instanceof Error ? error.message : 'Nie udało się wyszukać celu analizy.'
          );
        }
      } finally {
        if (latestQueryRef.current === trimmed && mountedRef.current) {
          setSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const switchMode = (mode: TargetMode) => {
    if (mode === targetMode) {
      return;
    }
    setTargetMode(mode);
    setQuery('');
    setMpResults([]);
    setClubResults([]);
    setSearchError(null);
    setFormError(null);
  };

  const addMp = (mp: TargetMp) => {
    setSelectedMps((current) => {
      if (current.some((item) => item.mp_id === mp.mp_id) || current.length >= MAX_MPS) {
        return current;
      }
      return [...current, mp];
    });
    setQuery('');
    setMpResults([]);
    setClubResults([]);
  };

  const removeMp = (mpId: number) => {
    setSelectedMps((current) => current.filter((item) => item.mp_id !== mpId));
  };

  const chooseClub = (club: TargetClub) => {
    setSelectedClub(club);
    setQuery('');
    setMpResults([]);
    setClubResults([]);
  };

  const handleAddDocument = async () => {
    if (pickerBusy) {
      return;
    }
    setPickerBusy(true);
    setPickerError(null);
    try {
      const picked = await pickAnalysisDocument();
      if (picked && mountedRef.current) {
        setDocuments((current) => [...current, picked]);
      }
    } catch (error) {
      if (mountedRef.current) {
        setPickerError(error instanceof Error ? error.message : 'Nie udało się dodać dokumentu.');
      }
    } finally {
      if (mountedRef.current) {
        setPickerBusy(false);
      }
    }
  };

  const removeDocument = (index: number) => {
    setDocuments((current) => current.filter((_, i) => i !== index));
  };

  /**
   * Pełny przebieg: create → add_document(y) → pętla collect → pętla analyze.
   * Wznawialny: analysis_id, liczba wysłanych dokumentów i zakończone zbieranie
   * trzymane w refach, więc retry kontynuuje od miejsca błędu.
   */
  const runPipeline = async () => {
    let analysisId = analysisIdRef.current;
    if (!analysisId) {
      const created = await createAnalysis({
        topic: topic.trim(),
        target:
          targetMode === 'mps'
            ? { type: 'mps', mp_ids: selectedMps.map((mp) => mp.mp_id) }
            : { type: 'club', club: selectedClub?.id ?? '' },
      });
      analysisId = created.analysis_id;
      analysisIdRef.current = analysisId;
    }

    while (uploadedDocsRef.current < documents.length) {
      const doc = documents[uploadedDocsRef.current];
      if (mountedRef.current) {
        setRunProgress({
          stage: 'documents',
          label: 'Wysyłam dokumenty',
          processed: uploadedDocsRef.current,
          total: documents.length,
        });
      }
      await addDocument({
        analysis_id: analysisId,
        filename: doc.filename,
        mime: doc.mime,
        text: doc.text,
        content_base64: doc.contentBase64,
      });
      uploadedDocsRef.current += 1;
    }

    if (!collectDoneRef.current) {
      await runCollect(analysisId, (step) => {
        if (mountedRef.current) {
          setRunProgress({
            stage: 'collect',
            label: COLLECT_LABELS[step.phase],
            processed: step.processed,
            total: step.total,
          });
        }
      });
      collectDoneRef.current = true;
    }

    await runAnalyze(analysisId, (step) => {
      if (mountedRef.current) {
        setRunProgress({
          stage: 'analyze',
          label: ANALYZE_LABELS[step.phase],
          processed: step.processed,
          total: step.total,
        });
      }
    });

    track('analysis_created', {
      target_type: targetMode,
      mps: targetMode === 'mps' ? selectedMps.length : 0,
      documents: documents.length,
    });
    // Nie wyrywamy użytkownika z ekranu, na którym jest teraz, jeśli w trakcie
    // długiej analizy zdążył odejść.
    if (!mountedRef.current) return;
    router.replace(`/analysis/${analysisId}`);
  };

  const handleAnalyze = async () => {
    const trimmedTopic = topic.trim();
    if (trimmedTopic.length < TOPIC_MIN_LENGTH) {
      setFormError('Podaj temat analizy, co najmniej 5 znaków.');
      return;
    }
    if (targetMode === 'mps' && selectedMps.length === 0) {
      setFormError('Wybierz co najmniej jedną osobę do analizy.');
      return;
    }
    if (targetMode === 'club' && !selectedClub) {
      setFormError('Wybierz klub do analizy.');
      return;
    }

    setFormError(null);
    setRunError(null);
    setRunProgress(null);
    setPhase('running');

    try {
      await runPipeline();
    } catch (error) {
      if (mountedRef.current) {
        setRunError(
          error instanceof Error ? error.message : 'Nie udało się przeprowadzić analizy.'
        );
      }
    }
  };

  // Wznowienie po błędzie: te same kroki, ten sam analysis_id.
  const handleRetry = async () => {
    setRunError(null);
    try {
      await runPipeline();
    } catch (error) {
      if (mountedRef.current) {
        setRunError(
          error instanceof Error ? error.message : 'Nie udało się przeprowadzić analizy.'
        );
      }
    }
  };

  if (phase === 'running') {
    return (
      <ThemedView style={styles.screen}>
        {runError ? (
          <View style={styles.loader}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {runError}
            </ThemedText>
            <View style={styles.retryButtons}>
              <PrimaryButton title="Spróbuj ponownie" onPress={() => void handleRetry()} />
            </View>
          </View>
        ) : (
          <AnalysisLoader progress={runProgress} />
        )}
      </ThemedView>
    );
  }

  const results = targetMode === 'mps' ? mpResults : clubResults;

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

        <View style={styles.header}>
          <ThemedText style={styles.title}>Nowa analiza</ThemedText>
          <ThemedText themeColor="text80">
            Argus zbierze wystąpienia i głosowania wskazanych osób, a potem znajdzie niespójności
            z cytatami i datami.
          </ThemedText>
        </View>

        <FormTextInput
          label="Temat"
          value={topic}
          onChangeText={setTopic}
          placeholder="Na przykład finansowanie ochrony zdrowia"
          autoCapitalize="sentences"
        />

        <View style={styles.section}>
          <ThemedText themeColor="accent" style={styles.kicker}>
            Cel analizy
          </ThemedText>
          <View style={styles.chips}>
            {(
              [
                { mode: 'mps' as const, label: 'Posłowie i posłanki' },
                { mode: 'club' as const, label: 'Klub' },
              ] as const
            ).map(({ mode, label }) => {
              const active = targetMode === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  onPress={() => switchMode(mode)}
                  style={({ pressed }) => [
                    styles.chip,
                    active
                      ? { backgroundColor: theme.cta, borderColor: theme.cta }
                      : {
                          backgroundColor: theme.backgroundSelected,
                          borderColor: theme.borderStrong,
                        },
                    pressed && styles.dimmed,
                  ]}>
                  <ThemedText
                    type="small"
                    themeColor={active ? 'onAccent' : 'accentLight'}
                    style={styles.chipLabel}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {targetMode === 'mps' && selectedMps.length > 0 ? (
            <View style={styles.chips}>
              {selectedMps.map((mp) => (
                <Pressable
                  key={mp.mp_id}
                  accessibilityRole="button"
                  onPress={() => removeMp(mp.mp_id)}
                  style={({ pressed }) => [
                    styles.selectedChip,
                    { backgroundColor: theme.backgroundSelected, borderColor: theme.borderStrong },
                    pressed && styles.dimmed,
                  ]}>
                  <ThemedText type="small" themeColor="accentLight" style={styles.chipLabel}>
                    {mp.full_name}
                  </ThemedText>
                  <Ionicons name="close" size={14} color={theme.accentLight} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {targetMode === 'club' && selectedClub ? (
            <ThemedView
              type="backgroundElement"
              style={[styles.infoCard, { borderColor: theme.border }]}>
              <View style={styles.clubRow}>
                <View style={styles.clubInfo}>
                  <ThemedText style={styles.resultName}>{selectedClub.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {polishPlural(selectedClub.mp_count, 'poseł', 'posłów', 'posłów')}
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedClub(null)}
                  hitSlop={8}>
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
              <ThemedText type="small" themeColor="text80">
                Przeanalizujemy do 5 najaktywniejszych posłów klubu.
              </ThemedText>
            </ThemedView>
          ) : null}

          {targetMode === 'mps' && selectedMps.length >= MAX_MPS ? (
            <ThemedText type="small" themeColor="textSecondary">
              Maksymalnie 5 osób w jednej analizie. Usuń kogoś z listy, żeby dodać inną osobę.
            </ThemedText>
          ) : (
            <>
              <FormTextInput
                label={targetMode === 'mps' ? 'Szukaj osoby' : 'Szukaj klubu'}
                value={query}
                onChangeText={handleQueryChange}
                placeholder="Wpisz co najmniej dwa znaki"
                autoCapitalize="words"
                autoCorrect={false}
              />

              {searching ? <ActivityIndicator color={theme.accent} /> : null}

              {searchError ? (
                <ThemedText type="small" themeColor="error">
                  {searchError}
                </ThemedText>
              ) : null}

              {!searching && query.trim().length >= 2 && results.length === 0 && !searchError ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Brak wyników dla tego zapytania. Sprawdź pisownię.
                </ThemedText>
              ) : null}

              {targetMode === 'mps' && mpResults.length > 0 ? (
                <View style={styles.results}>
                  {mpResults
                    .filter((mp) => !selectedMps.some((item) => item.mp_id === mp.mp_id))
                    .map((mp) => (
                      <Pressable
                        key={mp.mp_id}
                        accessibilityRole="button"
                        onPress={() => addMp(mp)}
                        style={({ pressed }) => [
                          styles.resultCard,
                          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                          pressed && styles.dimmed,
                        ]}>
                        <ThemedText style={styles.resultName}>{mp.full_name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {mp.club}
                          {mp.active ? '' : ', mandat wygaszony'}
                        </ThemedText>
                      </Pressable>
                    ))}
                </View>
              ) : null}

              {targetMode === 'club' && clubResults.length > 0 ? (
                <View style={styles.results}>
                  {clubResults.map((club) => (
                    <Pressable
                      key={club.id}
                      accessibilityRole="button"
                      onPress={() => chooseClub(club)}
                      style={({ pressed }) => [
                        styles.resultCard,
                        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                        pressed && styles.dimmed,
                      ]}>
                      <ThemedText style={styles.resultName}>{club.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {polishPlural(club.mp_count, 'poseł', 'posłów', 'posłów')}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText themeColor="accent" style={styles.kicker}>
            Dokumenty
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Opcjonalnie dodaj własny dokument z analizą. Argus zweryfikuje jego twierdzenia
            względem zebranych danych.
          </ThemedText>

          {documents.length > 0 ? (
            <View style={styles.results}>
              {documents.map((doc, index) => (
                <ThemedView
                  key={`${doc.filename}-${index}`}
                  type="backgroundElement"
                  style={[styles.documentRow, { borderColor: theme.border }]}>
                  <Ionicons name="document-text-outline" size={18} color={theme.accent} />
                  <View style={styles.documentInfo}>
                    <ThemedText type="small" style={styles.resultName} numberOfLines={1}>
                      {doc.filename}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {doc.text
                        ? polishPlural(doc.text.length, 'znak', 'znaki', 'znaków')
                        : formatDocumentSize(doc.size)}
                    </ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => removeDocument(index)}
                    hitSlop={8}>
                    <Ionicons name="close" size={18} color={theme.textSecondary} />
                  </Pressable>
                </ThemedView>
              ))}
            </View>
          ) : null}

          {pickerError ? (
            <ThemedText type="small" themeColor="error">
              {pickerError}
            </ThemedText>
          ) : null}

          <PrimaryButton
            title="Dodaj dokument (PDF, TXT, MD)"
            variant="secondary"
            loading={pickerBusy}
            onPress={() => void handleAddDocument()}
          />
        </View>

        {formError ? (
          <ThemedText type="small" themeColor="error">
            {formError}
          </ThemedText>
        ) : null}

        <ThemedText type="small" themeColor="textSecondary">
          Pierwsza analiza nowego celu może potrwać kilkanaście minut, kolejne są szybsze.
        </ThemedText>

        <PrimaryButton title="Analizuj" onPress={() => void handleAnalyze()} />
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
  header: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  section: {
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipLabel: {
    fontFamily: FontFamily.sansSemiBold,
  },
  results: {
    gap: Spacing.two,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  resultName: {
    fontFamily: FontFamily.sansSemiBold,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  clubInfo: {
    flex: 1,
    gap: Spacing.one,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  documentInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  dimmed: {
    opacity: 0.7,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  loaderStep: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    maxWidth: 320,
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  centered: {
    textAlign: 'center',
  },
  retryButtons: {
    width: '100%',
    maxWidth: 320,
    gap: Spacing.two,
  },
});
