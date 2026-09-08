// Adapter Polsat News (polsatnews.pl): strony autorow -> ScrapedJournalist[].
//
// Ustalenia z rekonesansu (2026-09-08, zwykly User-Agent przegladarki):
//   - robots.txt blokuje modules, sondy, wyszukiwarke i adresy z parametrami
//     sledzacymi; sciezki artykulow i profili autorow sa dozwolone,
//   - artykuly: /<sekcja>/<RRRR-MM-DD>/<slug>/, gdzie sekcja to "wiadomosc"
//     albo nazwa programu ("graffiti", "gosc-wydarzen"),
//   - profil autora: https://www.polsatnews.pl/autor/<slug>_<id>/,
//   - autor siedzi w JSON-LD artykulu jako tablica:
//     "author": [{"@type": "Person","url": "https://www.polsatnews.pl/autor/
//     michal-blus_1497513/","name": "Michal Blus"}] — uwaga, kolejnosc pol bywa
//     odwrotna niz w TVN24, wiec parsujemy oba warianty,
//   - profil ma <h1 class="host__title"> z pelnym imieniem i nazwiskiem oraz
//     wlasna liste artykulow autora.
//
// Lista artykulow na profilu jest SPRAWDZONA jako wlasciwa dla autora, a nie
// wspolny sidebar serwisu (pulapka, ktora ugryzla adapter RMF24): dwa rozne
// profile daly po 18 linkow i ZERO wspolnych. Dlatego materialy bierzemy
// z profilu, nie tylko z artykulow, w ktorych trafilismy na byline.
//
// Maile: Polsat nie publikuje osobistych adresow na profilach, wiec wzorca NIE
// zgadujemy (zasada z pozostalych adapterow). Modul czysty (fetch + regex).

import type { ScrapedJournalist } from "./types.ts";
import { mergeTopics } from "./topics.ts";

const HOST = "https://www.polsatnews.pl";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Sekcje-ziarna. UWAGA: polsatnews.pl NIE ma sekcji /polityka/, /kraj/ ani
 * /biznes/ — takie adresy oddaja strone 404 z wlasna nawigacja, wiec crawl
 * niby dziala, a wraca z pustymi rekami. Prawdziwe listy to
 * "wiadomosci-najnowsze" oraz strony programow. "graffiti" i "gosc-wydarzen"
 * to wywiady z politykami, czyli dokladnie to, po co ta baza istnieje.
 */
export const DEFAULT_SECTIONS = ["wiadomosci-najnowsze", "graffiti", "gosc-wydarzen"];

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

/** Artykuly: /<sekcja>/<RRRR-MM-DD>/<slug>/. */
export function extractArticleUrls(html: string): string[] {
  const found = new Set<string>();
  const re =
    /href="(?:https:\/\/www\.polsatnews\.pl)?(\/[a-z0-9-]+\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\/)"/g;
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
 * Autorzy z JSON-LD artykulu. Polsat potrafi ustawic pola w obu kolejnosciach
 * ("url" przed "name" i odwrotnie), wiec lecimy dwoma wzorcami. Bierzemy tylko
 * wpisy z profilem i z imieniem oraz nazwiskiem — samo "Polsat News" w polu
 * autora to redakcja, nie osoba.
 */
export function extractAuthors(html: string): ArticleAuthor[] {
  const found = new Map<string, ArticleAuthor>();
  const profil = "https:\\/\\/www\\.polsatnews\\.pl\\/autor\\/([a-z0-9-]+_\\d+)\\/";
  const wzorce = [
    new RegExp(`"url"\\s*:\\s*"(${profil})"\\s*,\\s*"name"\\s*:\\s*"([^"]{3,80})"`, "g"),
    new RegExp(`"name"\\s*:\\s*"([^"]{3,80})"\\s*,\\s*"url"\\s*:\\s*"(${profil})"`, "g"),
  ];

  // Pierwszy wzorzec: url, potem name. Drugi: name, potem url.
  let m: RegExpExecArray | null;
  while ((m = wzorce[0].exec(html)) !== null) {
    dodaj(found, decodeEntities(m[3]), m[1], m[2]);
  }
  while ((m = wzorce[1].exec(html)) !== null) {
    dodaj(found, decodeEntities(m[1]), m[2], m[3]);
  }
  return [...found.values()];
}

function dodaj(
  found: Map<string, ArticleAuthor>,
  fullName: string,
  authorUrl: string,
  slug: string,
): void {
  const imieNazwisko = fullName.trim();
  if (!imieNazwisko.includes(" ")) return;
  found.set(slug, { fullName: imieNazwisko, authorUrl, slug });
}

/** Nazwa autora z naglowka profilu (klasa host__title jest semantyczna, nie losowana). */
export function extractNameFromProfile(html: string): string | null {
  const m = /<h1[^>]*class="[^"]*host__title[^"]*"[^>]*>([^<]{3,80})<\/h1>/.exec(html);
  return m ? decodeEntities(m[1]).trim() : null;
}

/** Sekcja z adresu artykulu, do mapowania tematow. */
export function sectionFromUrl(url: string): string {
  const m = /polsatnews\.pl\/([a-z0-9-]+)\/\d{4}-/.exec(url);
  return m ? m[1] : "";
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

export async function crawlPolsat(opts: CrawlOptions = {}): Promise<ScrapedJournalist[]> {
  const sections = opts.sections ?? DEFAULT_SECTIONS;
  const maxAuthors = opts.maxAuthors ?? 60;
  const maxArticles = opts.maxArticlesPerSection ?? 20;

  const autorzy = new Map<
    string,
    { fullName: string; authorUrl: string; sections: Set<string>; articles: Set<string> }
  >();

  for (const section of sections) {
    const html = await fetchText(`${HOST}/${section}/`);
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
    if (profil) {
      // Nazwa z profilu jest pewniejsza niz z JSON-LD artykulu (bez skrotow).
      const nazwa = extractNameFromProfile(profil);
      if (nazwa) wpis.fullName = nazwa;
      for (const u of extractArticleUrls(profil)) wpis.articles.add(u);
    }

    wynik.push({
      fullName: wpis.fullName,
      outletAuthorSlug: slug,
      authorUrl: wpis.authorUrl,
      role: null,
      email: null,
      emailStatus: "none",
      bio: null,
      topics: mergeTopics([...wpis.sections], wpis.fullName),
      socials: {},
      sourceUrls: [wpis.authorUrl],
      articleUrls: [...wpis.articles].slice(0, 20),
    });
  }
  return wynik;
}
