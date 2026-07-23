import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signOut, useAuthStore } from '@/store/auth';
import { resumeOnboarding, useOnboardingStore } from '@/store/onboarding';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const onboardingStatus = useOnboardingStore((state) => state.status);
  const onboardingSkipped = useOnboardingStore((state) => state.skipped);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onboardingUnfinished = onboardingSkipped || onboardingStatus !== 'done';

  const handleResumeOnboarding = async () => {
    await resumeOnboarding();
    router.push('/onboarding');
  };

  const handleSignOut = async () => {
    setError(null);
    setLoading(true);
    const result = await signOut();
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
    // Po wylogowaniu przekierowanie robi (tabs)/_layout.tsx.
  };

  return (
    <ScreenPlaceholder
      title="Profil"
      description="Twój graf kontekstu: dane z Sejmu, profil stylu językowego i ustawienia konta. Onboarding z importem pojawi się wkrótce.">
      <View style={styles.section}>
        {onboardingUnfinished ? (
          <ThemedView
            type="backgroundElement"
            style={[styles.onboardingCard, { borderColor: theme.border }]}>
            <ThemedText style={styles.onboardingTitle}>Dokończ onboarding</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Argus nie zna jeszcze Twojej historii z Sejmu, wartości ani stylu. Bez tego briefy
              i przekazy pozostaną ogólne.
            </ThemedText>
            <PrimaryButton title="Wróć do onboardingu" onPress={handleResumeOnboarding} />
          </ThemedView>
        ) : null}

        {session?.user.email ? (
          <ThemedText type="small" themeColor="textSecondary">
            Zalogowano jako {session.user.email}
          </ThemedText>
        ) : null}

        {error ? (
          <ThemedText type="small" themeColor="error">
            {error}
          </ThemedText>
        ) : null}

        <PrimaryButton
          title="Wyloguj się"
          variant="secondary"
          onPress={handleSignOut}
          loading={loading}
        />
      </View>
    </ScreenPlaceholder>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  onboardingCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  onboardingTitle: {
    fontFamily: FontFamily.sansSemiBold,
  },
});
