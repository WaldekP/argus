import {
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { initAnalytics } from '@/lib/analytics/posthog';
import { initAuth } from '@/store/auth';
import { loadThemeMode, useThemeStore } from '@/store/theme';

SplashScreen.preventAutoHideAsync();

const ArgusDarkTheme: typeof DarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.dark.background,
    card: Colors.dark.backgroundElement,
    text: Colors.dark.text,
    primary: Colors.dark.accent,
    border: Colors.dark.border,
  },
};

const ArgusLightTheme: typeof DefaultTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    card: Colors.light.backgroundElement,
    text: Colors.light.text,
    primary: Colors.light.accent,
    border: Colors.light.border,
  },
};

export default function RootLayout() {
  const themeMode = useThemeStore((state) => state.mode);
  const themeLoaded = useThemeStore((state) => state.loaded);
  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
    CormorantGaramond_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    initAuth();
    initAnalytics();
    void loadThemeMode();
  }, []);

  const ready = fontsLoaded && themeLoaded;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  // Czekamy też na wybór motywu, żeby użytkownik ciemnego motywu nie zobaczył
  // mignięcia jasnego tła przed wczytaniem preferencji z pamięci urządzenia.
  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider value={themeMode === 'dark' ? ArgusDarkTheme : ArgusLightTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="temat" />
        {/* Katalogi z własnym _layout.tsx deklarujemy nazwą grupy, nie trasy
            w środku: "spolka/[krs]" nie istniało na tym poziomie i router
            zgłaszał to ostrzeżeniem przy każdym starcie. */}
        <Stack.Screen name="spolka" />
        <Stack.Screen name="brief-poranny" />
        <Stack.Screen name="content/new" />
        <Stack.Screen name="content/[id]" />
        <Stack.Screen name="analysis/index" />
        <Stack.Screen name="analysis/new" />
        <Stack.Screen name="analysis/[id]" />
        <Stack.Screen name="topics/new" />
        <Stack.Screen name="topics/[id]" />
        <Stack.Screen name="wystapienia" />
        <Stack.Screen name="programy-wyborcze" />
      </Stack>
    </ThemeProvider>
  );
}
