// Adapter Onet Wiadomosci: strony autorow -> ScrapedJournalist[].
//
// Ustalenia z rekonesansu (2026-07-25, zwykly User-Agent przegladarki):
//   - robots.txt pozwala na /autorzy/ (blokuje tylko boty AI po nazwie UA
//     oraz sciezki typu /szukaj, /paywall; my chodzimy po /autorzy i sekcjach),
//   - profil autora: https://wiadomosci.onet.pl/autorzy/<slug>,
//   - byline w artykule linkuje do profilu: <a href=".../autorzy/<slug>">Imie Nazwisko</a>,
//   - profil zawiera: H1 = pelne imie, meta description = bio z tematami,
//     JAWNY mail ("Chcesz porozmawiac z autorem? Napisz: imie.nazwisko@redakcjaonet.pl"),
//     link do X, oraz liste ostatnich artykulow (sekcja w URL = temat).
//
// Poniewaz Onet publikuje mail sam, status maila to 'public', nie 'pattern'.
// Modul jest czysty (tylko fetch + regex), zeby dzialal i w Deno (Edge Function),
// i w Node (lokalny test). Zero importow zewnetrznych.

import type { ScrapedJournalist } from "./types.ts";
import { mergeTopics } from "./topics.ts";

const HOST = "https://wiadomosci.onet.pl";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Sekcje-ziarna, od ktorych startuje crawl (tam sa bylines dziennikarzy).
export const DEFAULT_SECTIONS = ["kraj", "swiat", "gospodarka"];

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

// Linki do artykulow Onetu maja postac .../<sekcja>/<slug>/<id[5-8 znakow]>.
function extractArticleUrls(html: string): string[] {
  const re = /href="(https:\/\/wiadomosci\.onet\.pl\/[a-z0-9-]+\/[^"\/]+\/[a-z0-9]{5,8})"/g;
  return [...new Set([...html.matchAll(re)].map((m) => m[1]))];
}

