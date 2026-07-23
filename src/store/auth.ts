/**
 * Store autoryzacji (Zustand). Sesja Supabase + akcje logowania.
 * initAuth() wołane raz z root layoutu (src/app/_layout.tsx).
 */

import type { AuthError, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { resetOnboarding } from '@/store/onboarding';

export type AuthResult = {
  /** Komunikat błędu po polsku albo null, gdy operacja się powiodła. */
  error: string | null;
};

type AuthState = {
  session: Session | null;
  initialized: boolean;
};

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  initialized: false,
}));

/** Tłumaczy błędy Supabase Auth na komunikaty po polsku. */
function toPolishAuthError(error: AuthError): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Nieprawidłowy e-mail lub hasło.';
  }
  if (message.includes('email not confirmed')) {
    return 'Konto nie zostało jeszcze potwierdzone. Sprawdź skrzynkę e-mail.';
  }
  if (message.includes('user already registered')) {
    return 'Konto z tym adresem e-mail już istnieje. Zaloguj się.';
  }
  if (message.includes('password should be at least')) {
    return 'Hasło jest za krótkie. Użyj co najmniej 8 znaków.';
  }
  if (message.includes('unable to validate email') || message.includes('invalid email')) {
    return 'Podaj poprawny adres e-mail.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
  }
  return 'Coś poszło nie tak. Spróbuj ponownie za chwilę.';
}

let authInitialized = false;

/**
 * Inicjalizacja auth: pobiera bieżącą sesję i nasłuchuje zmian.
 * Idempotentna, wołaj raz z root layoutu.
 */
export function initAuth(): void {
  if (authInitialized) {
    return;
  }
  authInitialized = true;

  void supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({ session: data.session, initialized: true });
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, initialized: true });
  });
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return { error: error ? toPolishAuthError(error) : null };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  return { error: error ? toPolishAuthError(error) : null };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  if (Platform.OS === 'web') {
    // Na web Supabase sam przekierowuje i odczytuje sesję z URL.
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    return { error: error ? toPolishAuthError(error) : null };
  }

  // Na native: otwieramy przeglądarkę systemową i wracamy deep linkiem.
  const redirectTo = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    return { error: error ? toPolishAuthError(error) : 'Nie udało się rozpocząć logowania Google.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    return { error: 'Logowanie Google zostało przerwane.' };
  }

  const url = new URL(result.url);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = hashParams.get('access_token') ?? url.searchParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') ?? url.searchParams.get('refresh_token');
  const code = url.searchParams.get('code');

  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { error: sessionError ? toPolishAuthError(sessionError) : null };
  }
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    return { error: exchangeError ? toPolishAuthError(exchangeError) : null };
  }
  return { error: 'Nie udało się dokończyć logowania Google.' };
}

export async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut();
  if (!error) {
    // Stan onboardingu należy do konta, nie do urządzenia.
    resetOnboarding();
  }
  return { error: error ? toPolishAuthError(error) : null };
}
