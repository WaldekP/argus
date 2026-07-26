import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
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
  corpusSegmentId,
  createDraft,
  listSegments,
  runGeneration,
  type Channel,
  type ContentSegment,
  type GenerateStepResult,
  type SegmentFraming,
  type SegmentInput,
  type TopicFraming,
} from '@/lib/api/content';
import { znajdzTemat } from '@/lib/knowledge';
import type { SegmentOdbiorcow, Temat } from '@/lib/knowledge/types';

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

/** Dopasowanie segmentu tenanta do segmentu korpusu (luźne, po nazwie). */
function matchCorpusSegment(
  tenantName: string,
  corpusSegments: SegmentOdbiorcow[]
): SegmentOdbiorcow | undefined {
  const tn = normalizeName(tenantName);
  if (!tn) return undefined;
  return corpusSegments.find((cs) => {
    const kn = normalizeName(cs.nazwa);
    if (!kn) return false;
    return tn.includes(kn) || kn.includes(tn) || tn.split(' ')[0] === kn.split(' ')[0];
  });
}

/** Framing pojedynczego segmentu korpusu (kąt, co działa, czego unikać, przykład). */
function corpusFraming(cs: SegmentOdbiorcow): SegmentFraming {
  return {
    kat: cs.kat,
    coDziala: cs.coDziala,
    czegoUnikac: cs.czegoUnikac,
    przyklad: cs.przyklad,
  };
}

/**
 * Buduje framing dla generatora: stanowisko i warstwy taktyczne z rekomendacji
 * korpusu obowiązują cały draft; framing per segment dokładany jest dla
 * segmentów tenanta (przez dopasowanie do korpusu) i wprost dla wybranych
 * segmentów korpusu.
 */
function buildFraming(
  temat: Temat,
  tenantSegments: { id: string; name: string }[],
  corpusSegments: SegmentOdbiorcow[]
): TopicFraming {
  const segMap: NonNullable<TopicFraming['segments']> = {};
  for (const ts of tenantSegments) {
    const match = matchCorpusSegment(ts.name, temat.segmenty);
    if (match) segMap[ts.id] = corpusFraming(match);
  }
  for (const cs of corpusSegments) {
    segMap[corpusSegmentId(cs.id)] = corpusFraming(cs);
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

/**
 * Generacja przekazu z tematu. Wejście wyłącznie z kontekstem: korpus
 * tematyczny (`topicSlug`) albo dossier użytkownika (`dossierId` + `topicName`).
 * Wybierasz grupy wyborców (segmenty tenanta i, dla korpusu, segmenty tematu)
 * oraz kanały; temat i stanowisko biorą się z kontekstu.
 */
export default function NewContentScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    topicSlug?: string;
    dossierId?: string;
    topicName?: string;
  }>();

  const temat = params.topicSlug ? znajdzTemat(params.topicSlug) : undefined;
  const topicName = (temat?.nazwa ?? params.topicName ?? '').trim();
  const topicRef = params.topicSlug ?? (params.dossierId ? `dossier:${params.dossierId}` : undefined);
  const corpusSegments = temat?.segmenty ?? [];

  const [phase, setPhase] = useState<Phase>('form');
  const [coreMessage, setCoreMessage] = useState('');
  const [segments, setSegments] = useState<ContentSegment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [selectedCorpusIds, setSelectedCorpusIds] = useState<string[]>([]);
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
      if (mountedRef.current) setSegments(list);
    } catch {
      // Brak segmentów nie blokuje formularza: generujemy wtedy wersję ogólną.
      if (mountedRef.current) setSegments([]);
    } finally {
      if (mountedRef.current) setSegmentsLoading(false);
    }
  }, []);

  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void loadSegments();
    }
  }, [loadSegments]);

  const toggleTenant = (id: string) => {
    setSelectedTenantIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleCorpus = (id: string) => {
    setSelectedCorpusIds((current) =>
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
      if (mountedRef.current) setGenerationStep(step);
    });
    track('content_generated', { variants: finalStep.total });
    if (!mountedRef.current) return;
    router.replace(`/content/${draftId}`);
  };

  const handleGenerate = async () => {
    if (topicName.length < TOPIC_MIN_LENGTH) {
      setFormError('Brak tematu. Otwórz generację z konkretnego tematu.');
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
        const tenantPicked = selectedTenantIds
          .map((id) => segments.find((s) => s.id === id))
          .filter((s): s is ContentSegment => Boolean(s))
          .map((s) => ({ id: s.id, name: s.name }));
        const corpusPicked = selectedCorpusIds
          .map((id) => corpusSegments.find((s) => s.id === id))
          .filter((s): s is SegmentOdbiorcow => Boolean(s));

        const segmentInputs: SegmentInput[] = [
          ...tenantPicked,
          ...corpusPicked.map((s) => ({ id: corpusSegmentId(s.id), name: s.nazwa })),
        ];

        const topicFraming = temat
          ? buildFraming(temat, tenantPicked, corpusPicked)
          : undefined;

        const created = await createDraft({
          topic: topicName,
          core_message: coreMessage.trim() || undefined,
          segments: segmentInputs,
          channels: selectedChannels,
          topic_slug: temat?.slug,
          topic_framing: topicFraming,
          topic_ref: topicRef,
        });
        draftId = created.draft_id;
        draftIdRef.current = draftId;
        if (mountedRef.current) setTotalVariants(created.total_variants);
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

  // Brak kontekstu tematu: generacja żyje wewnątrz tematu, nie samodzielnie.
  if (topicName.length < TOPIC_MIN_LENGTH) {
    return (
      <ThemedView style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <BackLink />
          <View style={styles.header}>
            <ThemedText style={styles.title}>Nowy przekaz</ThemedText>
            <ThemedText themeColor="text80">
              Przekaz generujesz z tematu. Wejdź w temat w zakładce Tematy i użyj przycisku
              Wygeneruj przekaz.
            </ThemedText>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

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
        automaticallyAdjustKeyboardInsets>
        <BackLink />

        <View style={styles.header}>
          <ThemedText themeColor="accent" style={styles.kicker}>
            Przekaz z tematu
          </ThemedText>
          <ThemedText style={styles.title}>{topicName}</ThemedText>
          <ThemedText themeColor="text80">
            Wybierz grupy wyborców i kanały. Argus użyje kontekstu tematu i Twojego stylu, a na
            końcu sprawdzi warianty ze strażnikiem spójności.
          </ThemedText>
        </View>

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
            Twoje segmenty
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
                const active = selectedTenantIds.includes(segment.id);
                return (
                  <Pressable
                    key={segment.id}
                    accessibilityRole="button"
                    onPress={() => toggleTenant(segment.id)}
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
        </View>

        {corpusSegments.length > 0 ? (
          <View style={styles.section}>
            <ThemedText themeColor="accent" style={styles.kicker}>
              Segmenty tematu
            </ThemedText>
            <View style={styles.chips}>
              {corpusSegments.map((segment) => {
                const active = selectedCorpusIds.includes(segment.id);
                return (
                  <Pressable
                    key={segment.id}
                    accessibilityRole="button"
                    onPress={() => toggleCorpus(segment.id)}
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
                      {segment.nazwa}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Grupy z tego zagadnienia mają gotowy playbook (kąt przekazu, co działa, czego unikać),
              który trafia wprost do generacji.
            </ThemedText>
          </View>
        ) : null}

        {!segmentsLoading &&
        selectedTenantIds.length === 0 &&
        selectedCorpusIds.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Bez zaznaczonych grup przygotuję wersję ogólną.
          </ThemedText>
        ) : null}

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
