import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
import { BackLink } from '@/components/back-link';
import { FullScreenProgress } from '@/components/progress';
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
  type TopicFraming,
} from '@/lib/api/content';
import { tematy, znajdzTemat } from '@/lib/knowledge';
import type { Temat } from '@/lib/knowledge/types';

const TOPIC_MIN_LENGTH = 5;

/** Normalizacja nazwy segmentu do luźnego dopasowania korpus ↔ tenant. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Buduje framing dla generatora z wybranego tematu. Stanowisko i warstwy
 * taktyczne obowiązują cały draft; framing per segment dokładany jest tam,
 * gdzie nazwa segmentu tenanta daje się dopasować do segmentu korpusu.
 */
function buildTopicFraming(
  temat: Temat,
  selectedSegmentIds: string[],
  segments: ContentSegment[]
): TopicFraming {
  const segMap: NonNullable<TopicFraming['segments']> = {};
  for (const id of selectedSegmentIds) {
    const tenantSeg = segments.find((s) => s.id === id);
    if (!tenantSeg) continue;
    const tn = normalizeName(tenantSeg.name);
    const match = temat.segmenty.find((ts) => {
      const kn = normalizeName(ts.nazwa);
      if (!tn || !kn) return false;
      return tn.includes(kn) || kn.includes(tn) || tn.split(' ')[0] === kn.split(' ')[0];
    });
    if (match) {
      segMap[id] = {
        kat: match.kat,
        coDziala: match.coDziala,
        czegoUnikac: match.czegoUnikac,
        przyklad: match.przyklad,
      };
    }
  }
  return {
    slug: temat.slug,
    stanowisko: temat.rekomendacja.odpowiedz,
    podchwycic: temat.rekomendacja.podchwycic,
    zaatakowac: temat.rekomendacja.zaatakowac,
    segments: Object.keys(segMap).length > 0 ? segMap : undefined,
  };
}

type Phase = 'form' | 'generating';


/**
 * Etykieta kroku generacji. Po wygenerowaniu wszystkich wariantów backend robi
 * jeszcze kontrolę spójności, stąd osobna nazwa na końcu.
 */
function generationLabel(step: GenerateStepResult | null, knownTotal: number): string {
  const processed = step?.processed ?? 0;
  if (step !== null && knownTotal > 0 && processed >= knownTotal) {
    return 'Sprawdzam spójność z Twoją historią';
  }
  if (knownTotal > 0) {
    return `Wariant ${Math.min(processed + 1, knownTotal)} z ${knownTotal}`;
  }
  return 'Przygotowuję generację';
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
  const [selectedTopicSlug, setSelectedTopicSlug] = useState<string | null>(null);
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

  // Wybór tematu z bazy wiedzy: pojedynczy, ponowny klik odznacza.
  // Prefill tematu i komunikatu tylko gdy pola są puste, żeby nie nadpisać usera.
  const selectTopic = (slug: string) => {
    setSelectedTopicSlug((current) => {
      const next = current === slug ? null : slug;
      if (next) {
        const temat = znajdzTemat(next);
        if (temat) {
          setTopic((value) => (value.trim() ? value : temat.nazwa));
          setCoreMessage((value) => (value.trim() ? value : temat.rekomendacja.odpowiedz));
        }
      }
      return next;
    });
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
    // Zdarzenie leci nawet po odejściu z ekranu: generacja faktycznie się
    // udała. Przejścia już nie wymuszamy, bo wyrwałoby użytkownika z miejsca,
    // w którym jest teraz.
    track('content_generated', { variants: finalStep.total });
    if (!mountedRef.current) return;
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
        const temat = selectedTopicSlug ? znajdzTemat(selectedTopicSlug) : undefined;
        const topicFraming = temat
          ? buildTopicFraming(temat, selectedSegmentIds, segments)
          : undefined;
        const created = await createDraft({
          topic: trimmedTopic,
          core_message: coreMessage.trim() || undefined,
          segment_ids: selectedSegmentIds,
          channels: selectedChannels,
          topic_slug: temat?.slug,
          topic_framing: topicFraming,
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
          <FullScreenProgress
            label={generationLabel(generationStep, generationStep?.total ?? totalVariants ?? 0)}
            processed={generationStep?.processed ?? 0}
            total={generationStep?.total ?? totalVariants ?? 0}
            showCount={false}
            hint="Generacja może potrwać kilka minut. Nie zamykaj aplikacji."
          />
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
        keyboardShouldPersistTaps="handled"
        // Klawiatura nie moze zaslaniac przycisku pod formularzem. Na iOS robi to
        // ta wlasciwosc (ScrollView sam koryguje wciecie), na Androidzie domyslny
        // tryb okna "resize" z Expo.
        automaticallyAdjustKeyboardInsets>
        <BackLink />

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
            Temat z bazy wiedzy (opcjonalnie)
          </ThemedText>
          <View style={styles.chips}>
            {tematy.map((temat) => {
              const active = selectedTopicSlug === temat.slug;
              return (
                <Pressable
                  key={temat.slug}
                  accessibilityRole="button"
                  onPress={() => selectTopic(temat.slug)}
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
                    {temat.nazwa}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {selectedTopicSlug ? (
            <ThemedText type="small" themeColor="textSecondary">
              Przekaz użyje stanowiska i framingu z tego tematu, a strażnik spójności sprawdzi
              warianty także wobec tego stanowiska.
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Wybór tematu wstrzyknie stanowisko i argumenty do generatora oraz dopasuje przekaz
              do segmentów.
            </ThemedText>
          )}
        </View>

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
  centered: {
    textAlign: 'center',
  },
  retryButtons: {
    width: '100%',
    maxWidth: 320,
    gap: Spacing.two,
  },
});
