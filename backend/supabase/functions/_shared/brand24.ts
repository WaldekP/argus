// Klient Brand24 Data API (plan Enterprise, autoryzacja kluczem API).
// Dokumentacja: https://api-data.brand24.com/api-data-docs/documentation
// Spec maszynowy: https://api-data.brand24.com/static/js/api-data/apiDocs.json
//
// Klucz: sekret Edge Functions BRAND24_API_KEY, ustawiany przez
// `supabase secrets set`. Nigdy w kodzie i nigdy w bundlu klienta.
//
// Zasada nadrzedna: API dziala per projekt monitoringu (project_id = zestaw
// hasel). Hasel NIE da sie zmienic przez API po zalozeniu projektu (jest tylko
// create_project i odczyt keywords), wiec zestaw hasel trafiamy za pierwszym
// razem. Projekt zbiera dopiero od zalozenia — brak backfillu.
import { HttpError } from "./auth.ts";

// Brand24 ma dwie rozlaczne instancje: .com i .pl. Konto zalozone w jednej NIE
// istnieje w drugiej, a objawem uderzania pod zly host jest 401
// "Unauthorized access." albo "Account does not exist" przy poprawnym kluczu.
// Host jest wiec konfiguracja, nie stala w kodzie: ustaw sekret
// BRAND24_API_BASE na "https://api-data.brand24.pl", jesli konto jest na .pl.
const DEFAULT_BASE = "https://api-data.brand24.com";

function baseUrl(): string {
  const configured = Deno.env.get("BRAND24_API_BASE")?.trim();
  return `${(configured || DEFAULT_BASE).replace(/\/+$/, "")}/api-data/v1`;
}

function apiKey(): string {
  const key = Deno.env.get("BRAND24_API_KEY");
  if (!key) {
    throw new HttpError(
      503,
      "Integracja z Brand24 jest nieskonfigurowana (brak BRAND24_API_KEY).",
    );
  }
  return key;
}

// Koperta odpowiedzi Brand24 jest NIESPOJNA miedzy endpointami i to jest tu
// najwazniejsza pulapka:
//   - projects_list, topics, project_events, create_project -> payload w `data`,
//   - mentions, languages                                   -> payload w `message`.
// Blad zawsze: { status: "fail"|"error", message: "<tekst>", code }.
// Dlatego `payloadOf` bierze `data`, a gdy go nie ma i `message` jest obiektem,
// bierze `message`. Czytanie samego `data` dawalo dla wzmianek pusty obiekt,
// czyli ciche "zero wzmianek" zamiast bledu.
interface Envelope<T> {
  status: "success" | "fail" | "error";
  data?: T;
  message?: unknown;
  code?: number;
}

function payloadOf<T>(envelope: Envelope<T>): T {
  if (envelope.data !== undefined && envelope.data !== null) {
    return envelope.data;
  }
  const message = envelope.message;
  if (message !== null && typeof message === "object") {
    return message as T;
  }
  return {} as T;
}

async function request<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  init: RequestInit = {},
): Promise<T> {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "X-Api-Key": apiKey(),
        "Accept": "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new HttpError(502, `Brand24 nie odpowiada: ${message}`);
  }

  const text = await response.text();
  let envelope: Envelope<T> | null = null;
  try {
    envelope = JSON.parse(text) as Envelope<T>;
  } catch {
    // Odpowiedz nie jest JSON-em — zostaw surowy tekst w komunikacie.
  }

  if (!response.ok || envelope?.status !== "success") {
    const info = typeof envelope?.message === "string"
      ? envelope.message
      : (text || `HTTP ${response.status}`);
    if (response.status === 401 || response.status === 403) {
      // Najczestsza przyczyna nie jest zly klucz, tylko zla instancja: konto
      // z brand24.pl nie istnieje na api-data.brand24.com i odwrotnie.
      throw new HttpError(
        503,
        "Brand24 odrzucil klucz. Sprawdz, czy BRAND24_API_BASE wskazuje te " +
          "instancje (.pl albo .com), w ktorej zalozone jest konto.",
      );
    }
    if (response.status === 429) {
      throw new HttpError(429, "Przekroczony limit zapytan do Brand24.");
    }
    throw new HttpError(502, `Brand24 (${response.status}): ${info}`);
  }

  return payloadOf(envelope);
}

