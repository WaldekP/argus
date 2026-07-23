import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { SkipStepLink } from '@/components/skip-step-link';
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
  finalizeSegments,
  suggestSegments,
  type Segment,
  type SegmentPriority,
} from '@/lib/api/onboarding';
import { setStatus, skipOnboarding } from '@/store/onboarding';

const PRIORITIES: { value: SegmentPriority; label: string }[] = [
  { value: 'mobilize', label: 'Mobilizuj' },
  { value: 'persuade', label: 'Przekonuj' },
  { value: 'ignore', label: 'Pomiń' },
];

export default function SegmentsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bez synchronicznych setState przed pierwszym await (react-hooks/set-state-in-effect):
  // stan ładowania ustawia stan początkowy albo handler ponowienia.
  const loadSegments = useCallback(async () => {
    try {
      const suggested = await suggestSegments();
      setSegments(suggested);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się przygotować segmentów.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current && segments.length === 0) {
      startedRef.current = true;
      void loadSegments();
    }
  }, [loadSegments, segments.length]);

  const handleRetryLoad = () => {
    setLoading(true);
    setError(null);
    void loadSegments();
  };

  const updateSegment = (index: number, patch: Partial<Segment>) => {
    setSegments((current) =>
      current.map((segment, i) => (i === index ? { ...segment, ...patch } : segment))
    );
  };

  // Żaden krok onboardingu nie jest obowiązkowy: pominięcie segmentów
  // wpuszcza do aplikacji (trwała flaga, powrót możliwy z Profilu).
  const handleSkipStep = async () => {
    await skipOnboarding();
    router.replace('/(tabs)');
  };

  const handleFinalize = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await finalizeSegments(segments);
      track('onboarding_completed');
      setStatus('done');
      router.replace('/(tabs)');
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Nie udało się zapisać segmentów.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ThemedText themeColor="accent" style={styles.kicker}>
            Krok 4 z 4
          </ThemedText>
          <ThemedText style={styles.title}>Segmenty wyborców</ThemedText>
          <ThemedText themeColor="text80">
            Pięć grup wyborców w Twoim okręgu, na bazie profilu i danych. Zmień nazwy i priorytety
            tak, jak widzisz swój elektorat. Segmenty to wyłącznie agregaty, bez danych
            pojedynczych osób.
          </ThemedText>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText type="small" themeColor="textSecondary">
              Argus analizuje okręg i proponuje segmenty.
            </ThemedText>
          </View>
        ) : null}

        {!loading && error && segments.length === 0 ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetryLoad} />
            <SkipStepLink onPress={handleSkipStep} />
          </View>
        ) : null}

        {!loading && segments.length > 0 ? (
          <>
            <View style={styles.cards}>
              {segments.map((segment, index) => (
                <ThemedView
                  key={index}
                  type="backgroundElement"
                  style={[styles.card, { borderColor: theme.border }]}>
                  <TextInput
                    value={segment.name}
                    onChangeText={(name) => updateSegment(index, { name })}
                    placeholder="Nazwa segmentu"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.nameInput,
                      { color: theme.text, borderBottomColor: theme.border },
                    ]}
                  />

                  <ThemedText type="small" themeColor="text80">
                    {segment.profile.opis}
                  </ThemedText>

                  <View style={styles.chips}>
                    {segment.profile.tematy.map((temat) => (
                      <View key={temat} style={[styles.chip, { borderColor: theme.borderStrong }]}>
                        <ThemedText type="small" themeColor="accentLight">
                          {temat}
                        </ThemedText>
                      </View>
                    ))}
                  </View>

                  <View style={styles.pills}>
                    {PRIORITIES.map((priority) => {
                      const active = segment.priority === priority.value;
                      return (
                        <Pressable
                          key={priority.value}
                          accessibilityRole="button"
                          onPress={() => updateSegment(index, { priority: priority.value })}
                          style={({ pressed }) => [
                            styles.pill,
                            active
                              ? { backgroundColor: theme.cta }
                              : {
                                  backgroundColor: theme.backgroundSelected,
                                  borderWidth: 1,
                                  borderColor: theme.border,
                                },
                            pressed && styles.dimmed,
                          ]}>
                          <ThemedText
                            type="small"
                            themeColor={active ? 'onAccent' : 'textSecondary'}
                            style={styles.pillLabel}>
                            {priority.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </ThemedView>
              ))}
            </View>

            {error ? (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            ) : null}

            <PrimaryButton title="Zatwierdź segmenty" onPress={handleFinalize} loading={saving} />
            <SkipStepLink onPress={handleSkipStep} />
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
  header: {
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  errorBox: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
  cards: {
    gap: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  nameInput: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
    borderBottomWidth: 1,
    paddingBottom: Spacing.one,
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
    paddingVertical: Spacing.one,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pill: {
    flex: 1,
    borderRadius: Radius.full,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  pillLabel: {
    fontFamily: FontFamily.sansSemiBold,
  },
  dimmed: {
    opacity: 0.7,
  },
});
