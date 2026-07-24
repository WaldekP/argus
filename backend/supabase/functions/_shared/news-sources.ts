// Zrodla wzmianek prasowych i kolejnosc ich probowania.
//
// Dlaczego wiecej niz jedno: Google News, sprawdzony 2026-07-24, odpowiada
// bledem 503 na ruch z adresow centrow danych. To nie awaria chwilowa, tylko
// polityka Google, wiec pojedyncze zrodlo oznaczaloby funkcje, ktora dziala
// na laptopie i nie dziala na produkcji.
//
// Kontrakt: docs/kontrakt-wzmianki.md

/** Pozycja z dowolnego zrodla, sprowadzona do pol zapisywanych w `mentions`. */
export interface NewsItem {
  /** Klucz deduplikacji w obrebie hasla. */
  externalId: string;
  title: string;
  url: string;
  snippet: string | null;
  /** ISO 8601 albo null, gdy zrodlo poda date nie do sparsowania. */
  publishedAt: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

/** Nazwy zrodel. Musza sie zgadzac z ograniczeniem `check` na `mentions.source`. */
export type NewsSourceName = "bing_news" | "google_news" | "rss";

export interface NewsSource {
  name: NewsSourceName;
  fetch: (query: string, windowDays: number) => Promise<NewsItem[]>;
}

export interface FetchOutcome {
  /** Zrodlo, ktore odpowiedzialo. Null, gdy zadne. */
  source: NewsSourceName | null;
  items: NewsItem[];
  /** Zrodla, ktore sie wysypaly, w kolejnosci probowania. */
  failures: { source: NewsSourceName; error: string }[];
}

/**
 * Pierwsze zrodlo, ktore ODPOWIE, wygrywa. Zero wynikow to poprawna
 * odpowiedz, nie awaria: przy waskim hasle cisza jest normalna i nie ma
 * powodu pytac kolejnego zrodla o to samo.
 *
 * Do nastepnego zrodla schodzimy wylacznie po bledzie.
 */
export async function fetchFromSources(
  sources: NewsSource[],
  query: string,
  windowDays: number,
): Promise<FetchOutcome> {
  const failures: FetchOutcome["failures"] = [];

  for (const source of sources) {
    try {
      const items = await source.fetch(query, windowDays);
      return { source: source.name, items, failures };
    } catch (err) {
      failures.push({
        source: source.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { source: null, items: [], failures };
}

/** Zwiezly opis awarii do pokazania uzytkownikowi przy hasle. */
export function describeFailures(failures: FetchOutcome["failures"]): string {
  return failures.map((item) => item.error).join("; ");
}