// ---------------------------------------------------------------------------
// Ksztalt danych (tylko pola, ktorych faktycznie uzywamy)
// ---------------------------------------------------------------------------

/** Definicja jednego hasla przy tworzeniu projektu. */
export interface KeywordSpec {
  keyword: string;
  required?: string[];
  excluded?: string[];
}

/**
 * Wzmianka z Data API: dokladnie te dziewiec pol, ktore zwraca endpoint.
 *
 * Czego tu NIE MA i co z tego wynika:
 *   - `id` — API celowo nie oddaje wewnetrznego identyfikatora wzmianki,
 *     wiec dedup musi stac na kluczu syntetycznym (patrz mentionExternalId),
 *   - `url` — adres siedzi w polu `source`, a dla X/Twittera jest tam zamiast
 *     niego "Tweet-ID: <id>", czyli nie kazda wzmianka ma link.
 *
 * Dla Facebooka i Instagrama `title`, `content` i `source` sa NULL (ToS
 * dostawcy), dla X/Twittera null sa `title` i `content`.
 */
export interface Brand24Mention {
  date?: string | null;
  time?: string | null;
  title?: string | null;
  content?: string | null;
  /** Zwykle URL wzmianki, dla X/Twittera "Tweet-ID: ...". */
  source?: string | null;
  /** Domena, na ktorej znaleziono wzmianke. */
  host?: string | null;
  category?: string | null;
  /** -1 negatywny, 0 neutralny, 1 pozytywny. */
  sentiment?: number | null;
  tags?: string[] | null;
}

interface MentionsResponse {
  results?: Brand24Mention[];
  has_more_mentions?: boolean;
  cursor?: string | null;
}

export interface Brand24Topic {
  topic_id?: string | number;
  topic_name?: string;
  description?: string;
  mentions?: number;
  reach?: number;
  share_of_voice?: number;
  sentiment?: { positive?: number; negative?: number; neutral?: number };
}

export interface Brand24Anomaly {
  anomaly_date?: string;
  description?: string;
  peak_mentions?: number;
  peak_reach?: number;
}

// ---------------------------------------------------------------------------
// Operacje
// ---------------------------------------------------------------------------

/**
 * Utworzenie projektu monitoringu. UWAGA: to jednorazowa, nieodwracalna przez
 * API operacja (hasel nie zmienisz pozniej programowo) i rusza zliczanie limitu
 * planu. Zwraca id nowego projektu.
 */
export async function createProject(
  accountId: string,
  keywords: KeywordSpec[],
): Promise<string> {
  const data = await request<{ projectId?: string | number }>(
    `/account/${encodeURIComponent(accountId)}/create_project`,
    {},
    { method: "POST", body: JSON.stringify({ keywords }) },
  );
  const id = data.projectId;
  if (id === undefined || id === null) {
    throw new HttpError(502, "Brand24 nie zwrocil id nowego projektu.");
  }
  return String(id);
}

/** Lista projektow konta (ID -> nazwa). Do weryfikacji, ze projekt istnieje. */
export function listProjects(
  accountId: string,
): Promise<{ projects_list?: Record<string, string> }> {
  return request(`/account/${encodeURIComponent(accountId)}/projects_list/`);
}

/**
 * Porcja wzmianek projektu. Kursorowa paginacja: przekaz `cursor` z poprzedniej
 * odpowiedzi, zeby ciagnac dalej. Filtr po sentymencie/kategorii opcjonalny.
 */
export async function getMentions(
  projectId: string,
  opts: {
    dateFrom: string;
    dateTo: string;
    limit?: number;
    cursor?: string;
    sentiment?: string;
    category?: string;
  },
): Promise<{ mentions: Brand24Mention[]; cursor: string | null; hasMore: boolean }> {
  const data = await request<MentionsResponse>(
    `/project/${encodeURIComponent(projectId)}/mentions`,
    {
      date_from: opts.dateFrom,
      date_to: opts.dateTo,
      limit: opts.limit ?? 500,
      cursor: opts.cursor,
      sentiment: opts.sentiment,
      category: opts.category,
    },
  );
  // Nazwy pol sa z dokumentacji: tablica to `results` (nie `mentions`),
  // a o kolejna strone mowi `has_more_mentions`. Kursor bierzemy pod uwage
  // tylko razem z ta flaga, bo API zwraca go tez na ostatniej stronie.
  const hasMore = data.has_more_mentions === true;
  return {
    mentions: data.results ?? [],
    cursor: hasMore ? (data.cursor ?? null) : null,
    hasMore,
  };
}

