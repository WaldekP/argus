// Adapter WP Wiadomosci (wiadomosci.wp.pl): strony autorow -> ScrapedJournalist[].
//
// Ustalenia z rekonesansu (2026-07-27, zwykly User-Agent przegladarki):
//   - robots.txt (User-agent: *) nie blokuje /autor/ ani stron sekcji; blokuje
//     tylko sciezki techniczne (/api/, /szukaj, /graphql...) oraz boty AI po
//     nazwie UA (GPTBot, CCBot) - my chodzimy zwyklym UA przegladarki,
//   - profil autora: https://wiadomosci.wp.pl/autor/<slug>/<id> (id numeryczne),
//   - byline w artykule linkuje do profilu na dwa sposoby: relatywny
//     href="/autor/<slug>/<id>" oraz absolutny URL w JSON-LD ("author" ->
//     "url"), tam tez jest "jobTitle" (np. "Dziennikarz Wiadomosci WP"),
//   - profil zawiera: JEDYNY H1 (class="listing-description-title") = pelne
//     imie i nazwisko, meta description = spersonalizowane bio, JAWNY mail
//     (mailto:imie.nazwisko@grupawp.pl - potwierdzone na dwoch profilach:
//     michal.wroblewski@grupawp.pl, Paulina.Ciesielska@grupawp.pl),
//     czasem link do X autora, oraz liste artykulow autora (server-side),
//   - URL artykulu jest plaski (bez segmentu sekcji): /<slug>-<id><litera>,
//     gdzie litera 'a' = artykul, 'v' = wideo, 'k' = strona kategorii;
//     tematy bierzemy wiec z bio + roli, nie z sekcji URL,
//   - strony sekcji (/polityka, /swiat, /spoleczenstwo) odpowiadaja 301 na
//     kanoniczny URL kategorii (...-<id>k) - fetch z redirect: "follow".
//
// Mail opublikowany wprost (mailto) = status 'public'. Gdy brak mailto, a
// profil ma realne bio, generujemy wzorzec ze sluga (schemat imie.nazwisko@
// grupawp.pl potwierdzony na opublikowanych adresach) ze statusem 'pattern'
// (NIEZWERYFIKOWANY). Modul jest czysty (tylko fetch + regex), zeby dzialal
// i w Deno (Edge Function), i w Node (lokalny test). Zero importow zewnetrznych.

import type { ScrapedJournalist } from "./types.ts";
import { mergeTopics } from "./topics.ts";

const HOST = "https://wiadomosci.wp.pl";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Sekcje-ziarna, od ktorych startuje crawl (tam sa linki do artykulow).
export const DEFAULT_SECTIONS = ["polityka", "swiat", "spoleczenstwo"];

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

// Artykuly WP: /<slug>-<id>a (sufiks 'a'); 'v' (wideo) i 'k' (kategorie) odpadaja.
function extractArticleUrls(html: string): string[] {
  const re = /href="(https:\/\/wiadomosci\.wp\.pl\/[a-z0-9-]{5,}-\d{12,}a)"/g;
  return [...new Set([...html.matchAll(re)].map((m) => m[1]))];
}

