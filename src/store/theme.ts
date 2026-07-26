/**
 * Store motywu (Zustand). Motyw jest wyborem użytkownika, nie systemu.
 *
 * Decyzja usera 2026-07-26: domyślnie motyw jasny, z możliwością przełączenia
 * na ciemny w zakładce Profil. Dlatego NIE pytamy systemu o `colorScheme`:
 * gdyby ustawienie szło za systemem, przełącznik w aplikacji byłby nadpisywany
 * przy każdej zmianie trybu w telefonie.
 *
 * Wybór jest trwały per urządzenie (jak flaga pominięcia onboardingu):
 * to preferencja wyświetlania, nie dana konta, więc nie trzymamy jej w bazie.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/** Klucz trwałego wyboru motywu (per urządzenie). */
const THEME_STORAGE_KEY = 'argus.theme.mode';

export type ThemeMode = 'light' | 'dark';

/** Motyw startowy, dopóki nie wczytamy wyboru z pamięci urządzenia. */
const DEFAULT_MODE: ThemeMode = 'light';

type ThemeState = {
  mode: ThemeMode;
  /**
   * Czy wybór został już wczytany z pamięci. Root layout wstrzymuje pierwszy
   * render, dopóki to nie jest true, żeby użytkownik ciemnego motywu nie
   * zobaczył mignięcia jasnego tła.
   */
  loaded: boolean;
};

export const useThemeStore = create<ThemeState>(() => ({
  mode: DEFAULT_MODE,
  loaded: false,
}));

/** Wczytuje zapisany wybór motywu (raz, na starcie aplikacji). */
export async function loadThemeMode(): Promise<void> {
  if (useThemeStore.getState().loaded) {
    return;
  }
  try {
    const value = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    useThemeStore.setState({
      mode: value === 'dark' || value === 'light' ? value : DEFAULT_MODE,
      loaded: true,
    });
  } catch {
    // Brak dostępu do pamięci traktujemy jak brak wyboru.
    useThemeStore.setState({ mode: DEFAULT_MODE, loaded: true });
  }
}

/** Ustawia motyw i zapamiętuje wybór. */
export async function setThemeMode(mode: ThemeMode): Promise<void> {
  useThemeStore.setState({ mode, loaded: true });
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Wybór zostaje w pamięci procesu; po restarcie wróci domyślny.
  }
}

/** Przełącza jasny na ciemny i odwrotnie. */
export async function toggleThemeMode(): Promise<void> {
  await setThemeMode(useThemeStore.getState().mode === 'dark' ? 'light' : 'dark');
}

/** Aktualny motyw. Do komponentów, które potrzebują nazwy, nie palety. */
export function useThemeMode(): ThemeMode {
  return useThemeStore((state) => state.mode);
}
