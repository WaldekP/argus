// Adapter TVN24 (tvn24.pl): strony autorow -> ScrapedJournalist[].
//
// Ustalenia z rekonesansu (2026-09-08, zwykly User-Agent przegladarki):
//   - robots.txt: "User-agent: *" blokuje tylko /_e/p/playlist/* i *?page=*,
//     sciezki artykulow i profili autorow sa dozwolone. Osobna regula blokuje
//     GPTBota, ale to nie dotyczy tego crawla (jedziemy wlasnym UA i tylko po
//     publicznych stronach autorskich),
//   - artykuly: /<sekcja>/<slug>-st<id> (id numeryczne),
//   - profil autora: https://tvn24.pl/autorzy/<slug>-ap<id>,
//   - autor siedzi w JSON-LD artykulu:
//     "author":{"@type":"Person","name":"Filip Czerwinski",
//               "url":"https://tvn24.pl/autorzy/filip-czerwinski-ap8702730"},
//     przy dwoch autorach jest to tablica,
//   - profil autora tez ma JSON-LD Person z "name" i "description" (opis bywa
//     pusty), a naglowek H1 zawiera samo nazwisko.
//
// Dlaczego JSON-LD, a nie selektory CSS: TVN24 renderuje styled-components
// z losowanymi klasami ("sc-aXZVgy sc-gEvEery ldavXXy dUmtgUy"), ktore zmieniaja
// sie przy kazdym buildzie. Parsowanie po klasach zgnilo by w tydzien, JSON-LD
// jest kontraktem dla wyszukiwarek i trzyma sie znacznie dluzej.
//
// Maile: TVN24 nie publikuje osobistych adresow na profilach, a zaden
// opublikowany adres nie potwierdza wzorca osobistego, wiec NIE zgadujemy
// (zasada z pozostalych adapterow: pattern dopiero po potwierdzeniu na
// co najmniej jednym opublikowanym adresie). Modul jest czysty (fetch + regex),
// zeby dzialal i w Deno, i w Node.

import type { ScrapedJournalist } from "./types.ts";
import { mergeTopics } from "./topics.ts";

const HOST = "https://tvn24.pl";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Sekcje-ziarna, od ktorych startuje crawl. */
export const DEFAULT_SECTIONS = ["polska", "swiat", "biznes"];

/** Odstep miedzy zadaniami, zeby nie walic w serwis seria bez przerwy. */
const DELAY_MS = 400;

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "pl" },
      redirect: "follow",
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Artykuly TVN24: /<sekcja>/<slug>-st<id>, relatywne i absolutne. */
export function extractArticleUrls(html: string): string[] {
  const found = new Set<string>();
  const re = /href="(?:https:\/\/tvn24\.pl)?(\/[a-z0-9-]+\/[a-z0-9-]+-st\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    found.add(`${HOST}${m[1]}`);
  }
  return [...found];
}

export interface ArticleAuthor {
  fullName: string;
  authorUrl: string;
  slug: string;
}

/**
 * Autorzy z JSON-LD artykulu. Obsluguje pojedynczy obiekt i tablice; bierzemy
 * tylko wpisy, ktore maja i nazwe, i adres profilu — sam "name" bez profilu
 * bywa nazwa redakcji ("Polsat News", "Redakcja"), a nie osoba.
 */
export function extractAuthors(html: string): ArticleAuthor[] {
  const found = new Map<string, ArticleAuthor>();
  const re =
    /"name"\s*:\s*"([^"]{3,80})"\s*,\s*"url"\s*:\s*"(https:\/\/tvn24\.pl\/autorzy\/([a-z0-9-]+-ap\d+))"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const fullName = decodeEntities(m[1]).trim();
    if (!fullName.includes(" ")) continue; // imie i nazwisko, nie nick redakcji
    found.set(m[3], { fullName, authorUrl: m[2], slug: m[3] });
  }
  return [...found.values()];
}

/** Sekcja z adresu artykulu, do mapowania tematow. */
export function sectionFromUrl(url: string): string {
  const m = /tvn24\.pl\/([a-z0-9-]+)\//.exec(url);
  return m ? m[1] : "";
}

/** Opis autora z JSON-LD profilu. Pusty opis zwracamy jako null. */
export function extractBio(html: string): string | null {
  const m = /"@type"\s*:\s*"Person"[^}]*?"description"\s*:\s*"([^"]*)"/.exec(html);
  if (!m) return null;
  const bio = decodeEntities(m[1]).trim();
  return bio.length > 0 ? bio : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

export interface CrawlOptions {
  sections?: string[];
  maxAuthors?: number;
  maxArticlesPerSection?: number;
}

export async function crawlTvn24(opts: CrawlOptions = {}): Promise<ScrapedJournalist[]> {
  const sections = opts.sections ?? DEFAULT_SECTIONS;
  const maxAuthors = opts.maxAuthors ?? 60;
  const maxArticles = opts.maxArticlesPerSection ?? 20;

  // slug -> zebrane dane autora
  const autorzy = new Map<
    string,
    { fullName: string; authorUrl: string; sections: Set<string>; articles: Set<string> }
  >();

  for (const section of sections) {
    const html = await fetchText(`${HOST}/${section}`);
    if (!html) continue;
    const articles = extractArticleUrls(html).slice(0, maxArticles);

    for (const articleUrl of articles) {
      if (autorzy.size >= maxAuthors) break;
      await sleep(DELAY_MS);
      const articleHtml = await fetchText(articleUrl);
      if (!articleHtml) continue;

      for (const a of extractAuthors(articleHtml)) {
        const wpis = autorzy.get(a.slug) ?? {
          fullName: a.fullName,
          authorUrl: a.authorUrl,
          sections: new Set<string>(),
          articles: new Set<string>(),
        };
        wpis.sections.add(sectionFromUrl(articleUrl));
        wpis.articles.add(articleUrl);
        autorzy.set(a.slug, wpis);
      }
    }
  }

  const wynik: ScrapedJournalist[] = [];
  for (const [slug, wpis] of autorzy) {
    await sleep(DELAY_MS);
    const profil = await fetchText(wpis.authorUrl);
    const bio = profil ? extractBio(profil) : null;

    wynik.push({
      fullName: wpis.fullName,
      outletAuthorSlug: slug,
      authorUrl: wpis.authorUrl,
      role: null,
      email: null,
      emailStatus: "none",
      bio,
      topics: mergeTopics([...wpis.sections], `${wpis.fullName} ${bio ?? ""}`),
      socials: {},
      sourceUrls: [wpis.authorUrl],
      articleUrls: [...wpis.articles].slice(0, 20),
    });
  }
  return wynik;
}
