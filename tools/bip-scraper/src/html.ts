// Ekstrakcja linkow ze stron HTML i klasyfikacja: dokument czy podstrona.

import { config } from "./config.ts";
import { decodeEntities } from "./xml.ts";

export interface ExtractedLink {
  url: string;
  text: string;
  kind: "document" | "page";
}

/**
 * Sciezki, ktorych nie ma sensu chodzic: kalendarze, sortowania, wyszukiwarki,
 * oraz duplikujace tresc endpointy platform SSDIP/naszbip (widok wydruku,
 * historia wersji, podglad metadanych). UWAGA: /articles/pdf/ NIE jest tu,
 * bo to realny plik PDF artykulu, nie szum.
 */
const NOISE_PATTERNS =
  /(\?|&)(sort|order|page=[0-9]{3,}|data(_od|_do)?=|kalendarz|search|szukaj|print(=|able)|filtr)|\/(articles\/prnt|versions\/index|metadatas\/view|instrukcja-obslugi)\//i;

/** Sygnaly, ze link prowadzi do pliku mimo braku rozszerzenia w sciezce. */
const DOWNLOAD_HINTS =
  /(download|pobierz|attachment|zalacznik|za%C5%82%C4%85cznik|getfile|plik(i)?\/|fileid|file_id|,plik,)/i;

export function extractLinks(html: string, baseUrl: string): ExtractedLink[] {
  const out: ExtractedLink[] = [];
  const seen = new Set<string>();
  const anchorRe = /<a\s[^>]*href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null) {
    const rawHref = decodeEntities(match[2] ?? match[3] ?? "").trim();
    if (!rawHref || rawHref.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(rawHref)) {
      continue;
    }
    // Nieodrenderowane szablony JS w hrefach ({[{result.url}]} itp.).
    if (/[{}]|%7b|%7d/i.test(rawHref)) continue;

    let resolved: URL;
    try {
      resolved = new URL(rawHref, baseUrl);
    } catch {
      continue;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
    // Zlepki typu /sekcja/https://... to zepsute linki CMS; serwery czesto
    // odpowiadaja na nie 200 (miekki 404), wiec marnowalyby budzet stron.
    if (/https?:\/{1,2}/i.test(resolved.pathname.slice(1))) continue;
    resolved.hash = "";
    const url = resolved.toString();
    if (seen.has(url)) continue;
    seen.add(url);

    const text = decodeEntities(match[4].replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);

    const isDoc =
      config.docExtensions.test(resolved.pathname) ||
      DOWNLOAD_HINTS.test(resolved.pathname + resolved.search);

    out.push({ url, text, kind: isDoc ? "document" : "page" });
  }
  return out;
}

/**
 * Czy URL miesci sie w zakresie podmiotu: ten sam host oraz sciezka pod
 * prefiksem podmiotu. Prefiks jest istotny dla BIP-ow bedacych podstrona
 * wspolnego serwisu (np. bip.gdansk.pl/gdanski-zarzad-zieleni/).
 */
export function inScope(url: string, host: string, pathPrefix: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.hostname.replace(/^www\./i, "") !== host.replace(/^www\./i, "")) return false;
  if (pathPrefix && pathPrefix !== "/") {
    if (!u.pathname.startsWith(pathPrefix)) return false;
  }
  return true;
}

export function isNoise(url: string): boolean {
  return NOISE_PATTERNS.test(url);
}
