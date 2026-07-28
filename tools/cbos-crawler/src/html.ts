// Drobne narzedzia do tekstu z HTML: dekodowanie encji i czyszczenie
// niełamliwych spacji. Bez zewnetrznego parsera — listing CBOS ma stabilny,
// przewidywalny markup, wiec parsujemy regexem w parse-listing.ts.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  rdquo: "”",
  ldquo: "“",
  oacute: "ó",
  Oacute: "Ó",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED[name] ?? m);
}

function safeCodePoint(cp: number): string {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

/** Encje + niełamliwe spacje + zbite biale znaki do pojedynczej spacji. */
export function normalizeText(text: string): string {
  return decodeEntities(text).replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** Zdejmuje wszystkie znaczniki HTML, zostawia goly tekst. */
export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}
