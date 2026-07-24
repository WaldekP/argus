/**
 * Rozpakowanie błędu z `supabase.functions.invoke`.
 *
 * Klient Supabase pakuje przyczynę do pola `context`, ale jego typ zależy od
 * rodzaju awarii i NIE zawsze jest obiektem `Response`:
 *
 * - `FunctionsHttpError` — funkcja odpowiedziała kodem błędu. `context` to
 *   `Response`, a w ciele siedzi nasza koperta `{ ok: false, error }`.
 * - `FunctionsFetchError` — żądanie w ogóle nie doszło (funkcja niewdrożona,
 *   brak sieci, CORS). `context` to zwykły obiekt błędu, bez metody `json`.
 * - `FunctionsRelayError` — awaria po stronie infrastruktury Supabase.
 *
 * Wywołanie `context.json()` bez sprawdzenia typu kończy się komunikatem
 * "context.json is not a function", który zasłania prawdziwą przyczynę.
 */

/** Czy obiekt zachowuje się jak `Response` (ma metodę `json`). */
function isResponseLike(value: unknown): value is Response {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { json?: unknown }).json === 'function'
  );
}

/**
 * Zamienia błąd z `invoke` na `Error` z komunikatem nadającym się do pokazania.
 * Nazwa funkcji trafia do komunikatu, bo najczęstsza przyczyna to brak wdrożenia.
 */
export async function unwrapFunctionError(
  error: unknown,
  functionName: string,
): Promise<Error> {
  const context = (error as { context?: unknown } | null)?.context;

  if (isResponseLike(context)) {
    const body = await context.json().catch(() => null);
    if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
      return new Error((body as { error: string }).error);
    }
    const status = (context as Response).status;
    if (status === 404) {
      return new Error(
        `Funkcja ${functionName} nie istnieje. Wdróż ją: supabase functions deploy ${functionName}.`,
      );
    }
    return new Error(`Funkcja ${functionName} odpowiedziała błędem ${status}.`);
  }

  const message = error instanceof Error ? error.message : String(error);

  // Brak odpowiedzi w ogóle. Na tym etapie projektu przyczyną prawie zawsze
  // jest niewdrożona funkcja, więc mówimy to wprost zamiast "Failed to fetch".
  if (/failed to (send|fetch)|network/i.test(message)) {
    return new Error(
      `Nie udało się połączyć z funkcją ${functionName}. Sprawdź, czy została wdrożona: supabase functions deploy ${functionName}.`,
    );
  }

  return new Error(message);
}
