import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  CHANNELS,
  CHANNEL_LABELS,
  createDraft,
  listSegments,
  runGeneration,
  type Channel,
  type ContentSegment,
  type GenerateStepResult,
} from '@/lib/api/content';

const TOPIC_MIN_LENGTH = 5;

type Phase = 'form' | 'generating';

/**
 * Pełnoekranowy stan generacji z realnym postępem z pętli generate_step.
 * Po wygenerowaniu wszystkich wariantów backend robi kontrolę spójności,
 * stąd osobna etykieta na końcu.
 */
function GenerationLoader({
  step,
  total,
}: {
  step: GenerateStepResult | null;
  total: number | null;
}) {
  const theme = useTheme();
  const knownTotal = step?.total ?? total ?? 0;
  const processed = step?.processed ?? 0;
  const checkingConsistency = step !== null && knownTotal > 0 && processed >= knownTotal;
  const label = checkingConsistency
    ? 'Sprawdzam spójność z Twoją historią'
    : knownTotal > 0
      ? `Wariant ${Math.min(processed + 1, knownTotal)} z ${knownTotal}`
      : 'Przygotowuję generację';
  const ratio = knownTotal > 0 ? Math.min(processed / knownTotal, 1) : 0;

  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={theme.accent} />
      <ThemedText style={styles.loaderStep}>{label}</ThemedText>
      <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.accent, width: `${Math.round(ratio * 100)}%` },
          ]}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        Generacja może potrwać kilka minut. Nie zamykaj aplikacji.
      </ThemedText>
    </View>
  );
}

