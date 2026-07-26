// Regexowe czytanie prostego XML/HTML, ten sam duch co backend/_shared/rss.ts:
// struktury sa plaskie, a pelny parser DOM to nieproporcjonalna zaleznosc.

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
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const replacement = NAMED_ENTITIES[String(name).toLowerCase()];
      return replacement ?? match;
    });
}

function stripCdata(value: string): string {
  const match = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return match ? match[1] : value;
}

/** Wszystkie bloki danego znacznika, w kolejnosci wystepowania. */
export function blocks(xml: string, tag: string): string[] {
  return xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, "gi")) ?? [];
}

/** Zawartosc pierwszego wystapienia znacznika, bez CDATA i encji. */
export function tagValue(block: string, tag: string): string | null {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"),
  );
  if (!match) return null;
  const value = decodeEntities(stripCdata(match[1])).trim();
  return value.length > 0 ? value : null;
}