// Referencje do profili autorow: relatywny href z byline i absolutny URL
// z JSON-LD. Klucz autora to "<slug>/<id>", bo URL profilu wymaga obu czesci.
function extractAuthorRefs(html: string): string[] {
  const re = /(?:https:\/\/wiadomosci\.wp\.pl)?\/autor\/([a-z0-9-]+)\/(\d{6,})/g;
  return [...new Set([...html.matchAll(re)].map((m) => `${m[1]}/${m[2]}`))];
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// WP koduje encje podwojnie (np. "&amp;nbsp;" w meta description), wiec
// najpierw &amp; -> &, potem reszta.
function decodeEntities(s: string): string {
  return s
    .replace(/&#34;|&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

// Domena maili redakcyjnych WP (potwierdzona na publicznych adresach autorow).
const WP_MAIL_DOMAIN = "grupawp.pl";

// Zbiorowi "autorzy" (redakcja, agencja, materialy prasowe) odpadaja.
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

export function parseAuthorPage(
  slugId: string,
  url: string,
  html: string,
): ScrapedJournalist | null {
  // Jedyny H1 profilu (class="listing-description-title") = imie i nazwisko.
  const fullName = firstMatch(
    html,
    /<h1[^>]*listing-description-title[^>]*>([\s\S]{1,120}?)<\/h1>/,
  );
  if (!fullName) return null;
  const name = stripTags(fullName);
  if (!name || name.split(/\s+/).length < 2 || isCollective(name)) return null;

  // Bio z meta description. Zaslepki bez bio maja generyczny opis serwisu
  // ("Najnowsze wiadomosci..."), realne profile - spersonalizowany zyciorys.
  const bioRaw = firstMatch(
    html,
    /<meta[^>]+name="description"[^>]*content="([^"]*)"/i,
  );
  const isPlaceholderBio = !bioRaw ||
    /^(Najnowsze|Wiadomo[sś]ci|Wszystko o)/i.test(bioRaw.trim());
  const bio = isPlaceholderBio ? null : decodeEntities(bioRaw!.trim());
  const hasRealProfile = !isPlaceholderBio;

  // Mail. Pierwszenstwo: adres opublikowany wprost (mailto) -> 'public'
  // (WP pisze go czasem z wielkich liter, normalizujemy do lowercase).
  // Gdy brak mailto, a profil realny, wzorzec ze sluga -> 'pattern'
  // (NIEZWERYFIKOWANY; schemat potwierdzony na opublikowanych adresach).
  const slugName = slugId.split("/")[0];
  const publicMail = firstMatch(
    html,
    new RegExp(`mailto:([A-Za-z0-9._%+-]+@${WP_MAIL_DOMAIN})`, "i"),
  );
  let email: string | null = null;
  let emailStatus: ScrapedJournalist["emailStatus"] = "none";
  if (publicMail) {
    email = publicMail.toLowerCase();
    emailStatus = "public";
  } else if (hasRealProfile && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(slugName)) {
    email = `${slugName.replace(/-/g, ".")}@${WP_MAIL_DOMAIN}`;
    emailStatus = "pattern";
  }

  // X/Twitter: tylko handle pasujacy do nazwiska autora. Handle serwisowe
  // (wirtualnapolska) powtarzaja sie na kazdej stronie, wiec sa szumem.
  const socials: Record<string, string> = {};
  const nameKey = deburrLatin(name).replace(/[^a-z]/g, "");
  const last = deburrLatin(name.split(/\s+/).pop() ?? "");
  const xHandles = [...html.matchAll(/https?:\/\/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/g)]
    .map((m) => m[1])
    .filter((h) => !/^(intent|share)$/i.test(h));
  const own = xHandles.find((h) => {
    const hk = deburrLatin(h).replace(/[^a-z]/g, "");
    return last.length >= 4 && hk.includes(last) && !/wirtualnapolska/.test(hk) ||
      hk === nameKey;
  });
  if (own) socials.x = `https://x.com/${own}`;

  // Rola z JSON-LD profilu (np. "Dziennikarz Wiadomosci WP").
  const role = firstMatch(html, /"jobTitle"\s*:\s*"([^"]+)"/);

  // Lista artykulow autora renderowana server-side na profilu. URL WP nie ma
  // segmentu sekcji, wiec tematy pochodza z bio i roli, nie z URL-i.
  const articleUrls = extractArticleUrls(html);
  const topics = mergeTopics([], `${name}. ${role ?? ""}. ${bio ?? ""}`);

  return {
    fullName: name,
    outletAuthorSlug: slugId,
    authorUrl: url,
    role: role ? stripTags(role) : null,
    email,
    emailStatus,
    bio,
    topics,
    socials,
    sourceUrls: [url],
    articleUrls: articleUrls.slice(0, 30),
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

// Pelny przebieg: sekcje -> artykuly -> referencje autorow -> profile.
export async function crawlWp(opts: CrawlOptions = {}): Promise<ScrapedJournalist[]> {
  const sections = opts.sections ?? DEFAULT_SECTIONS;
  const maxAuthors = opts.maxAuthors ?? 60;
  const delayMs = opts.delayMs ?? 400;
  const get = opts.fetcher ?? fetchText;
  const log = opts.onProgress ?? (() => {});

  // 1. Zbierz artykuly z sekcji-ziaren (301 -> kanoniczny URL, follow).
  const articleUrls = new Set<string>();
  for (const section of sections) {
    const html = await get(`${HOST}/${section}`);
    if (!html) continue;
    for (const u of extractArticleUrls(html)) articleUrls.add(u);
    await sleep(delayMs);
  }
  log(`artykuly-ziarna: ${articleUrls.size}`);

  // 2. Z artykulow wyluskaj referencje autorow (byline + JSON-LD).
  const refs = new Set<string>();
  for (const url of articleUrls) {
    if (refs.size >= maxAuthors) break;
    const html = await get(url);
    if (!html) continue;
    for (const r of extractAuthorRefs(html)) refs.add(r);
    await sleep(delayMs);
  }
  log(`referencje autorow: ${refs.size}`);

  // 3. Sparsuj profile autorow.
  const out: ScrapedJournalist[] = [];
  for (const ref of refs) {
    if (out.length >= maxAuthors) break;
    const url = `${HOST}/autor/${ref}`;
    const html = await get(url);
    if (!html) continue;
    const parsed = parseAuthorPage(ref, url, html);
    if (parsed) out.push(parsed);
    await sleep(delayMs);
  }
  log(`profile sparsowane: ${out.length}`);
  return out;
}
