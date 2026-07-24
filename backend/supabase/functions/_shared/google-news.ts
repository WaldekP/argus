// Google News RSS jako zrodlo wzmianek prasowych.
//
// UWAGA, sprawdzone 2026-07-24: Google odpowiada bledem 503 na zadania
// z adresow centrow danych. Lokalnie ten sam feed zwraca kilkanascie pozycji,
// z runtime'u Edge Functions nie zwraca nic. Dlatego to zrodlo jest
// ZAPASOWE, a podstawowym jest Bing News (`bing-news.ts`).
//
// Zostawiamy je, bo dziala przy uruchomieniu ze zwyklego lacza (skrypty
// lokalne, przyszly worker poza Supabase) i bywa szersze dla polskiej prasy.
//
// Kontrakt: docs/kontrakt-wzmianki.md
import type { NewsItem } from "./news-sources.ts";
import {
  attributeValue,
  itemBlocks,
  tagValue,
  toIsoDate,
  toSnippet,
} from "./rss.ts";

const FEED_BASE = "https://news.google.com/rss/search";

// Google News odmawia obslugi klientom bez naglowka User-Agent.
const USER_AGENT = "Mozilla/5.0 (compatible; ArgusBot/1.0; +https://argus.ai)";

/**
 * Adres feedu dla zapytania, zawezony do polskiej edycji Google News.
 *
 * Zapytanie moze uzywac operatorow Google News, w tym `OR`, cudzyslowow
 * i `site:`. Okno czasowe dokladamy operatorem `when:Nd`, bo bez niego feed
 * potrafi zwrocic archiwalia sprzed lat.
 */
export function buildFeedUrl(query: string, windowDays: number): string {
  const days = Math.min(Math.max(Math.trunc(windowDays), 1), 30);
  const params = new URLSearchParams({
    q: `${query.trim()} when:${days}d`,
    hl: "pl",
    gl: "PL",
    ceid: "PL:pl",
  });
  return `${FEED_BASE}?${params.toString()}`;
}

/**
 * Google News dokleja do tytulu nazwe redakcji po ostatnim myslniku.
 * Ucinamy ja, bo zrodlo trzymamy w osobnej kolumnie, ale tylko gdy sufiks
 * faktycznie odpowiada nazwie redakcji. Inaczej skasowalibysmy tytuly, ktore
 * same koncza sie myslnikiem.
 */
function stripSourceSuffix(title: string, sourceName: string | null): string {
  if (!sourceName) return title;
  const suffix = ` - ${sourceName}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

export function parseFeed(xml: string): NewsItem[] {
  const items: NewsItem[] = [];

  for (const block of itemBlocks(xml)) {
    const title = tagValue(block, "title");
    const url = tagValue(block, "link");
    if (!title || !url) continue;

    const sourceName = tagValue(block, "source");
    const cleanTitle = stripSourceSuffix(title, sourceName);

    items.push({
      externalId: tagValue(block, "guid") ?? url,
      title: cleanTitle,
      url,
      snippet: toSnippet(tagValue(block, "description"), cleanTitle),
      publishedAt: toIsoDate(tagValue(block, "pubDate")),
      sourceName,
      sourceUrl: attributeValue(block, "source", "url"),
    });
  }

  return items;
}

export async function fetchGoogleNews(
  query: string,
  windowDays: number,
): Promise<NewsItem[]> {
  const url = buildFeedUrl(query, windowDays);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Google News: brak polaczenia (${reason})`);
  }

  if (!response.ok) {
    // 503 z adresu centrum danych to regula, nie awaria chwilowa.
    throw new Error(`Google News: odpowiedz ${response.status}`);
  }

  return parseFeed(await response.text());
}
