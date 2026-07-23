import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormTextInput } from '@/components/form-text-input';
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
import {
  finalizeStyle,
  generateStyleProfile,
  normalizeStyleProfile,
  updateStyleProfile,
  type StyleProfile,
} from '@/lib/api/onboarding';
import { setStatus, useOnboardingStore } from '@/store/onboarding';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionBlock}>
      <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function ChipRow({ items }: { items: string[] }) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {items.map((item) => (
        <View key={item} style={[styles.chip, { borderColor: theme.borderStrong }]}>
          <ThemedText type="small" themeColor="accentLight">
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

export default function StyleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const storedProfile = useOnboardingStore((state) => state.profile);

  // Jeśli backend zapisał już profil stylu (get_status), nie generujemy go
  // ponownie. Normalizacja chroni przed brakującymi polami z modelu.
  const existingProfile =
    storedProfile?.style_profile && typeof storedProfile.style_profile === 'object'
      ? normalizeStyleProfile(storedProfile.style_profile)
      : null;

  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(existingProfile);
  const [loading, setLoading] = useState(existingProfile === null);
  const [feedback, setFeedback] = useState('');
  const [updating, setUpdating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bez synchronicznych setState przed pierwszym await (react-hooks/set-state-in-effect):
  // stan ładowania ustawia stan początkowy albo handler ponowienia.
  const loadProfile = useCallback(async () => {
    try {
      const generated = await generateStyleProfile();
      setStyleProfile(generated);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się przygotować profilu stylu.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current && styleProfile === null) {
      startedRef.current = true;
      void loadProfile();
    }
  }, [loadProfile, styleProfile]);

  const handleRetryLoad = () => {
    setLoading(true);
    setError(null);
    void loadProfile();
  };

  const handleUpdate = async () => {
    const trimmed = feedback.trim();
    if (!trimmed || updating) {
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      const updated = await updateStyleProfile(trimmed);
      setStyleProfile(updated);
      setFeedback('');
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : 'Nie udało się poprawić profilu.'
      );
    } finally {
      setUpdating(false);
    }
  };

  // Żaden krok onboardingu nie jest obowiązkowy: pominięcie idzie do segmentów.
  const handleSkipStep = () => {
    setStatus('segments');
    router.replace('/onboarding/segments');
  };

  const handleAccept = async () => {
    if (accepting) {
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      await finalizeStyle();
      setStatus('segments');
      router.push('/onboarding/segments');
    } catch (acceptError) {
      setError(
        acceptError instanceof Error ? acceptError.message : 'Nie udało się zapisać akceptacji.'
      );
    } finally {
      setAccepting(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText themeColor="accent" style={styles.kicker}>
              Krok 3 z 4
            </ThemedText>
            <ThemedText style={styles.title}>Twój profil stylu</ThemedText>
            <ThemedText themeColor="text80">
              Tak Argus opisuje Twój sposób mówienia. Każdy generowany przekaz będzie się go
              trzymał. Sprawdź i popraw, jeśli coś nie brzmi jak Ty.
            </ThemedText>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText type="small" themeColor="textSecondary">
                Analizuję Twoje wystąpienia i buduję profil stylu.
              </ThemedText>
            </View>
          ) : null}

          {!loading && error && !styleProfile ? (
            <View style={styles.errorBox}>
              <ThemedText type="small" themeColor="error" style={styles.centered}>
                {error}
              </ThemedText>
              <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetryLoad} />
              <SkipStepLink onPress={handleSkipStep} />
            </View>
          ) : null}

          {!loading && styleProfile ? (
            <>
              <ThemedView
                type="backgroundElement"
                style={[styles.card, { borderColor: theme.border }]}>
                <Section title="Ton">
                  <ThemedText themeColor="text80">{styleProfile.ton}</ThemedText>
                </Section>
                <Section title="Długość zdań">
                  <ThemedText themeColor="text80">{styleProfile.dlugosc_zdan}</ThemedText>
                </Section>
                <Section title="Słownictwo">
                  <ChipRow items={styleProfile.slownictwo} />
                </Section>
                <Section title="Zwroty charakterystyczne">
                  <ChipRow items={styleProfile.zwroty_charakterystyczne} />
                </Section>
                <Section title="Czego unikać">
                  {styleProfile.czego_unika.map((item) => (
                    <ThemedText key={item} type="small" themeColor="text80">
                      {item}
                    </ThemedText>
                  ))}
                </Section>
                <Section title="Przykład wypowiedzi">
                  <View style={[styles.quote, { borderLeftColor: theme.accent }]}>
                    <ThemedText style={styles.quoteText} themeColor="text80">
                      {styleProfile.przyklad_wypowiedzi}
                    </ThemedText>
                  </View>
                </Section>
              </ThemedView>

              <View style={styles.actions}>
                <FormTextInput
                  label="Uwagi do profilu"
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder="Napisz, co poprawić, np. mniej formalny ton"
                  multiline
                  style={styles.feedbackInput}
                />

                {error ? (
                  <ThemedText type="small" themeColor="error">
                    {error}
                  </ThemedText>
                ) : null}

                <PrimaryButton
                  title="Popraw profil"
                  variant="secondary"
                  onPress={handleUpdate}
                  loading={updating}
                  disabled={feedback.trim().length === 0}
                />
                <PrimaryButton title="Akceptuję" onPress={handleAccept} loading={accepting} />
                <SkipStepLink onPress={handleSkipStep} />
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
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
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  sectionBlock: {
    gap: Spacing.two,
  },
  sectionLabel: {
    ...KickerStyle,
    fontSize: 13,
    letterSpacing: 13 * 0.18,
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
  quote: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
  },
  quoteText: {
    fontFamily: FontFamily.serifItalic,
    fontSize: 20,
    lineHeight: 28,
  },
  actions: {
    gap: Spacing.three,
  },
  feedbackInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
