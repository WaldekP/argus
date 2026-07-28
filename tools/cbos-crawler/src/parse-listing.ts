// Parser listingu komunikatow CBOS (publikacje.php).
//
// Markup jest stabilny i przewidywalny, wiec parsujemy regexem, bez ciezkiego
// parsera DOM. Kazdy wpis to <a ... raporty_tekst.php?id=N ...> owijajace:
//   <h2 id='N'>Komunikat z badań nr {num}/{year}</h2>
//   <h3 class='home_tytul_txt_all'>{tytul}</h3>
//   <p class='home_tekst_txt'><img ...>{streszczenie z procentami}</p>
// a atrybut aria-label niesie dodatkowo autora i date publikacji.
//
// Skupiamy sie WYLACZNIE na "Komunikat z badań" — bo tylko dla nich znamy
// numer/rok potrzebny do wyliczenia bezposredniego URL PDF (SPISKOM.POL).
// Inne typy (Opinie i Diagnozy, CBOS Flash, Fokus) maja inne sciezki plikow
// i sa poza zakresem v1.

import { normalizeText, stripTags } from "./html.ts";

export interface ParsedKomunikat {
  id: number;
  num: number;
  year: number;
  numer: string; // "79/2026"
  title: string;
  summary: string;
  author: string | null;
  pubDate: string | null; // YYYY-MM-DD
}

const ANCHOR_RE =
  /<a\s+href='[^']*raporty_tekst\.php\?id=(\d+)'[^>]*aria-label='([^']*)'[^>]*>([\s\S]*?)<\/a>/g;
const H2_RE = /<h2[^>]*>\s*Komunikat z bada[nń]\s+nr\s+(\d+)\s*\/\s*(\d{4})\s*<\/h2>/i;
const H3_RE = /<h3[^>]*>([\s\S]*?)<\/h3>/i;
const P_RE = /<p class='home_tekst_txt'[^>]*>([\s\S]*?)<\/p>/i;
const META_RE = /Autor:\s*(.+?)\s*-\s*data publikacji:\s*(\d{4}-\d{2}-\d{2})/i;

export function parseListing(html: string): ParsedKomunikat[] {
  const out: ParsedKomunikat[] = [];
  const seen = new Set<number>();

  for (const m of html.matchAll(ANCHOR_RE)) {
    const id = Number(m[1]);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    const ariaLabel = m[2];
    const inner = m[3];

    const h2 = inner.match(H2_RE);
    if (!h2) continue; // nie "Komunikat z badań" — pomijamy
    const num = Number(h2[1]);
    const year = Number(h2[2]);
    if (!Number.isFinite(num) || !Number.isFinite(year)) continue;

    const title = normalizeText(H3_RE.exec(inner)?.[1] ?? "");
    if (!title) continue;

    const rawSummary = P_RE.exec(inner)?.[1] ?? "";
    const summary = normalizeText(stripTags(rawSummary));

    const meta = META_RE.exec(normalizeText(ariaLabel));
    const author = meta ? meta[1].trim() : null;
    const pubDate = meta ? meta[2] : null;

    seen.add(id);
    out.push({ id, num, year, numer: `${num}/${year}`, title, summary, author, pubDate });
  }
  return out;
}

/** Wylicza bezposredni URL PDF komunikatu: /SPISKOM.POL/{year}/K_{NNN}_{RR}.PDF */
export function pdfUrlFor(baseUrl: string, pdfDir: string, num: number, year: number): string {
  const nnn = String(num).padStart(3, "0");
  const rr = String(year).slice(-2);
  return `${baseUrl}${pdfDir}/${year}/K_${nnn}_${rr}.PDF`;
}
