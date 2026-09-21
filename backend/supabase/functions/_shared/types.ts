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
/**
 * Rozpoznaje awarie Claude API, na ktore "spróbuj ponownie później" jest zla
 * odpowiedzia, bo ponawianie nic nie da albo da dopiero po czyjejs interwencji.
 *
 * Powod: 11 wrzesnia pilot zobaczyl "Wystąpił błąd, numer zgłoszenia 875ccc91"
 * przy pomyslach na tweety i "Nie udało się dokończyć odpowiedzi" u asystenta.
 * Prawdziwa przyczyna byla jedna i banalna: skonczyly sie srodki na koncie
 * Anthropic. Komunikat kazal probowac dalej, co nie mialo prawa zadzialac,
 * a osoba, ktora mogla to naprawic, nie wiedziala, ze ma cokolwiek zrobic.
 *
 * Zwraca null dla bledow, ktorych nie rozpoznajemy: wtedy leci komunikat
 * ogolny z numerem zgloszenia.
 */
export function describeAiError(err: unknown): string | null {
  const tresc = err instanceof Error ? `${err.message}` : String(err ?? "");
  const male = tresc.toLowerCase();

  if (male.includes("credit balance is too low") || male.includes("insufficient_quota")) {
    return "Skończyły się środki na koncie Claude API. Uzupełnij saldo w panelu Anthropic, " +
      "bez tego Argus nie wygeneruje żadnej treści.";
  }
  if (male.includes("overloaded") || male.includes("529")) {
    return "Model jest chwilowo przeciążony. Spróbuj ponownie za kilka minut.";
  }
  if (male.includes("rate_limit") || male.includes("rate limit") || male.includes("429")) {
    return "Przekroczony limit zapytań do Claude API. Odczekaj chwilę i spróbuj ponownie.";
  }
  if (male.includes("authentication_error") || male.includes("invalid x-api-key")) {
    return "Klucz Claude API został odrzucony. Sprawdź sekret ANTHROPIC_API_KEY.";
  }
  return null;
}

/**
 * Ile znakow komunikatu logujemy z poczatku i z konca, gdy jest dlugi.
 *
 * Powod: kolektor logow Supabase ucina wpis okolo 10 tysiecy znakow, a
 * LangChain sklada komunikat jako "Failed to parse. Text: <CALA odpowiedz
 * modelu>. Error: <wlasciwy powod>". Przy dlugiej odpowiedzi powod wypadal
 * poza limit i w logach zostawala sama tresc bez wyjasnienia, czyli
 * diagnozowanie po omacku. Logujemy oba konce.
 */
const LOG_EDGE_CHARS = 700;

/**
 * Rozpoznaje awarie STRUKTURY odpowiedzi modelu i zamienia je na zdanie,
 * po ktorym czlowiek wie, co zrobic.
 *
 * Powod: 21 wrzesnia polityk dwa razy pod rzad probowal przygotowac brief
 * na kilka godzin przed wywiadem i dwa razy zobaczyl "Wystąpił błąd, numer
 * zgłoszenia". Wpisal cztery watki naraz ("ceny paliw, Berek do TK,
 * bezpieczenstwo, pakiety fundacji"), bo tak wyglada prawdziwa rozmowa
 * w studiu. Komunikat nie dawal zadnej wskazowki, wiec powtorzyl to samo.
 *
 * Dwie przyczyny wygladaja z zewnatrz identycznie i wymagaja innej reakcji:
 * odpowiedz urwana w polowie (temat za szeroki, trzeba podzielic) oraz
 * pominiete pole (losowe, wystarczy powtorzyc). Rozroznia je dopiero koncowka
 * komunikatu wyjatku, ta sama, ktora kolektor logow ucinal do 20 wrzesnia.
 */
export function describeOutputError(err: unknown): string | null {
  const tresc = err instanceof Error ? err.message : String(err ?? "");
  if (!tresc.includes("Failed to parse")) return null;

  if (
    tresc.includes("Unexpected end of JSON input") ||
    tresc.includes("Unterminated string")
  ) {
    return "Temat jest zbyt szeroki, żeby zmieścić go w jednym briefie. " +
      "Podziel go na dwa albo trzy węższe i zamów osobno, wyjdą dokładniejsze.";
  }
  if (tresc.includes("invalid_type")) {
    return "Brief wyszedł niekompletny. Zamów go ponownie, to zdarza się losowo " +
      "i drugie podejście zwykle wystarcza.";
  }
  return "Model zwrócił odpowiedź w nieoczekiwanym formacie. Zamów brief ponownie.";
}

export function serverErrorResponse(functionName: string, err: unknown): Response {
  const incidentId = crypto.randomUUID().slice(0, 8);
  const tresc = err instanceof Error ? err.message : String(err ?? "");
  if (tresc.length > LOG_EDGE_CHARS * 2) {
    console.error(
      `${functionName} error [${incidentId}] (poczatek):`,
      tresc.slice(0, LOG_EDGE_CHARS),
    );
    console.error(
      `${functionName} error [${incidentId}] (koniec):`,
      tresc.slice(-LOG_EDGE_CHARS),
    );
  } else {
    console.error(`${functionName} error [${incidentId}]:`, err);
  }

  const znany = describeAiError(err);
  if (znany) {
    return jsonResponse({ ok: false, error: znany }, 503);
  }

  // 422, nie 503: to nie awaria usługi, tylko odpowiedź, której nie dało się
  // złożyć. Użytkownik ma tu co zrobić, więc nie wysyłamy go w „spróbuj
  // ponownie później".
  const format = describeOutputError(err);
  if (format) {
    return jsonResponse({ ok: false, error: format }, 422);
  }

  return jsonResponse(
    {
      ok: false,
      error: `Wystąpił błąd. Spróbuj ponownie później. Numer zgłoszenia: ${incidentId}.`,
    },
    500,
  );
}
