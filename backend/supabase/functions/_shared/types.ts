import { corsHeaders } from "./cors.ts";

// Shared response envelope for all Edge Functions.
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

// Build a JSON Response with CORS headers.
export function jsonResponse(body: ApiResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Odpowiedź 500 dla nieobsłużonego wyjątku. Jedno miejsce dla wszystkich
 * funkcji, żeby format błędu nie rozjeżdżał się między domenami.
 *
 * Treść wyjątku NIE wychodzi do klienta. Wcześniej doklejaliśmy `err.message`
 * do odpowiedzi, więc do interfejsu trafiały surowe komunikaty Postgresa
 * (nazwy kolumn, treść zapytań) i fragmenty odpowiedzi API modelu. Zamiast
 * tego logujemy pełny błąd z krótkim numerem zgłoszenia i pokazujemy sam
 * numer, żeby dało się połączyć relację użytkownika z wpisem w logach.
 */
export function serverErrorResponse(functionName: string, err: unknown): Response {
  const incidentId = crypto.randomUUID().slice(0, 8);
  console.error(`${functionName} error [${incidentId}]:`, err);
  return jsonResponse(
    {
      ok: false,
      error: `Wystąpił błąd. Spróbuj ponownie później. Numer zgłoszenia: ${incidentId}.`,
    },
    500,
  );
}
