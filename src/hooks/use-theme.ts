/**
 * Paleta aktualnego motywu. Jedyne wejście do kolorów dla komponentów
 * (`theme.background`, `theme.accent`, ...).
 *
 * Motyw pochodzi z wyboru użytkownika (store `@/store/theme`), nie z ustawień
 * systemu: decyzja usera z 2026-07-26 to jasny motyw domyślnie plus
 * przełącznik na ciemny w zakładce Profil.
 */

import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/store/theme';

export function useTheme() {
  return Colors[useThemeMode()];
}
