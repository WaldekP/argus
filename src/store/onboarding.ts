/**
 * Store onboardingu (Zustand). Trzyma stan kroku onboardingu pobrany
 * z Edge Function `argus-onboarding` (operation: get_status) i pozwala
 * ekranom lokalnie przestawiać krok po przejściach.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  getStatus,
  type OnboardingStatus,
  type PoliticianProfile,
} from '@/lib/api/onboarding';

/** Klucz trwałej flagi "onboarding pominięty" (per urządzenie). */
const SKIP_STORAGE_KEY = 'argus.onboarding.skipped';

type OnboardingCounts = {
  votes: number;
  statements: number;
};

type OnboardingState = {
  /** 'unknown' = jeszcze nie pobraliśmy stanu z backendu. */
  status: OnboardingStatus | 'unknown';
  profile: PoliticianProfile | null;
  counts: OnboardingCounts | null;
  loading: boolean;
  /** Błąd ostatniego refreshStatus() po polsku albo null. */
  error: string | null;
  /** User pominął onboarding (decyzja trwała, do odwołania z Profilu). */
  skipped: boolean;
  /** Czy flaga skipped została już wczytana z pamięci urządzenia. */
  skippedLoaded: boolean;
};

export const useOnboardingStore = create<OnboardingState>(() => ({
  status: 'unknown',
  profile: null,
  counts: null,
  loading: false,
  error: null,
  skipped: false,
  skippedLoaded: false,
}));

/** Wczytuje trwałą flagę pominięcia onboardingu (raz na start). */
export async function loadSkipped(): Promise<void> {
  if (useOnboardingStore.getState().skippedLoaded) {
    return;
  }
  try {
    const value = await AsyncStorage.getItem(SKIP_STORAGE_KEY);
    useOnboardingStore.setState({ skipped: value === '1', skippedLoaded: true });
  } catch {
    // Brak dostępu do pamięci traktujemy jak brak flagi.
    useOnboardingStore.setState({ skipped: false, skippedLoaded: true });
  }
}

/** Pomija onboarding: wpuszcza do aplikacji i zapamiętuje decyzję. */
export async function skipOnboarding(): Promise<void> {
  useOnboardingStore.setState({ skipped: true, skippedLoaded: true });
  try {
    await AsyncStorage.setItem(SKIP_STORAGE_KEY, '1');
  } catch {
    // Flaga zostaje w pamięci procesu; po restarcie gating wróci do onboardingu.
  }
}

/** Odwołuje pominięcie (powrót do onboardingu z Profilu). */
export async function resumeOnboarding(): Promise<void> {
  useOnboardingStore.setState({ skipped: false });
  try {
    await AsyncStorage.removeItem(SKIP_STORAGE_KEY);
  } catch {
    // Ignorujemy: brak wpisu i tak oznacza brak pominięcia.
  }
}

/**
 * Pobiera stan onboardingu z backendu (get_status).
 * Idempotentne w trakcie trwania: równoległe wywołania są ignorowane.
 */
export async function refreshStatus(): Promise<void> {
  if (useOnboardingStore.getState().loading) {
    return;
  }
  useOnboardingStore.setState({ loading: true, error: null });
  try {
    const result = await getStatus();
    useOnboardingStore.setState({
      status: result.onboarding_status,
      profile: result.profile,
      counts: result.counts,
      loading: false,
      error: null,
    });
  } catch (error) {
    useOnboardingStore.setState({
      loading: false,
      error: error instanceof Error ? error.message : 'Nie udało się pobrać stanu onboardingu.',
    });
  }
}

/** Lokalne przestawienie kroku po przejściu (bez wołania backendu). */
export function setStatus(status: OnboardingStatus): void {
  useOnboardingStore.setState({ status });
}

/** Lokalna aktualizacja profilu (np. po imporcie albo zmianie stylu). */
export function setProfile(profile: PoliticianProfile | null): void {
  useOnboardingStore.setState({ profile });
}

/** Reset stanu, np. po wylogowaniu. Czyści też trwałą flagę pominięcia. */
export function resetOnboarding(): void {
  useOnboardingStore.setState({
    status: 'unknown',
    profile: null,
    counts: null,
    loading: false,
    error: null,
    skipped: false,
    skippedLoaded: false,
  });
  AsyncStorage.removeItem(SKIP_STORAGE_KEY).catch(() => {
    // Ignorujemy: następne logowanie i tak wczyta flagę od nowa.
  });
}
