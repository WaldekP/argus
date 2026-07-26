/**
 * Wspólny klient Edge Functions.
 *
 * Konwencja backendu (CLAUDE.md): jedna funkcja per domena, operacja w polu
 * `operation` w body, token usera w nagłówku `Authorization`, odpowiedź
 * w kopercie `{ ok: true, data }` albo `{ ok: false, error }`.
 *
 * Ten moduł jest jedynym miejscem, które o tym wie. Wcześniej każda domena
 * (content, analysis, onboarding, topics) miała własną, znakowo identyczną
 * kopię tej funkcji, a mentions i registry szły osobną ścieżką przez
 * `supabase.functions.invoke` z własną obsługą błędów, która gubiła przyczynę
 * awarii, gdy żądanie nie doszło w ogóle.
 *
 * Komunikaty błędów są po polsku i gotowe do pokazania w UI: warstwa wyżej
 * ma je wypisać, nie tłumaczyć.
 */

import { supabase } from '@/lib/supabase';

/** Wdrożone Edge Functions. Nowa domena = nowy wariant tutaj. */
export type EdgeFunctionName =
  | 'argus-analysis'
  | 'argus-content'
  | 'argus-mentions'
  | 'argus-onboarding'
  | 'argus-registry'
  | 'argus-topics';

/** Zwykły odczyt albo zapis. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Operacje długie: wywołanie modelu (generacja, dopytanie, ekstrakcja PDF)
 * albo pobranie z zewnętrznego źródła (RSS, API Sejmu). Sonnet i sieć
 * potrzebują zapasu czasu, stąd dwie minuty.
 */
export const LONG_TIMEOUT_MS = 120_000;

export const GENERIC_ERROR = 'Coś poszło nie tak. Spróbuj ponownie za chwilę.';
export const NETWORK_ERROR = 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
export const TIMEOUT_ERROR = 'Operacja trwała zbyt długo. Spróbuj ponownie.';
export const SESSION_ERROR = 'Sesja wygasła. Zaloguj się ponownie.';

/**
 * Wywołanie operacji Edge Function. Zwraca `data` z koperty albo rzuca
 * `Error` z komunikatem po polsku.
 */
export async function callEdge<T>(
  functionName: EdgeFunctionName,
  operation: string,
  payload?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error(GENERIC_ERROR);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error(SESSION_ERROR);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operation, ...payload }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR);
    }
    throw new Error(NETWORK_ERROR);
  } finally {
    clearTimeout(timer);
  }

  let body: { ok?: boolean; data?: T; error?: string } | null = null;
  try {
    body = (await response.json()) as { ok?: boolean; data?: T; error?: string };
  } catch {
    body = null;
  }

  if (!body || body.ok !== true) {
    if (body?.error && typeof body.error === 'string') {
      throw new Error(body.error);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(SESSION_ERROR);
    }
    // 404 to prawie zawsze niewdrożona funkcja, a "Coś poszło nie tak" wysyła
    // wtedy szukanie w złą stronę.
    if (response.status === 404) {
      throw new Error(
        `Funkcja ${functionName} nie jest wdrożona. Wdróż ją: supabase functions deploy ${functionName}.`
      );
    }
    throw new Error(GENERIC_ERROR);
  }

  return body.data as T;
}

/**
 * Klient przypięty do jednej funkcji, z typowaną listą operacji.
 * Domena zachowuje kontrolę nad tym, jakie operacje istnieją, i nie powtarza
 * transportu.
 */
export function edgeClient<Operation extends string>(functionName: EdgeFunctionName) {
  return function call<T>(
    operation: Operation,
    payload?: Record<string, unknown>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    return callEdge<T>(functionName, operation, payload, timeoutMs);
  };
}
