// Odcisk palca podmiotu: co serwuje jego strona BIP i jaka to platforma.
//
// Wynik steruje crawlem (sitemapa/RSS jako przyspieszacze) i buduje wiedze
// o rozkladzie CMS-ow, czyli o tym, ile parserow trzeba bedzie kiedys napisac.

import type { DatabaseSync } from "node:sqlite";
import { nowIso, logFetch } from "./db.ts";
import { fetchUrl, decodeHtml, isHtml } from "./fetcher.ts";
import { config } from "./config.ts";

/**
 * Znane rodziny platform BIP. Lista celowo krotka i oparta o twarde sygnaly;
 * wszystko inne dostaje 'unknown' z zachowanym surowym meta generator.
 */
function detectCms(host: string, html: string): { family: string; generator: string | null } {
  const generator =
    html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/i)?.[1] ??
    null;

  const h = host.toLowerCase();
  const body = html.toLowerCase();

  if (h.endsWith(".bip.gov.pl")) return { family: "ssdip", generator };
  if (h.endsWith(".naszbip.pl")) return { family: "naszbip", generator };
  if (h === "www.gov.pl" || h === "gov.pl") return { family: "govpl", generator };
  if (generator?.toLowerCase().includes("smodbip") || body.includes("smodbip")) {
    return { family: "smodbip", generator };
  }
  if (generator?.toLowerCase().includes("megabip") || body.includes("megabip")) {
    return { family: "megabip", generator };
  }
  if (generator?.toLowerCase().includes("wordpress")) return { family: "wordpress", generator };
  if (generator?.toLowerCase().includes("joomla")) return { family: "joomla", generator };
  if (generator?.toLowerCase().includes("drupal")) return { family: "drupal", generator };
  if (body.includes("e-bip.pl") || body.includes("ebip.pl")) return { family: "ebip", generator };
  if (body.includes("logonet")) return { family: "logonet", generator };
  if (body.includes("bip gdansk") || h.endsWith("bip.gdansk.pl")) {
    return { family: "gdansk-gcm", generator };
  }
  return { family: "unknown", generator };
}

/** Linki RSS zadeklarowane w <head> plus popularne sciezki. */
function findRssLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const linkRe =
    /<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[0].match(/href=["']([^"']+)/i)?.[1];
    if (!href) continue;
    try {
      out.add(new URL(href, baseUrl).toString());
    } catch {
      /* ignorujemy zepsute href */
    }
  }
  return [...out];
}

export async function runProbe(
  db: DatabaseSync,
  opts: { entityId?: number; force?: boolean },
): Promise<void> {
  const where = opts.entityId
    ? "WHERE e.id = ? AND e.url IS NOT NULL"
    : `WHERE e.url IS NOT NULL AND e.enabled = 1
       ${opts.force ? "" : "AND p.entity_id IS NULL"}`;
  const rows = db
    .prepare(
      `SELECT e.id, e.name, e.url, e.host FROM entities e
       LEFT JOIN probes p ON p.entity_id = e.id ${where} ORDER BY e.id`,
    )
    .all(...(opts.entityId ? [opts.entityId] : [])) as {
    id: number;
    name: string;
    url: string;
    host: string;
  }[];

  console.log(`Do zbadania: ${rows.length} podmiotow`);
  const upsert = db.prepare(`
    INSERT INTO probes (entity_id, probed_at, http_status, final_url, generator,
      cms_family, sitemap_url, rss_urls, robots, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(entity_id) DO UPDATE SET
      probed_at = excluded.probed_at, http_status = excluded.http_status,
      final_url = excluded.final_url, generator = excluded.generator,
      cms_family = excluded.cms_family, sitemap_url = excluded.sitemap_url,
      rss_urls = excluded.rss_urls, robots = excluded.robots, error = excluded.error
  `);

  let done = 0;
  for (const row of rows) {
    done++;
    const label = `[${done}/${rows.length}] ${row.name}`;
    try {
      const home = await fetchUrl(row.url, { maxBytes: 5 * 1024 * 1024 });
      logFetch(db, row.url, home.status, home.ms, home.body.length, "probe:home");

      let generator: string | null = null;
      let family = "unknown";
      let rss: string[] = [];
      if (isHtml(home.contentType)) {
        const html = decodeHtml(home.body, home.contentType);
        const cms = detectCms(new URL(home.finalUrl).hostname, html);
        generator = cms.generator;
        family = cms.family;
        rss = findRssLinks(html, home.finalUrl);
      }

      // robots.txt i sitemap.xml sprawdzamy na hoscie docelowym (po redirectach).
      const origin = new URL(home.finalUrl).origin;
      let robots: string | null = null;
      let sitemapUrl: string | null = null;
      try {
        const r = await fetchUrl(`${origin}/robots.txt`, { maxBytes: 256 * 1024 });
        if (r.status === 200 && !isHtml(r.contentType)) {
          robots = r.body.toString("utf8").slice(0, 20_000);
          sitemapUrl = robots.match(/^sitemap:\s*(\S+)/im)?.[1] ?? null;
        }
      } catch {
        /* brak robots.txt to nie blad */
      }
      if (!sitemapUrl) {
        try {
          const s = await fetchUrl(`${origin}/sitemap.xml`, { maxBytes: 1024 * 1024 });
          if (s.status === 200 && /<(urlset|sitemapindex)/i.test(s.body.subarray(0, 2048).toString("utf8"))) {
            sitemapUrl = `${origin}/sitemap.xml`;
          }
        } catch {
          /* brak sitemapy to norma w BIP */
        }
      }

      upsert.run(
        row.id, nowIso(), home.status, home.finalUrl, generator, family,
        sitemapUrl, JSON.stringify(rss), robots, null,
      );
      console.log(
        `${label}: HTTP ${home.status}, cms=${family}` +
          `${sitemapUrl ? ", sitemapa" : ""}${rss.length ? `, RSS x${rss.length}` : ""}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      upsert.run(row.id, nowIso(), null, null, null, null, null, "[]", null, msg);
      console.log(`${label}: BLAD ${msg}`);
    }
    await new Promise((r) => setTimeout(r, config.perHostDelayMs));
  }
}