/** Formularz nowego przekazu: temat, komunikat, segmenty, kanały. */
export default function NewContentScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('form');
  const [topic, setTopic] = useState('');
  const [coreMessage, setCoreMessage] = useState('');
  const [segments, setSegments] = useState<ContentSegment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState<GenerateStepResult | null>(null);
  const [totalVariants, setTotalVariants] = useState<number | null>(null);

  // Draft utrzymujemy między próbami: kroki generacji są idempotentne,
  // więc "Spróbuj ponownie" wznawia pętlę na tym samym drafcie.
  const draftIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSegments = useCallback(async () => {
    try {
      const list = await listSegments();
      if (mountedRef.current) {
        setSegments(list);
      }
    } catch {
      // Brak segmentów nie blokuje formularza: generujemy wtedy wersję ogólną.
      if (mountedRef.current) {
        setSegments([]);
      }
    } finally {
      if (mountedRef.current) {
        setSegmentsLoading(false);
      }
    }
  }, []);

  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void loadSegments();
    }
  }, [loadSegments]);

  const toggleSegment = (id: string) => {
    setSelectedSegmentIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleChannel = (channel: Channel) => {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    );
  };

  const runGenerationLoop = async (draftId: string) => {
    const finalStep = await runGeneration(draftId, (step) => {
      if (mountedRef.current) {
        setGenerationStep(step);
      }
    });
    track('content_generated', { variants: finalStep.total });
    router.replace(`/content/${draftId}`);
  };

  const handleGenerate = async () => {
    const trimmedTopic = topic.trim();
    if (trimmedTopic.length < TOPIC_MIN_LENGTH) {
      setFormError('Podaj temat przekazu, co najmniej 5 znaków.');
      return;
    }
    if (selectedChannels.length === 0) {
      setFormError('Wybierz co najmniej jeden kanał.');
      return;
    }

    setFormError(null);
    setGenerationError(null);
    setGenerationStep(null);
    setPhase('generating');

    try {
      let draftId = draftIdRef.current;
      if (!draftId) {
        const created = await createDraft({
          topic: trimmedTopic,
          core_message: coreMessage.trim() || undefined,
          segment_ids: selectedSegmentIds,
          channels: selectedChannels,
        });
        draftId = created.draft_id;
        draftIdRef.current = draftId;
        if (mountedRef.current) {
          setTotalVariants(created.total_variants);
        }
      }
      await runGenerationLoop(draftId);
    } catch (error) {
      if (mountedRef.current) {
        setGenerationError(
          error instanceof Error ? error.message : 'Nie udało się wygenerować przekazu.'
        );
      }
    }
  };

  // Wznowienie pętli po błędzie: ten sam draft, te same kroki.
  const handleRetry = async () => {
    const draftId = draftIdRef.current;
    if (!draftId) {
      setPhase('form');
      return;
    }
    setGenerationError(null);
    try {
      await runGenerationLoop(draftId);
    } catch (error) {
      if (mountedRef.current) {
        setGenerationError(
          error instanceof Error ? error.message : 'Nie udało się wygenerować przekazu.'
        );
      }
    }
  };

  if (phase === 'generating') {
    return (
      <ThemedView style={styles.screen}>
        {generationError ? (
          <View style={styles.loader}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {generationError}
            </ThemedText>
            <View style={styles.retryButtons}>
              <PrimaryButton title="Spróbuj ponownie" onPress={() => void handleRetry()} />
            </View>
          </View>
        ) : (
          <GenerationLoader step={generationStep} total={totalVariants} />
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
          <ThemedText style={styles.title}>Nowy przekaz</ThemedText>
          <ThemedText themeColor="text80">
            Podaj temat, a Argus przygotuje warianty treści w Twoim stylu i sprawdzi je ze
            strażnikiem spójności.
          </ThemedText>
        </View>

        <FormTextInput
          label="Temat"
          value={topic}
          onChangeText={setTopic}
          placeholder="Na przykład podwyżka cen biletów kolejowych"
          autoCapitalize="sentences"
        />

        <FormTextInput
          label="Kluczowy komunikat (opcjonalnie)"
          value={coreMessage}
          onChangeText={setCoreMessage}
          placeholder="Jedna myśl, która ma wybrzmieć w każdym wariancie"
          multiline
          numberOfLines={3}
          style={styles.multiline}
        />

        <View style={styles.section}>
          <ThemedText themeColor="accent" style={styles.kicker}>
            Segmenty
          </ThemedText>
          {segmentsLoading ? (
            <ActivityIndicator color={theme.accent} />
          ) : segments.length === 0 ? (
            <ThemedView
              type="backgroundElement"
              style={[styles.infoCard, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="text80">
                Nie masz jeszcze segmentów wyborców. Bez segmentów przygotuję wersję ogólną.
                Segmenty możesz dodać później w onboardingu z zakładki Profil.
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.chips}>
              {segments.map((segment) => {
                const active = selectedSegmentIds.includes(segment.id);
                return (
                  <Pressable
                    key={segment.id}
                    accessibilityRole="button"
                    onPress={() => toggleSegment(segment.id)}
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
                      {segment.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
          {!segmentsLoading && segments.length > 0 && selectedSegmentIds.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Bez zaznaczonych segmentów przygotuję wersję ogólną.
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText themeColor="accent" style={styles.kicker}>
            Kanały
          </ThemedText>
          <View style={styles.chips}>
            {CHANNELS.map((channel) => {
              const active = selectedChannels.includes(channel);
              return (
                <Pressable
                  key={channel}
                  accessibilityRole="button"
                  onPress={() => toggleChannel(channel)}
                  style={({ pressed }) => [
                    styles.chip,
                    active
                      ? { backgroundColor: theme.cta, borderColor: theme.cta }
                      : {
                          backgroundColor: theme.backgroundSelected,
                          borderColor: theme.border,
                        },
                    pressed && styles.dimmed,
                  ]}>
                  <ThemedText
                    type="small"
                    themeColor={active ? 'onAccent' : 'textSecondary'}
                    style={styles.chipLabel}>
                    {CHANNEL_LABELS[channel]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {formError ? (
          <ThemedText type="small" themeColor="error">
            {formError}
          </ThemedText>
        ) : null}

        <PrimaryButton title="Generuj przekaz" onPress={() => void handleGenerate()} />
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
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  section: {
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
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
  chipLabel: {
    fontFamily: FontFamily.sansSemiBold,
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
