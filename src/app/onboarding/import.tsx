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
  runSejmImport,
  searchMp,
  type ImportCounts,
  type ImportStepResult,
  type MpSearchResult,
} from '@/lib/api/onboarding';
import { setProfile, setStatus } from '@/store/onboarding';

const SEARCH_DEBOUNCE_MS = 400;

const PHASE_LABELS: Record<ImportStepResult['phase'], string> = {
  votings: 'Pobieram głosowania',
  statements: 'Analizuję wystąpienia',
  embeddings: 'Liczę wektory',
  done: 'Porządkuję dane',
};

type Phase = 'search' | 'confirm' | 'importing' | 'summary' | 'no_mandate';

/** Pełnoekranowy loader importu z realnym postępem z pętli importu. */
function ImportLoader({ step }: { step: ImportStepResult | null }) {
  const theme = useTheme();
  const label = step ? PHASE_LABELS[step.phase] : 'Przygotowuję import';
  const showCount = step !== null && step.total > 0;
  const ratio = showCount ? Math.min(step.processed / step.total, 1) : 0;

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
            {step.processed} z {step.total}
          </ThemedText>
        </>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        Import danych z Sejmu może potrwać kilka minut. Nie zamykaj aplikacji.
      </ThemedText>
    </View>
  );
}

/** Duża złota liczba z podpisem (podsumowanie importu). */
function StatNumber({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText themeColor="accent" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {label}
      </ThemedText>
    </View>
  );
}

