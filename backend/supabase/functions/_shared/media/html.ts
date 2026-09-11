/**
 * Wspólne narzędzia adapterów mediów.
 *
 * Pięć adapterów (onet, wp, rmf24, tvn24, polsatnews) trzymało własne,
 * bajtowo identyczne kopie tych funkcji oraz stałej UA. Tutaj są raz.
 *
 * Świadomie NIE ma tu `decodeEntities`, `stripTags` ani `extractArticleUrls`,
 * choć też się powtarzają. One naprawdę różnią się między serwisami:
 *
 * - `extractArticleUrls` czyta inny układ linków na każdej stronie;
 * - `decodeEntities` w tvn24 i polsatnews rozkodowuje dodatkowo sekwencje
 *   \uXXXX, bo te dwa adaptery czytają JSON-LD, a nie goły HTML;
 * - `stripTags` w rmf24 zamienia znacznik na spację, a w onet i wp na pustkę.
 *
 * Ta ostatnia różnica jest podejrzana (przy układzie <span>Jan</span>
 * <span>Kowalski</span> onet sklei nazwisko w "JanKowalski"), ale obie wersje
 * zbierają dziś poprawne dane z żywych stron i nie mam jak tego sprawdzić
 * inaczej niż na produkcji. Ujednolicenie ich to osobna robota z ponownym
 * przejściem po serwisach, nie sprzątanie przy okazji.
 */

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function fetchText(url: string): Promise<string | null> {
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

export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

export function deburrLatin(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

export function isCollective(name: string): boolean {
  return /^(dziennikarze|redakcja|zesp[oó][łl]|agencja|materia[łl])\b/i.test(name);
}