// Profil autora linkowany z byline: /autorzy/<slug>.
function extractAuthorSlugs(html: string): string[] {
  const re = /href="https:\/\/wiadomosci\.onet\.pl\/autorzy\/([a-z0-9-]+)"/g;
  return [...new Set([...html.matchAll(re)].map((m) => m[1]))];
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Onet koduje cudzyslowy i apostrofy jako encje numeryczne w meta description.
function decodeEntities(s: string): string {
  return s
    .replace(/&#34;|&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

// Sekcja z URL artykulu (drugi segment sciezki), do mapowania na temat.
function sectionOf(url: string): string | null {
  const m = url.match(/onet\.pl\/([a-z0-9-]+)\//);
  return m ? m[1] : null;
}

// Domena maili redakcyjnych Onetu (potwierdzone na publicznym adresie autora).
const ONET_MAIL_DOMAIN = "redakcjaonet.pl";

// Zbiorowi "autorzy" (redakcja, agencja, syndykacja) to nie sa dziennikarze
// do bazy kontaktowej. Odrzucamy po prefiksie nazwy.
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
  slug: string,
  url: string,
  html: string,
): ScrapedJournalist | null {
  const fullName = firstMatch(html, /<h1[^>]*>([\s\S]{1,120}?)<\/h1>/);
  if (!fullName) return null;
  const name = stripTags(fullName);
  // Realne nazwisko to co najmniej dwa czlony; odrzucamy zbiorowych i smieci.
  if (!name || name.split(/\s+/).length < 2 || isCollective(name)) return null;

  // Odrozniamy realny profil od zaslepki. Autorzy syndykowani (Politico, WELT,
  // Moscow Times, przedruki) NIE maja wlasnego bio, tylko generyczny tytul
  // strony "Wiadomosci w Onet ...". Etatowcy i stali wspolpracownicy maja
  // spersonalizowane bio ("Przez 14 lat dziennikarz Rzeczpospolitej..."). Ten
  // sygnal decyduje, komu wolno wygenerowac wzorzec maila.
  const bioRaw = firstMatch(
    html,
    /<meta[^>]+name="description"[^>]*content="([^"]*)"/i,
  );
  const isPlaceholderBio = !bioRaw || /^Wiadomo[sś]ci w Onet/i.test(bioRaw.trim());
  const bio = isPlaceholderBio ? null : decodeEntities(bioRaw!.trim());
  const hasRealProfile = !isPlaceholderBio;

  // Mail. Pierwszenstwo: adres opublikowany wprost (mailto) -> 'public'.
  // Gdy go brak, ale autor ma realny profil (etat/staly wspolpracownik),
  // generujemy wzorzec ze sluga (slug z kropka = potwierdzony schemat, patrz
  // piotr-halicki -> piotr.halicki) i oznaczamy 'pattern' (NIEZWERYFIKOWANY).
  // Dla zaslepek syndykacyjnych maila NIE zgadujemy: to byloby zmyslanie danych.
  const publicMail = firstMatch(
    html,
    new RegExp(`mailto:([a-z0-9._%+-]+@${ONET_MAIL_DOMAIN})`, "i"),
  );
  let email: string | null = null;
  let emailStatus: ScrapedJournalist["emailStatus"] = "none";
  if (publicMail) {
    email = publicMail.toLowerCase();
    emailStatus = "public";
  } else if (hasRealProfile && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(slug)) {
    email = `${slug.replace(/-/g, ".")}@${ONET_MAIL_DOMAIN}`;
    emailStatus = "pattern";
  }

  // X/Twitter: przyjmujemy WYLACZNIE handle pasujacy do nazwiska autora.
  // Handle ogolnoserwisowe (OnetWiadomosci, redaktor naczelny w widgecie)
  // powtarzaja sie na kazdej stronie, wiec bez dopasowania do nazwiska sa szumem.
  const socials: Record<string, string> = {};
  const nameKey = deburrLatin(name).replace(/[^a-z]/g, "");
  const last = deburrLatin(name.split(/\s+/).pop() ?? "");
  const xHandles = [...html.matchAll(/https?:\/\/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/g)]
    .map((m) => m[1])
    .filter((h) => !/^(intent|share)$/i.test(h));
  const own = xHandles.find((h) => {
    const hk = deburrLatin(h).replace(/[^a-z]/g, "");
    return last.length >= 4 && hk.includes(last) && !/^onet/.test(hk) || hk === nameKey;
  });
  if (own) socials.x = `https://x.com/${own}`;

  // Rola: Onet trzyma jobTitle w JSON-LD; jak brak, zostaje null.
  const role = firstMatch(html, /"jobTitle"\s*:\s*"([^"]+)"/);

  // Tematy: sekcje ostatnich artykulow autora + slowa-klucze z bio.
  const articleUrls = extractArticleUrls(html).filter((u) =>
    /\/[a-z0-9]{5,8}$/.test(u)
  );
  const sections = articleUrls.map(sectionOf).filter((s): s is string => Boolean(s));
  const topics = mergeTopics(sections, `${name}. ${bio ?? ""}`);

  return {
    fullName: name,
    outletAuthorSlug: slug,
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

// Pelny przebieg: sekcje -> artykuly -> sluggi autorow -> profile.
export async function crawlOnet(opts: CrawlOptions = {}): Promise<ScrapedJournalist[]> {
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

  // 2. Z artykulow wyluskaj sluggi autorow (byline linkuje do profilu).
  const slugs = new Set<string>();
  for (const url of articleUrls) {
    if (slugs.size >= maxAuthors) break;
    const html = await get(url);
    if (!html) continue;
    for (const s of extractAuthorSlugs(html)) slugs.add(s);
    await sleep(delayMs);
  }
  log(`sluggi autorow: ${slugs.size}`);

  // 3. Sparsuj profile autorow.
  const out: ScrapedJournalist[] = [];
  for (const slug of slugs) {
    if (out.length >= maxAuthors) break;
    const url = `${HOST}/autorzy/${slug}`;
    const html = await get(url);
    if (!html) continue;
    const parsed = parseAuthorPage(slug, url, html);
    if (parsed) out.push(parsed);
    await sleep(delayMs);
  }
  log(`profile sparsowane: ${out.length}`);
  return out;
}
