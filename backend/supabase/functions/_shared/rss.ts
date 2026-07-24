// Wspolne narzedzia do czytania feedow RSS.
//
// Parsowanie jest swiadomie regexowe, bez zaleznosci na parser DOM: struktura
// RSS jest plaska, a kazda pozycja bez wymaganych pol jest po prostu pomijana.
// Deno w Edge Functions nie ma wbudowanego DOMParser, a dociaganie deno_dom
// tylko po to, zeby wyciagnac szesc pol, jest nieproporcjonalne.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, code) => String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name) => {
      const replacement = NAMED_ENTITIES[String(name).toLowerCase()];
      return replacement ?? match;
    });
}

function stripCdata(value: string): string {
  const match = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return match ? match[1] : value;
}

/** Bloki `<item>` feedu, w kolejnosci wystepowania. */
export function itemBlocks(xml: string): string[] {
  return xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
}

/**
 * Zawartosc pierwszego wystapienia znacznika, bez CDATA i encji.
 * Nazwa znacznika moze zawierac przestrzen nazw, np. "News:Source".
 */
export function tagValue(block: string, tag: string): string | null {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"),
  );
  if (!match) return null;
  const value = decodeEntities(stripCdata(match[1])).trim();
  return value.length > 0 ? value : null;
}

export function attributeValue(
  block: string,
  tag: string,
  attr: string,
): string | null {
  const match = block.match(
    new RegExp(`<${tag}\\s[^>]*${attr}=["']([^"']*)["']`, "i"),
  );
  return match ? decodeEntities(match[1]).trim() || null : null;
}

/** RFC 822 z feedu na ISO 8601. Null, gdy daty nie da sie sparsowac. */
export function toIsoDate(pubDate: string | null): string | null {
  if (!pubDate) return null;
  const parsed = new Date(pubDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Twardy limit dlugosci zajawki. Pelna tresc i tak jest pod linkiem. */
const SNIPPET_MAX = 400;

/**
 * Zajawka z pola `description`, bez znacznikow HTML.
 *
 * Zwraca null, gdy tekst zaczyna sie od tytulu: niektore feedy (Google News)
 * wklejaja tam ten sam tytul, a lepszy brak zajawki niz ta sama linijka
 * dwa razy pod soba.
 */
export function toSnippet(
  description: string | null,
  title: string,
): string | null {
  if (!description) return null;
  const text = decodeEntities(description.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  if (text.length === 0) return null;
  if (text.toLowerCase().startsWith(title.replace(/\s+/g, " ").trim().toLowerCase())) {
    return null;
  }

  return text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX)}...` : text;
}

/** Nazwa hosta bez `www.`, jako zapasowa nazwa zrodla. */
export function hostLabel(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}
