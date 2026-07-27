// Adapter RMF24 (rmf24.pl): strony autorow -> ScrapedJournalist[].
//
// Ustalenia z rekonesansu (2026-07-27, zwykly User-Agent przegladarki):
//   - robots.txt jest calkowicie otwarty ("User-agent: *" / "Disallow:" puste),
//     zadnych ograniczen dla sciezek profili autorow,
//   - profil autora: https://www.rmf24.pl/autor/<id>,<slug> (id numeryczne),
//   - byline w artykule wskazuje profil na dwa sposoby: relatywny
//     href="/autor/<id>,<slug>" oraz absolutny URL w JSON-LD ("author" ->
//     "url", schema.org/Person),
//   - profil zawiera: H1 (class="author-profile__name") = pelne imie
//     i nazwisko, bio w <div class="author-profile__description"> (bywa puste),
//     watermark <div id="background">DZIENNIKARZ</div> jako rola,
//   - na profilu NIE ma osobistego maila; jedyne mailto to adresy dzialowe
//     (fakty@rmf.fm, staz@rmf24.pl) powtarzane na kazdej stronie serwisu,
//   - lista artykulow na profilu (mrf-article-item, latest-news-item) to
//     WSPOLNY sidebar serwisu - identyczny na profilach roznych autorow,
//     wiec artykuly autora bierzemy z bylines (artykul, w ktorym znalezlismy
//     odnosnik do profilu, na pewno jest jego), nie ze strony profilu,
//   - artykuly: /fakty/<sekcja>/news-<slug>,nIdn,<id> oraz /regiony/<miasto>/...
//     - segment sekcji nadaje sie do mapowania na temat.
//
// Maile: RMF nie publikuje osobistych adresow, a zaden opublikowany adres nie
// potwierdza wzorca osobistego - wiec NIE zgadujemy wzorca (zasada: pattern
// tylko po potwierdzeniu na co najmniej jednym opublikowanym adresie).
// Status maila to 'none', chyba ze na stronie pojawi sie mailto z nazwiskiem
// autora - wtedy 'public'. Modul jest czysty (tylko fetch + regex), zeby
// dzialal i w Deno (Edge Function), i w Node (lokalny test).

import type { ScrapedJournalist } from "./types.ts";
import { mergeTopics } from "./topics.ts";

const HOST = "https://www.rmf24.pl";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Sekcje-ziarna, od ktorych startuje crawl (tam sa linki do artykulow).
export const DEFAULT_SECTIONS = ["fakty/polska", "fakty/swiat", "fakty/ekonomia"];

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

// Artykuly RMF24: /fakty/<sekcja>/news-...,nIdn,<id> lub /regiony/<miasto>/...
// Linki bywaja relatywne i absolutne, czesto ze smieciowym ?utm_... - bierzemy
// sam path i absolutyzujemy.
function extractArticleUrls(html: string): string[] {
  const re =
    /href="(?:https:\/\/www\.rmf24\.pl)?(\/(?:fakty|regiony)\/[a-z-]+\/news-[a-z0-9-]+,nId[a-z]*,\d+)/g;
  return [...new Set([...html.matchAll(re)].map((m) => `${HOST}${m[1]}`))];
}

