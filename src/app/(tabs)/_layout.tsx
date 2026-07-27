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
        // Jedna pozycja etykiet dla całego paska: ta opcja jest czytana
        // z aktywnej trasy, więc ustawiona tylko na jednym ekranie sprawia,
        // że po zmianie zakładki układ przeskakuje (etykieta obok ikony
        // na szerokich ekranach) i centralne oko zjeżdża z osi.
        tabBarLabelPosition: 'below-icon',
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
          title: 'Pulpit',
          tabBarIcon: ({ color, size }) => <Ionicons name="today" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analizy"
        options={{
          title: 'Analizy',
          tabBarIcon: ({ color, size }) => <Ionicons name="analytics" size={size} color={color} />,
        }}
      />
      {/* Centralny przycisk menu (decyzja usera 2026-07-27): uniesione koło
          z okiem Argusa, jak asystent AI w TwójPsycholog. */}
      <Tabs.Screen
        name="asystent-argus"
        options={{
          title: 'Asystent',
          tabBarItemStyle: styles.assistantItem,
          tabBarIcon: () => (
            <View
              style={[
                styles.assistantButton,
                { backgroundColor: theme.cta, borderColor: theme.backgroundElement },
              ]}>
              <Ionicons name="eye" size={26} color={theme.onAccent} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="dane"
        options={{
          title: 'Dane',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
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
  // Uniesione koło może wystawać ponad pasek: bez tego Android przycina.
  assistantItem: {
    overflow: 'visible',
  },
  assistantButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
