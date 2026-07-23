import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, type Href } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { OnboardingStatus } from '@/lib/api/onboarding';
import { useAuthStore } from '@/store/auth';
import { loadSkipped, refreshStatus, useOnboardingStore } from '@/store/onboarding';

/** Krok onboardingu, na który kierujemy przy niedokończonym onboardingu. */
const ONBOARDING_ROUTES: Record<Exclude<OnboardingStatus, 'done'>, Href> = {
  not_started: '/onboarding',
  importing: '/onboarding/import',
  interview: '/onboarding/interview',
  style: '/onboarding/style',
  segments: '/onboarding/segments',
};

export default function TabsLayout() {
  const theme = useTheme();
  const session = useAuthStore((state) => state.session);
  const initialized = useAuthStore((state) => state.initialized);
  const onboardingStatus = useOnboardingStore((state) => state.status);
  const onboardingError = useOnboardingStore((state) => state.error);
  const onboardingLoading = useOnboardingStore((state) => state.loading);
  const onboardingSkipped = useOnboardingStore((state) => state.skipped);
  const skippedLoaded = useOnboardingStore((state) => state.skippedLoaded);

  // Po zalogowaniu wczytujemy flagę pominięcia i stan onboardingu z backendu.
  useEffect(() => {
    if (!skippedLoaded) {
      void loadSkipped();
    }
  }, [skippedLoaded]);

  useEffect(() => {
    if (session && onboardingStatus === 'unknown' && !onboardingLoading && !onboardingError) {
      void refreshStatus();
    }
  }, [session, onboardingStatus, onboardingLoading, onboardingError]);

  if (initialized && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Pominięty onboarding: wpuszczamy do zakładek bez czekania na get_status.
  if (!initialized || !skippedLoaded || (onboardingStatus === 'unknown' && !onboardingSkipped)) {
    return (
      <ThemedView style={styles.gate}>
        {onboardingError && !onboardingLoading ? (
          <View style={styles.gateError}>
            <ThemedText type="small" themeColor="error" style={styles.gateErrorText}>
              {onboardingError}
            </ThemedText>
            <PrimaryButton
              title="Spróbuj ponownie"
              variant="secondary"
              onPress={() => void refreshStatus()}
            />
          </View>
        ) : (
          <ActivityIndicator size="large" color={theme.accent} />
        )}
      </ThemedView>
    );
  }

  // Niedokończony onboarding: kierujemy na właściwy krok, chyba że user go pominął.
  // Ekrany onboardingu same nie sprawdzają statusu, więc nie ma pętli przekierowań.
  if (onboardingStatus !== 'done' && onboardingStatus !== 'unknown' && !onboardingSkipped) {
    return <Redirect href={ONBOARDING_ROUTES[onboardingStatus]} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: {
          fontFamily: FontFamily.sansMedium,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dziś',
          tabBarIcon: ({ color, size }) => <Ionicons name="today" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="briefs"
        options={{
          title: 'Briefy',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="media"
        options={{
          title: 'Media',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="content"
        options={{
          title: 'Przekaz',
          tabBarIcon: ({ color, size }) => <Ionicons name="megaphone" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  gateError: {
    gap: Spacing.three,
    width: '100%',
    maxWidth: 400,
  },
  gateErrorText: {
    textAlign: 'center',
  },
});
