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
  addTopicDocument,
  createTopic,
  runTopicGeneration,
  type GeneratePhase,
} from '@/lib/api/topics';
import { formatDocumentSize, pickAnalysisDocument, type PickedDocument } from '@/lib/documents';
import { polishPlural } from '@/lib/format';

const TITLE_MIN_LENGTH = 5;

type Phase = 'form' | 'running';
type RunStage = 'documents' | 'generate';

const GENERATE_LABELS: Record<GeneratePhase, string> = {
  summary: 'Streszczam materiał',
  numbers: 'Wyciągam kluczowe liczby',
  questions: 'Układam przewidywane pytania',
  attack_defense: 'Szykuję linie ataku i obrony',
  done: 'Porządkuję dossier',
};

type RunProgress = {
  stage: RunStage;
  label: string;
  processed: number;
  total: number;
};

/** Pełnoekranowy stan pracy z realnym postępem z pętli generacji. */
function TopicLoader({ progress }: { progress: RunProgress | null }) {
  const theme = useTheme();
  const label = progress?.label ?? 'Przygotowuję dossier';
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
        Generacja dossier zwykle trwa poniżej minuty. Nie zamykaj aplikacji.
      </ThemedText>
    </View>
  );
}

/** Formularz nowego tematu: tytuł, wgranie analizy, generacja dossier. */
export default function NewTopicScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('form');
  const [title, setTitle] = useState('');

  const [documents, setDocuments] = useState<PickedDocument[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);

  // Wznawialny przebieg: topic_id i liczba wysłanych dokumentów w refach,
  // więc "Spróbuj ponownie" kontynuuje od miejsca błędu (kroki idempotentne).
  const topicIdRef = useRef<string | null>(null);
  const uploadedDocsRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
   * Pełny przebieg: create → add_document(y) → pętla generate_step.
   * Wznawialny: topic_id i liczba wysłanych dokumentów trzymane w refach.
   */
  const runPipeline = async () => {
    let topicId = topicIdRef.current;
    if (!topicId) {
      topicId = await createTopic(title.trim());
      topicIdRef.current = topicId;
      track('topic_created', { documents: documents.length });
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
      await addTopicDocument({
        topic_id: topicId,
        filename: doc.filename,
        mime: doc.mime,
        text: doc.text,
        content_base64: doc.contentBase64,
      });
      uploadedDocsRef.current += 1;
      track('topic_document_added', { mime: doc.mime });
    }

    await runTopicGeneration(topicId, (step) => {
      if (mountedRef.current) {
        setRunProgress({
          stage: 'generate',
          label: GENERATE_LABELS[step.phase],
          processed: step.processed,
          total: step.total,
        });
      }
    });

    router.replace(`/topics/${topicId}`);
  };

  const handleGenerate = async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < TITLE_MIN_LENGTH) {
      setFormError('Podaj tytuł tematu, co najmniej 5 znaków.');
      return;
    }
    if (documents.length === 0) {
      setFormError('Dodaj co najmniej jeden dokument z analizą (PDF albo MD).');
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
        setRunError(error instanceof Error ? error.message : 'Nie udało się wygenerować dossier.');
      }
    }
  };

  const handleRetry = async () => {
    setRunError(null);
    try {
      await runPipeline();
    } catch (error) {
      if (mountedRef.current) {
        setRunError(error instanceof Error ? error.message : 'Nie udało się wygenerować dossier.');
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
          <TopicLoader progress={runProgress} />
        )}
      </ThemedView>
    );
  }

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
          <ThemedText style={styles.title}>Nowy temat</ThemedText>
          <ThemedText themeColor="text80">
            Wgraj gotową analizę tematu (np. z NotebookLM). Argus zrobi z niej dossier:
            podsumowanie, kluczowe liczby, przewidywane pytania i linie ataku oraz obrony.
          </ThemedText>
        </View>

        <FormTextInput
          label="Tytuł tematu"
          value={title}
          onChangeText={setTitle}
          placeholder="Na przykład kwota wolna 60 tys. vs składka zdrowotna"
          autoCapitalize="sentences"
        />

        <View style={styles.section}>
          <ThemedText themeColor="accent" style={styles.kicker}>
            Dokumenty
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Wgraj analizę w formacie PDF, TXT albo MD. Dossier powstaje wyłącznie z treści
            wgranych dokumentów, bez dopowiadania z zewnątrz.
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

        <PrimaryButton title="Wygeneruj dossier" onPress={() => void handleGenerate()} />
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
  results: {
    gap: Spacing.two,
  },
  resultName: {
    fontFamily: FontFamily.sansSemiBold,
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
