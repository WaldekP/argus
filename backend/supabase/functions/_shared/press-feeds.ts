// Prasa wprost z feedow RSS polskich redakcji.
//
// PO CO TO POWSTALO. Brief dnia zbieral prase, zadajac Bingowi osiem pytan
// o polska polityke. Sprawdzone 2026-09-14: Bing oddawal 85 pozycji, z czego
// DWIE z ostatniej doby, a dla hasla "rzad premiera" najnowsza pozycja w
// feedzie pochodzila z listopada 2023. Pobranie konczylo sie kodem 200, wiec
// nic nie zglaszalo awarii; filtr doby slusznie wyrzucal reszte i brief
// schodzil do jednej pozycji (13 wrzesnia) albo dwoch (14 wrzesnia).
//
// Te same redakcje maja wlasne feedy i sa zywe: 196 pozycji z ostatniej doby
// w tym samym momencie, w ktorym Bing mial dwie. Dlatego czytamy je wprost.
//
// Bing i Google zostaja w daily-brief.ts jako zrodlo zapytaniowe. Nie sa juz
// jedyna noga, ale potrafia wniesc tytul spoza tej szostki, a kosztuja osiem
// zapytan HTTP, ktore i tak lecialy.

import type { NewsItem } from "./news-sources.ts";
import {
  decodeEntities,
  hostLabel,
  itemBlocks,
  tagValue,
  toIsoDate,
  toSnippet,
} from "./rss.ts";

interface Feed {
  outlet: string;
  url: string;
}

/**
 * Redakcje ogolnoinformacyjne o zasiegu krajowym. Sprawdzone 2026-09-15:
 * kazdy z tych adresow oddaje `<item>` w ukladzie, ktory czyta `rss.ts`.
 */
const FEEDS: Feed[] = [
  { outlet: "TVN24", url: "https://tvn24.pl/najnowsze.xml" },
  { outlet: "RMF24", url: "https://www.rmf24.pl/fakty/polska/feed" },
  { outlet: "Polsat News", url: "https://www.polsatnews.pl/rss/wszystkie.xml" },
  { outlet: "Wirtualna Polska", url: "https://wiadomosci.wp.pl/rss.xml" },
  { outlet: "Onet", url: "https://wiadomosci.onet.pl/.feed" },
  { outlet: "Interia", url: "https://fakty.interia.pl/feed" },
];

/**
 * Filtr tematyczny.
 *
 * Feed redakcji to strumien wszystkiego: sport, pogoda, wypadki, rozrywka.
 * Puszczenie tego w calosci do syntezy kosztowaloby kilkanascie tysiecy
 * tokenow dziennie za material, ktory i tak zostanie odrzucony, i rozcienczylo
 * kontekst polityczny.
 *
 * Lista jest CELOWO szeroka i dotyczy instytucji oraz formacji, nie nazwisk,
 * dokladnie tak jak `POLITYKA_QUERIES`. Wybor, co wazne dla konkretnego
 * polityka, nadal robi dopiero synteza. Filtr ma tylko odsiac mecz i prognoze.
 */
const SLOWA_KLUCZE = [
  "sejm", "senat", "rząd", "rzad", "premier", "minist", "prezydent", "kancelari",
  "posł", "posel", "posłank", "senator", "ustaw", "nowelizacj", "weto",
  "budżet", "budzet", "podat", "składk", "skladk", "zus", "nfz", "deficyt",
  "koalicj", "opozycj", "partia", "partii", "wybor", "wybór", "sondaż", "sondaz",
  "prawo i sprawiedliwość", "platforma obywatelska", "koalicja obywatelska",
  "konfederacj", "lewic", "polska 2050", "psl", "trzecia droga", "razem",
  "tusk", "kaczyńsk", "kaczynsk", "nawrock", "hołowni", "holowni", "mentzen",
  "bosak", "czarzast", "kosiniak", "petru",
  "trybunał", "trybunal", "prokuratur", "sąd najwyższy", "sad najwyzszy", "krs",
  "unia europejsk", "komisja europejsk", "nato", "ukrain", "reform",
  "protest", "strajk", "referend", "immunitet", "komisja śledcz", "komisja sledcz",
];

/** Ile pozycji maksymalnie oddajemy dalej. Chroni dlugosc promptu syntezy. */
const LIMIT = 60;

function pasujeTematycznie(tytul: string, zajawka: string | null): boolean {
  const tekst = `${tytul} ${zajawka ?? ""}`.toLowerCase();
  return SLOWA_KLUCZE.some((slowo) => tekst.includes(slowo));
}

function wOknie(publishedAt: string | null, windowDays: number): boolean {
  // Brak daty przepuszczamy: lepiej oddac pozycje bez daty niz zgubic swiezy
  // tytul przez feed, ktory nie podal `pubDate`. Synteza i tak cytuje URL.
  if (!publishedAt) return true;
  const czas = Date.parse(publishedAt);
  if (Number.isNaN(czas)) return true;
  return Date.now() - czas <= windowDays * 24 * 60 * 60 * 1000;
}

async function czytajFeed(feed: Feed, windowDays: number): Promise<NewsItem[]> {
  const response = await fetch(feed.url, {
    headers: { Accept: "application/rss+xml, application/xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${feed.outlet}: odpowiedz ${response.status}`);

  const xml = await response.text();
  const out: NewsItem[] = [];
  for (const block of itemBlocks(xml)) {
    const title = tagValue(block, "title");
    const link = tagValue(block, "link");
    if (!title || !link) continue;

    const url = decodeEntities(link).trim();
    if (!url.startsWith("http")) continue;

    const publishedAt = toIsoDate(tagValue(block, "pubDate"));
    if (!wOknie(publishedAt, windowDays)) continue;

    const snippet = toSnippet(tagValue(block, "description"), title);
    if (!pasujeTematycznie(title, snippet)) continue;

    out.push({
      externalId: url,
      title,
      url,
      snippet,
      publishedAt,
      sourceName: feed.outlet ?? hostLabel(url),
      sourceUrl: url,
    });
  }
  return out;
}

export interface PressFeedsResult {
  items: NewsItem[];
  /** Redakcje, ktore odpowiedzialy, i te, ktore sie wysypaly. */
  ok: string[];
  bledy: { outlet: string; error: string }[];
}

/**
 * Wszystkie feedy rownolegle. Padniety feed jednej redakcji nie moze zabrac
 * briefu pozostalym, wiec kazdy blad jest zapisywany i pomijany.
 */
export async function fetchPressFeeds(windowDays: number): Promise<PressFeedsResult> {
  const wyniki = await Promise.allSettled(
    FEEDS.map((feed) => czytajFeed(feed, windowDays)),
  );

  const items: NewsItem[] = [];
  const widziane = new Set<string>();
  const ok: string[] = [];
  const bledy: { outlet: string; error: string }[] = [];

  wyniki.forEach((wynik, i) => {
    const feed = FEEDS[i];
    if (wynik.status === "rejected") {
      bledy.push({
        outlet: feed.outlet,
        error: wynik.reason instanceof Error ? wynik.reason.message : String(wynik.reason),
      });
      return;
    }
    ok.push(feed.outlet);
    for (const item of wynik.value) {
      if (widziane.has(item.url)) continue;
      widziane.add(item.url);
      items.push(item);
    }
  });

  // Najnowsze najpierw, zeby obciecie do LIMIT zabieralo najstarsze, a nie
  // przypadkowa redakcje z konca listy.
  items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  return { items: items.slice(0, LIMIT), ok, bledy };
}
