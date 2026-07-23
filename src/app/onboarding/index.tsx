import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EyeDot } from '@/components/eye-dot';
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
import { skipOnboarding } from '@/store/onboarding';

const STEPS = [
  {
    title: 'Import z Sejmu',
    description: 'Pobierzemy Twoje głosowania i wystąpienia prosto z oficjalnego API Sejmu.',
  },
  {
    title: 'Wywiad założycielski',
    description: 'Krótka rozmowa z Argusem o wartościach, granicach i celach politycznych.',
  },
  {
    title: 'Profil stylu',
    description: 'Na bazie wystąpień opiszemy Twój styl językowy, do akceptacji lub korekty.',
  },
  {
    title: 'Segmenty wyborców',
    description: 'Zaproponujemy pięć segmentów w Twoim okręgu wraz z priorytetami przekazu.',
  },
] as const;

export default function OnboardingWelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleStart = () => {
    track('onboarding_started');
    router.push('/onboarding/import');
  };

  const handleSkip = async () => {
    await skipOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four },
        ]}>
        <View style={styles.header}>
          <ThemedText themeColor="accent" style={styles.kicker}>
            Onboarding
          </ThemedText>
          <ThemedText style={styles.title}>Zbudujmy Twój graf kontekstu</ThemedText>
          <ThemedText themeColor="text80">
            Argus potrzebuje poznać Twoją historię i sposób mówienia, zanim zacznie przygotowywać
            briefy i przekazy. Cztery kroki, około kwadransa.
          </ThemedText>
        </View>

        <View style={styles.steps}>
          {STEPS.map((step) => (
            <ThemedView
              key={step.title}
              type="backgroundElement"
              style={[styles.stepCard, { borderColor: theme.border }]}>
              <EyeDot size={12} style={styles.stepDot} />
              <View style={styles.stepBody}>
                <ThemedText style={styles.stepTitle}>{step.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {step.description}
                </ThemedText>
              </View>
            </ThemedView>
          ))}
        </View>

        <View style={styles.actions}>
          <PrimaryButton title="Zaczynamy" onPress={handleStart} />
          <PrimaryButton title="Pomiń na razie" variant="secondary" onPress={handleSkip} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.skipHint}>
            Bez onboardingu Argus nie zna Twojej historii, więc briefy i przekazy będą ogólne.
            Wrócisz do niego w każdej chwili z zakładki Profil.
          </ThemedText>
        </View>
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
    gap: Spacing.five,
    justifyContent: 'center',
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
  steps: {
    gap: Spacing.three,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  stepDot: {
    marginTop: 5,
  },
  stepBody: {
    flex: 1,
    gap: Spacing.one,
  },
  stepTitle: {
    fontFamily: FontFamily.sansSemiBold,
  },
  actions: {
    gap: Spacing.three,
  },
  skipHint: {
    textAlign: 'center',
  },
});
