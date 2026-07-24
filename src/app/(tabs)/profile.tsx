import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MpMandateCard } from '@/components/mp-mandate';
import { PrimaryButton } from '@/components/primary-button';
import { RegistryConnections } from '@/components/registry-connections';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMpDetails, readMpIdentity, type MpDetails } from '@/lib/api/onboarding';
import { signOut, useAuthStore } from '@/store/auth';
import { resumeOnboarding, useOnboardingStore } from '@/store/onboarding';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const onboardingStatus = useOnboardingStore((state) => state.status);
  const onboardingSkipped = useOnboardingStore((state) => state.skipped);
  const profile = useOnboardingStore((state) => state.profile);
  const counts = useOnboardingStore((state) => state.counts);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Start w stanie ładowania: profil dojeżdża ze store'u, więc pierwszy render
  // ma jeszcze pusty mp_id, a karta ma pokazać loader, nie komunikat o braku.
  const [mpDetails, setMpDetails] = useState<MpDetails | null>(null);
  const [mpDetailsLoading, setMpDetailsLoading] = useState(true);
  const [mpDetailsError, setMpDetailsError] = useState<string | null>(null);

  const onboardingUnfinished = onboardingSkipped || onboardingStatus !== 'done';
  const identity = readMpIdentity(profile);
  const mpId = identity?.mp_id ?? null;

  // Pełna karta posła idzie prosto z API Sejmu przy każdym wejściu w Profil:
  // klub i status mandatu zmieniają się w trakcie kadencji.
  useEffect(() => {
    if (mpId === null) {
      return;
    }
    let active = true;
    getMpDetails()
      .then((details) => {
        if (active) setMpDetails(details);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setMpDetailsError(
          err instanceof Error ? err.message : 'Nie udało się pobrać danych z Sejmu.'
        );
      })
      .finally(() => {
        if (active) setMpDetailsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mpId]);

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
      description="Twój graf kontekstu: dane z Sejmu, profil stylu językowego i ustawienia konta.">
      <View style={styles.section}>
        {identity ? (
          <MpMandateCard
            identity={identity}
            details={mpDetails}
            detailsLoading={mpId !== null && mpDetailsLoading}
            detailsError={mpDetailsError}
            counts={counts}
            onOpenStatements={() => router.push('/wystapienia')}
          />
        ) : null}

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

        <RegistryConnections
          defaultQuery={typeof profile?.full_name === 'string' ? profile.full_name : ''}
          subjectId={typeof profile?.id === 'string' ? profile.id : null}
        />

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