export default function ImportScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MpSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMp, setSelectedMp] = useState<MpSearchResult | null>(null);
  const [importCounts, setImportCounts] = useState<ImportCounts | null>(null);
  const [importStep, setImportStep] = useState<ImportStepResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latestQueryRef = useRef('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Czyścimy timer debounce przy odmontowaniu ekranu.
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  /** Wyszukiwanie posła z debounce, sterowane wpisywaniem tekstu. */
  const handleQueryChange = (text: string) => {
    setQuery(text);
    const trimmed = text.trim();
    latestQueryRef.current = trimmed;

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const mps = await searchMp(trimmed);
        if (latestQueryRef.current === trimmed) {
          setResults(mps);
          setError(null);
        }
      } catch (searchError) {
        if (latestQueryRef.current === trimmed) {
          setResults([]);
          setError(
            searchError instanceof Error ? searchError.message : 'Nie udało się wyszukać posła.'
          );
        }
      } finally {
        if (latestQueryRef.current === trimmed) {
          setSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleImport = async () => {
    if (!selectedMp) {
      return;
    }
    setPhase('importing');
    setImportStep(null);
    setError(null);
    try {
      const finalStep = await runSejmImport(selectedMp.mp_id, setImportStep);
      const imported = finalStep.imported ?? { votings: 0, votes: 0, statements: 0 };
      setImportCounts(imported);
      if (finalStep.profile) {
        setProfile(finalStep.profile);
      }
      setStatus('interview');
      track('sejm_import_completed', {
        mp_id: selectedMp.mp_id,
        votings: imported.votings,
        votes: imported.votes,
        statements: imported.statements,
      });
      setPhase('summary');
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : 'Nie udało się zaimportować danych.'
      );
      setPhase('confirm');
    }
  };

  const handleSkip = () => {
    setStatus('interview');
    router.push('/onboarding/interview');
  };

  if (phase === 'importing') {
    return (
      <ThemedView style={styles.screen}>
        <ImportLoader step={importStep} />
      </ThemedView>
    );
  }

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
            Krok 1 z 4
          </ThemedText>
          <ThemedText style={styles.title}>Import danych z Sejmu</ThemedText>
        </View>

        {phase === 'search' ? (
          <View style={styles.section}>
            <ThemedText themeColor="text80">
              Znajdź siebie na liście posłów i posłanek. Zaimportujemy Twoje głosowania i
              wystąpienia, żeby Argus znał Twoją historię.
            </ThemedText>

            <FormTextInput
              label="Nazwisko"
              value={query}
              onChangeText={handleQueryChange}
              placeholder="Wpisz co najmniej dwa znaki"
              autoCapitalize="words"
              autoCorrect={false}
            />

            {searching ? <ActivityIndicator color={theme.accent} /> : null}

            {error ? (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            ) : null}

            {!searching && query.trim().length >= 2 && results.length === 0 && !error ? (
              <ThemedText type="small" themeColor="textSecondary">
                Brak wyników dla tego zapytania. Sprawdź pisownię nazwiska.
              </ThemedText>
            ) : null}

            <View style={styles.results}>
              {results.map((mp) => (
                <Pressable
                  key={mp.mp_id}
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedMp(mp);
                    setError(null);
                    setPhase('confirm');
                  }}
                  style={({ pressed }) => [
                    styles.resultCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    pressed && styles.dimmed,
                  ]}>
                  <ThemedText style={styles.resultName}>{mp.full_name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {mp.club}, okręg {mp.district_name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable accessibilityRole="button" onPress={() => setPhase('no_mandate')}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.linkText}>
                Nie jestem posłem ani posłanką
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {phase === 'confirm' && selectedMp ? (
          <View style={styles.section}>
            <ThemedView
              type="backgroundElement"
              style={[styles.confirmCard, { borderColor: theme.border }]}>
              <ThemedText style={styles.confirmName}>{selectedMp.full_name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {selectedMp.club}, okręg {selectedMp.district_name}
              </ThemedText>
              <ThemedText themeColor="text80">
                Zaimportujemy głosowania i wystąpienia z Sejmu. Ten proces może potrwać kilka
                minut.
              </ThemedText>
            </ThemedView>

            {error ? (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            ) : null}

            <PrimaryButton title="Importuj dane" onPress={handleImport} />
            <PrimaryButton
              title="Wybierz inną osobę"
              variant="secondary"
              onPress={() => {
                setSelectedMp(null);
                setError(null);
                setPhase('search');
              }}
            />
          </View>
        ) : null}

        {phase === 'summary' && importCounts ? (
          <View style={styles.section}>
            <ThemedText themeColor="text80">
              Import zakończony. Argus zna już Twoją historię parlamentarną.
            </ThemedText>

            <ThemedView
              type="backgroundElement"
              style={[styles.summaryCard, { borderColor: theme.border }]}>
              <StatNumber value={importCounts.votings} label="głosowań w Sejmie" />
              <StatNumber value={importCounts.votes} label="Twoich głosów" />
              <StatNumber value={importCounts.statements} label="wystąpień" />
            </ThemedView>

            <PrimaryButton
              title="Przejdź do wywiadu"
              onPress={() => router.push('/onboarding/interview')}
            />
          </View>
        ) : null}

        {phase === 'no_mandate' ? (
          <View style={styles.section}>
            <ThemedView
              type="backgroundElement"
              style={[styles.confirmCard, { borderColor: theme.border }]}>
              <ThemedText style={styles.confirmName}>Wersja pilotażowa</ThemedText>
              <ThemedText themeColor="text80">
                Obecna wersja Argusa jest przygotowana dla osób z mandatem poselskim, ponieważ graf
                kontekstu budujemy z danych Sejmu. Możesz mimo to przejść dalej. Wywiad z Argusem i
                profil stylu zadziałają, a import danych uzupełnisz później.
              </ThemedText>
            </ThemedView>

            <PrimaryButton title="Pomiń import" onPress={handleSkip} />
            <PrimaryButton
              title="Wróć do wyszukiwania"
              variant="secondary"
              onPress={() => setPhase('search')}
            />
          </View>
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
  section: {
    gap: Spacing.three,
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
  dimmed: {
    opacity: 0.7,
  },
  linkText: {
    textDecorationLine: 'underline',
    paddingVertical: Spacing.two,
  },
  confirmCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  confirmName: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
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
  summaryCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  stat: {
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 90,
  },
  statValue: {
    fontFamily: FontFamily.serif,
    fontSize: 44,
    lineHeight: 52,
  },
});