// Referencje do profili autorow (byline + JSON-LD): /autor/<id>,<slug>.
// Klucz autora to "<id>,<slug>" - dokladnie segment sciezki URL profilu.
function extractAuthorRefs(html: string): string[] {
  const re = /\/autor\/(\d+),([a-z0-9-]+)/g;
  return [...new Set([...html.matchAll(re)].map((m) => `${m[1]},${m[2]}`))];
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#34;|&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

// Sekcja RMF -> klucz slownika sekcji w topics.ts. "regiony" mapujemy na
// samorzadowy kontekst przez slowo-klucz w tekscie, nie przez sekcje.
const SECTION_ALIAS: Record<string, string> = {
  polska: "kraj",
  ekonomia: "gospodarka",
};

function sectionOf(url: string): string | null {
  const m = url.match(/rmf24\.pl\/fakty\/([a-z-]+)\//);
  if (!m) return null;
  return SECTION_ALIAS[m[1]] ?? m[1];
}

// Zbiorowi "autorzy" (redakcja, agencja) to nie sa dziennikarze do bazy.
function isCollective(name: string): boolean {
  return /^(dziennikarze|redakcja|zesp[oó][łl]|agencja|materia[łl])\b/i.test(name);
}

function deburrLatin(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

// bylineArticleUrls: artykuly, w ktorych znaleziono byline autora (dowod
// autorstwa); lista artykulow na samym profilu to wspolny sidebar serwisu.
export function parseAuthorPage(
  ref: string,
  url: string,
  html: string,
  bylineArticleUrls: string[] = [],
): ScrapedJournalist | null {
  const fullName = firstMatch(
    html,
    /<h1[^>]*author-profile__name[^>]*>([\s\S]{1,120}?)<\/h1>/,
  );
  if (!fullName) return null;
  const name = stripTags(fullName);
  if (!name || name.split(/\s+/).length < 2 || isCollective(name)) return null;

  // Bio z dedykowanego diva profilu (bywa puste - wtedy null). Meta
  // description jest generyczne dla calego serwisu, wiec go nie uzywamy.
  const bioRaw = firstMatch(
    html,
    /author-profile__description[^>]*>([\s\S]{0,1200}?)<\/div>/,
  );
  const bioText = bioRaw ? stripTags(decodeEntities(bioRaw)) : "";
  const bio = bioText.length > 0 ? bioText : null;

  // Mail: WYLACZNIE adres osobisty, czyli mailto z nazwiskiem autora w czesci
  // lokalnej -> 'public'. Adresy dzialowe (fakty@rmf.fm, staz@rmf24.pl)
  // powtarzaja sie na kazdej stronie i nie sa danymi osoby. Wzorca NIE
  // generujemy: brak opublikowanego adresu osobistego = brak potwierdzenia.
  const last = deburrLatin(name.split(/\s+/).pop() ?? "");
  let email: string | null = null;
  let emailStatus: ScrapedJournalist["emailStatus"] = "none";
  const mails = [...html.matchAll(/mailto:([A-Za-z0-9._%+-]+@[a-z0-9.-]+)/gi)]
    .map((m) => m[1].toLowerCase());
  const personal = mails.find((m) =>
    last.length >= 4 && deburrLatin(m.split("@")[0]).includes(last)
  );
  if (personal) {
    email = personal;
    emailStatus = "public";
  }

  // X/Twitter: tylko handle pasujacy do nazwiska autora; serwisowe (RMF24pl)
  // powtarzaja sie wszedzie, wiec sa szumem.
  const socials: Record<string, string> = {};
  const nameKey = deburrLatin(name).replace(/[^a-z]/g, "");
  const xHandles = [...html.matchAll(/https?:\/\/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/g)]
    .map((m) => m[1])
    .filter((h) => !/^(intent|share)$/i.test(h));
  const own = xHandles.find((h) => {
    const hk = deburrLatin(h).replace(/[^a-z]/g, "");
    return last.length >= 4 && hk.includes(last) && !/^rmf/.test(hk) ||
      hk === nameKey;
  });
  if (own) socials.x = `https://x.com/${own}`;

  // Rola z watermarku profilu (<div id="background">DZIENNIKARZ</div>).
  const roleRaw = firstMatch(html, /<div id="background">([^<]{3,40})<\/div>/);
  const role = roleRaw ? stripTags(roleRaw).toLowerCase() : null;

  // Tematy: sekcje artykulow z bylines + slowa-klucze z bio.
  const sections = bylineArticleUrls
    .map(sectionOf)
    .filter((s): s is string => Boolean(s));
  const topics = mergeTopics(sections, `${name}. ${bio ?? ""}`);

  return {
    fullName: name,
    outletAuthorSlug: ref,
    authorUrl: url,
    role,
    email,
    emailStatus,
    bio,
    topics,
    socials,
    sourceUrls: [url, ...bylineArticleUrls.slice(0, 3)],
    articleUrls: bylineArticleUrls.slice(0, 30),
  };
}

export interface CrawlOptions {
  sections?: string[];
  maxAuthors?: number;
  delayMs?: number;
  // Wstrzykiwalny fetcher ulatwia test bez sieci; domyslnie prawdziwy fetch.
  fetcher?: (url: string) => Promise<string | null>;
  onProgress?: (msg: string) => void;
}

// Pelny przebieg: sekcje -> artykuly -> bylines (autor + jego artykuly)
// -> profile. Artykuly autora pochodza z bylines, nie ze strony profilu.
export async function crawlRmf(opts: CrawlOptions = {}): Promise<ScrapedJournalist[]> {
  const sections = opts.sections ?? DEFAULT_SECTIONS;
  const maxAuthors = opts.maxAuthors ?? 60;
  const delayMs = opts.delayMs ?? 400;
  const get = opts.fetcher ?? fetchText;
  const log = opts.onProgress ?? (() => {});

  // 1. Zbierz artykuly z sekcji-ziaren.
  const articleUrls = new Set<string>();
  for (const section of sections) {
    const html = await get(`${HOST}/${section}`);
    if (!html) continue;
    for (const u of extractArticleUrls(html)) articleUrls.add(u);
    await sleep(delayMs);
  }
  log(`artykuly-ziarna: ${articleUrls.size}`);

  // 2. Z artykulow wyluskaj autorow; zapamietaj, ktory artykul byl czyj.
  const byAuthor = new Map<string, string[]>();
  for (const url of articleUrls) {
    if (byAuthor.size >= maxAuthors) break;
    const html = await get(url);
    if (!html) continue;
    for (const ref of extractAuthorRefs(html)) {
      const list = byAuthor.get(ref) ?? [];
      if (!list.includes(url)) list.push(url);
      byAuthor.set(ref, list);
    }
    await sleep(delayMs);
  }
  log(`autorzy z bylines: ${byAuthor.size}`);

  // 3. Sparsuj profile autorow.
  const out: ScrapedJournalist[] = [];
  for (const [ref, articles] of byAuthor) {
    if (out.length >= maxAuthors) break;
    const url = `${HOST}/autor/${ref}`;
    const html = await get(url);
    if (!html) continue;
    const parsed = parseAuthorPage(ref, url, html, articles);
    if (parsed) out.push(parsed);
    await sleep(delayMs);
  }
  log(`profile sparsowane: ${out.length}`);
  return out;
}
