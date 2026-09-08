/**
 * Klient Edge Function `argus-tenant`: sprawy na poziomie konta klienta.
 * Na razie telemetria pilotażu, czyli licznik logowań.
 *
 * Logowania zapisujemy w tabeli `access_logs` (action `login`), do której
 * klient nie ma dostępu przez RLS. Jedyną drogą jest ta funkcja.
 */

import { Platform } from 'react-native';

import { edgeClient } from '@/lib/api/client';

/** Licznik logowań jednego konta w tenancie. */
export type LoginStatsUser = {
  user_id: string;
  email: string | null;
  logins: number;
  /** ISO 8601 albo null, gdy konto nie logowało się jeszcze ani razu. */
  last_login_at: string | null;
};

export type LoginStats = {
  users: LoginStatsUser[];
  total: number;
};

type TenantOperation = 'record_login' | 'login_stats';

const callTenant = edgeClient<TenantOperation>('argus-tenant');

/**
 * Zapisuje jedno logowanie. Wołane po udanym `signIn`, świadomie bez
 * czekania na wynik: wpis do audytu nigdy nie może zatrzymać wejścia
 * do aplikacji ani pokazać użytkownikowi błędu.
 */
export function recordLogin(): void {
  void callTenant('record_login', { platform: Platform.OS }).catch(() => {
    // Cisza jest tu celowa. Nieudany zapis telemetrii to nie jest problem
    // użytkownika i nie ma o czym go informować.
  });
}

/** Licznik logowań wszystkich kont w biurze, malejąco. */
export function getLoginStats(): Promise<LoginStats> {
  return callTenant<LoginStats>('login_stats');
}
