// Bing News RSS jako zrodlo wzmianek prasowych.
//
// Powod istnienia: Google News odpowiada bledem 503 na ruch z adresow centrow
// danych, wiec z runtime'u Edge Functions jest nieosiagalny, mimo ze lokalnie
// dziala. Bing nie ma tego ograniczenia.
//
// Przy okazji daje lepsze dane niz Google News:
//   - `description` to prawdziwy lead artykulu, a nie powtorzony tytul,
//   - `News:Source` podaje nazwe redakcji,
//   - w linku przekierowujacym siedzi PRAWDZIWY adres artykulu, wiec da sie
//     go wyluskac bez dodatkowego requestu.
//
// Kontrakt: docs/kontrakt-wzmianki.md
import type { NewsItem } from "./news-sources.ts";
import {
  hostLabel,
  itemBlocks,
  tagValue,
  toIsoDate,
  toSnippet,
} from "./rss.ts";

const FEED_BASE = "https://www.bing.com/news/search";

/**
 * Adres feedu.
 *
 * CELOWO BEZ `qft=interval`. Sprawdzone 2026-07-24 na hasle "Ryszard Petru":
 * z tym parametrem Bing przestaje respektowac zapytanie i zwraca ogolne
 * wiadomosci (1 trafna pozycja na 12), bez niego trafia w 12 na 12. Filtr
 * daty robimy po swojej stronie w `withinWindow`, bo `pubDate` jest w kazdej
 * pozycji feedu.
 */
export function buildFeedUrl(query: string): string {
  const params = new URLSearchParams({
    q: query.trim(),
    format: "RSS",
    cc: "PL",
    setLang: "pl",
  });
  return `${FEED_BASE}?${params.toString()}`;
}

/**
 * Link Binga ma postac `bing.com/news/apiclick.aspx?...&url=<adres>&...`.
 * Wyciagamy z niego prawdziwy adres artykulu; gdy sie nie da, zostaje link
 * przekierowujacy, bo w przegladarce i tak zadziala.
 */
export function unwrapLink(link: string): string {
  const match = link.match(/[?&]url=([^&]+)/i);
  if (!match) return link;
  try {
    const decoded = decodeURIComponent(match[1]);
    return decoded.startsWith("http") ? decoded : link;
  } catch {
    return link;
  }
}

/**
 * Czy pozycja miesci sie w oknie czasowym.
 *
 * Bez `qft` Bing miesza swieze wiadomosci z archiwaliami sprzed lat (w probce
 * byly wpisy z 2011 i 2023 roku), wiec okno musimy wyciac sami. Pozycje bez
 * dajacej sie sparsowac daty odrzucamy: wzmianki bez daty nie da sie umiescic
 * w briefie porannym, ktory z definicji dotyczy dzisiaj.
 */
export function withinWindow(publishedAt: string | null, windowDays: number): boolean {
  if (!publishedAt) return false;
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return false;
  const days = Math.min(Math.max(Math.trunc(windowDays), 1), 30);
  return Date.now() - published <= days * 24 * 60 * 60 * 1000;
}

export function parseFeed(xml: string): NewsItem[] {
  const items: NewsItem[] = [];

  for (const block of itemBlocks(xml)) {
    const title = tagValue(block, "title");
    const rawLink = tagValue(block, "link");
    if (!title || !rawLink) continue;

    const url = unwrapLink(rawLink);

    items.push({
      // Bing nie podaje guid, wiec kluczem deduplikacji jest adres artykulu.
      // Po rozwinieciu linku jest to adres redakcji, czyli stabilny.
      externalId: url,
      title,
      url,
      snippet: toSnippet(tagValue(block, "description"), title),
      publishedAt: toIsoDate(tagValue(block, "pubDate")),
      sourceName: tagValue(block, "News:Source") ?? hostLabel(url),
      sourceUrl: null,
    });
  }

  return items;
}

export async function fetchBingNews(
  query: string,
  windowDays: number,
): Promise<NewsItem[]> {
  const url = buildFeedUrl(query);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/rss+xml, application/xml" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Bing News: brak polaczenia (${reason})`);
  }

  if (!response.ok) {
    throw new Error(`Bing News: odpowiedz ${response.status}`);
  }

  return parseFeed(await response.text())
    .filter((item) => withinWindow(item.publishedAt, windowDays));
}