/** AI-tematy: powracajace watki z liczba wzmianek, zasiegiem, sentymentem, SoV. */
export async function getTopics(
  projectId: string,
  opts: { dateFrom?: string; dateTo?: string } = {},
): Promise<Brand24Topic[]> {
  const data = await request<{ topics?: Brand24Topic[] }>(
    `/project/${encodeURIComponent(projectId)}/topics`,
    { date_from: opts.dateFrom, date_to: opts.dateTo },
  );
  return data.topics ?? [];
}

/** Wykryte skoki (anomalie) z opisem AI — "co sie nagle zagotowalo". */
export async function getProjectEvents(
  projectId: string,
  opts: { dateFrom?: string; dateTo?: string; limit?: number } = {},
): Promise<Brand24Anomaly[]> {
  const data = await request<{ anomalies?: Brand24Anomaly[] }>(
    `/project/${encodeURIComponent(projectId)}/project_events`,
    { date_from: opts.dateFrom, date_to: opts.dateTo, limit: opts.limit },
  );
  return data.anomalies ?? [];
}

// ---------------------------------------------------------------------------
// Normalizacja do modelu Argusa
// ---------------------------------------------------------------------------

/**
 * Sentyment Brand24 -> `mentions.tone` Argusa. Brand24 bywa niespojny (liczba
 * -1/0/1 albo tekst po angielsku), wiec obslugujemy oba. Nieznana wartosc =>
 * null (brak danych), nie zgadujemy.
 */
export function normalizeTone(
  value: string | number | null | undefined,
): "pozytywny" | "negatywny" | "neutralny" | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (value > 0) return "pozytywny";
    if (value < 0) return "negatywny";
    return "neutralny";
  }
  const v = value.toLowerCase();
  if (/(^|[^a-z])(positive|pozyt)/.test(v)) return "pozytywny";
  if (/(^|[^a-z])(negative|negat)/.test(v)) return "negatywny";
  if (/(^|[^a-z])(neutral|neutraln)/.test(v)) return "neutralny";
  return null;
}

/**
 * Adres wzmianki albo null. Pole `source` trzyma URL, ale dla X/Twittera jest
 * tam "Tweet-ID: <id>", a dla Facebooka i Instagrama null, wiec sprawdzamy
 * kszalt zamiast zakladac, ze cokolwiek tam jest linkiem.
 */
export function mentionUrl(m: Brand24Mention): string | null {
  const source = m.source?.trim();
  if (!source) return null;
  return /^https?:\/\//i.test(source) ? source : null;
}

/**
 * Stabilny external_id wzmianki.
 *
 * Data API NIE oddaje identyfikatora wzmianki (dokumentacja: "without the
 * internal mention id"), wiec dedup nie ma na czym stanac wprost. Kolejnosc:
 * URL, potem "Tweet-ID: ...", a gdy oba puste (Facebook, Instagram) —
 * deterministyczny skrot z pol, ktore zostaly.
 *
 * Zwraca null tylko wtedy, gdy wzmianka nie ma NIC, co ja rozroznia. Taka
 * wzmianka nie nadaje sie do zapisu, bo przy kazdym przebiegu wjechalaby
 * ponownie jako nowa.
 */
export function mentionExternalId(m: Brand24Mention): string | null {
  const url = mentionUrl(m);
  if (url) return url;

  const source = m.source?.trim();
  if (source) return source;

  const parts = [m.date, m.time, m.host, m.category, m.title, m.content]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v !== "");
  if (parts.length === 0) return null;

  // FNV-1a, 32 bit: synchroniczny i deterministyczny. crypto.subtle jest
  // asynchroniczne, a ten klucz liczymy w petli po kazdej wzmiance.
  let hash = 0x811c9dc5;
  // Separator jawnym escape'em (ASCII unit separator), nie znakiem w literale:
  // niewidzialny znak w tym miejscu zdazyl sie raz zgubic, a 0x1f nie wystepuje
  // w tresci wzmianki, wiec nie sklei dwoch roznych pol w jedno.
  const joined = parts.join("\u001f");
  for (let i = 0; i < joined.length; i += 1) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `b24:${hash.toString(16).padStart(8, "0")}`;
}
