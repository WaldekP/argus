// Silnik crawla.
//
// Model wspolbieznosci: hosty rownolegle (limit hostConcurrency), w obrebie
// hosta zawsze szeregowo z odstepem. Kolejka i stan leza w SQLite, wiec
// Ctrl+C w dowolnym momencie jest bezpieczne, a ponowne uruchomienie
// kontynuuje od pierwszego pending.
//
// Kolejnosc per host: najpierw pending dokumenty, potem pending strony.
// Dokumenty sa celem crawla, wiec zabezpieczamy je zanim pojdziemy glebiej.

import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso, logFetch } from "./db.ts";
import { fetchUrl, decodeHtml, isHtml, TooBigError } from "./fetcher.ts";
import { extractLinks, inScope, isNoise } from "./html.ts";
import { parseRobots, robotsAllows, type RobotsRules } from "./robots.ts";
import { storeBlob } from "./blobstore.ts";
import { blocks, tagValue } from "./xml.ts";

interface EntityRow {
  id: number;
  name: string;
  url: string;
  host: string;
  path_prefix: string;
  final_url: string | null;
  sitemap_url: string | null;
  rss_urls: string | null;
  robots: string | null;
}

export interface CrawlOptions {
  entityId?: number;
  maxDepth?: number;
  maxPages?: number;
  delayMs?: number;
  includeOld?: boolean;
}

let stopRequested = false;

function log(msg: string): void {
  console.log(`${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function loadEntities(db: DatabaseSync, entityId?: number): EntityRow[] {
  const where = entityId ? "AND e.id = ?" : "";
  return db
    .prepare(
      `SELECT e.id, e.name, e.url, e.host, COALESCE(e.path_prefix, '/') AS path_prefix,
              p.final_url, p.sitemap_url, p.rss_urls, p.robots
       FROM entities e LEFT JOIN probes p ON p.entity_id = e.id
       WHERE e.enabled = 1 AND e.url IS NOT NULL AND e.host IS NOT NULL ${where}
       ORDER BY e.id`,
    )
    .all(...(entityId ? [entityId] : [])) as unknown as EntityRow[];
}

function pageCount(db: DatabaseSync, entityId: number): number {
  return (
    db.prepare("SELECT COUNT(*) AS c FROM pages WHERE entity_id = ?").get(entityId) as {
      c: number;
    }
  ).c;
}

function addPage(
  db: DatabaseSync,
  entity: EntityRow,
  url: string,
  depth: number,
  from: string | null,
  maxPages: number,
): void {
  if (pageCount(db, entity.id) >= maxPages) return;
  db.prepare(
    `INSERT OR IGNORE INTO pages (entity_id, url, depth, discovered_from) VALUES (?, ?, ?, ?)`,
  ).run(entity.id, url, depth, from);
}

function addDocument(
  db: DatabaseSync,
  entity: EntityRow,
  url: string,
  sourcePage: string,
  linkText: string,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO documents (entity_id, url, source_page, link_text, first_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(entity.id, url, sourcePage, linkText || null, nowIso());
}

/** Zasianie kolejki: strona glowna + sitemapa + RSS, jesli sa. */
async function seedEntity(db: DatabaseSync, entity: EntityRow, maxPages: number): Promise<void> {
  if (pageCount(db, entity.id) > 0) return; // juz zasiane, wznawiamy

  const startUrl = entity.final_url ?? entity.url;
  addPage(db, entity, startUrl, 0, null, maxPages);

  if (entity.sitemap_url) {
    try {
      const seeded = await seedFromSitemap(db, entity, entity.sitemap_url, maxPages);
      log(`  ${entity.name}: sitemapa dala ${seeded} adresow`);
    } catch (err) {
      log(`  ${entity.name}: sitemapa niedostepna (${err instanceof Error ? err.message : err})`);
    }
  }

  const rssUrls: string[] = entity.rss_urls ? JSON.parse(entity.rss_urls) : [];
  for (const rssUrl of rssUrls.slice(0, 3)) {
    try {
      const res = await fetchUrl(rssUrl, { maxBytes: 2 * 1024 * 1024 });
      logFetch(db, rssUrl, res.status, res.ms, res.body.length, "seed:rss");
      if (res.status !== 200) continue;
      const xml = res.body.toString("utf8");
      for (const item of blocks(xml, "item").concat(blocks(xml, "entry"))) {
        const link = tagValue(item, "link");
        if (link && inScope(link, entity.host, entity.path_prefix)) {
          addPage(db, entity, link, 1, rssUrl, maxPages);
        }
      }
    } catch {
      /* RSS to tylko przyspieszacz */
    }
  }
}

async function seedFromSitemap(
  db: DatabaseSync,
  entity: EntityRow,
  sitemapUrl: string,
  maxPages: number,
): Promise<number> {
  const res = await fetchUrl(sitemapUrl, { maxBytes: 10 * 1024 * 1024 });
  logFetch(db, sitemapUrl, res.status, res.ms, res.body.length, "seed:sitemap");
  if (res.status !== 200) return 0;
  const xml = res.body.toString("utf8");

  let seeded = 0;
  if (/<sitemapindex/i.test(xml)) {
    const subs = blocks(xml, "sitemap")
      .map((b) => tagValue(b, "loc"))
      .filter((loc): loc is string => !!loc)
      .slice(0, 10);
    for (const sub of subs) {
      seeded += await seedFromSitemap(db, entity, sub, maxPages);
      if (seeded >= config.maxSitemapUrls) break;
    }
    return seeded;
  }

  for (const block of blocks(xml, "url")) {
    const loc = tagValue(block, "loc");
    if (!loc || !inScope(loc, entity.host, entity.path_prefix)) continue;
    if (config.docExtensions.test(new URL(loc).pathname)) {
      addDocument(db, entity, loc, sitemapUrl, "");
    } else {
      addPage(db, entity, loc, 1, sitemapUrl, maxPages);
      seeded++;
    }
    if (seeded >= config.maxSitemapUrls) break;
  }
  return seeded;
}

/** Obrobka jednej strony HTML: linki na dokumenty i kolejne strony. */
async function processPage(
  db: DatabaseSync,
  entity: EntityRow,
  page: { id: number; url: string; depth: number },
  rules: RobotsRules | null,
  opts: Required<Pick<CrawlOptions, "maxDepth" | "maxPages">>,
): Promise<void> {
  const mark = db.prepare(
    `UPDATE pages SET status = ?, http_status = ?, content_type = ?, fetched_at = ?, error = ?
     WHERE id = ?`,
  );

  if (!robotsAllows(rules, page.url) || isNoise(page.url)) {
    mark.run("skipped", null, null, nowIso(), "robots/noise", page.id);
    return;
  }

  let res;
  try {
    res = await fetchUrl(page.url, { maxBytes: 10 * 1024 * 1024 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logFetch(db, page.url, null, 0, 0, `page:${msg}`);
    mark.run("error", null, null, nowIso(), msg.slice(0, 300), page.id);
    return;
  }
  logFetch(db, page.url, res.status, res.ms, res.body.length, "page");

  if (res.status !== 200) {
    mark.run("error", res.status, res.contentType, nowIso(), null, page.id);
    return;
  }

  // Strona okazala sie plikiem (np. link bez rozszerzenia): przekwalifikuj.
  if (!isHtml(res.contentType)) {
    addDocument(db, entity, page.url, page.url, "");
    mark.run("done", res.status, res.contentType, nowIso(), "przekwalifikowana na dokument", page.id);
    return;
  }

  const html = decodeHtml(res.body, res.contentType);
  const links = extractLinks(html, res.finalUrl);
  for (const link of links) {
    if (link.kind === "document") {
      // Dokumenty celowo BEZ filtra zakresu: zalaczniki notorycznie leza na
      // osobnych hostach (np. download.cloudgdansk.pl dla bip.gdansk.pl).
      // To pojedyncze GET-y, nie wchodzimy przez nie w crawl obcego serwisu.
      addDocument(db, entity, link.url, page.url, link.text);
    } else if (
      page.depth < opts.maxDepth &&
      inScope(link.url, entity.host, entity.path_prefix) &&
      !isNoise(link.url)
    ) {
      addPage(db, entity, link.url, page.depth + 1, page.url, opts.maxPages);
    }
  }
  mark.run("done", res.status, res.contentType, nowIso(), null, page.id);
}

/** Pobranie jednego dokumentu do archiwum. */
async function processDocument(
  db: DatabaseSync,
  doc: { id: number; url: string },
  rules: RobotsRules | null,
  includeOld: boolean,
): Promise<void> {
  const mark = db.prepare(
    `UPDATE documents SET status = ?, sha256 = ?, size = ?, mime = ?, blob_path = ?,
       last_modified = ?, fetched_at = ?, error = ? WHERE id = ?`,
  );

  if (!robotsAllows(rules, doc.url)) {
    mark.run("skipped_old", null, null, null, null, null, nowIso(), "robots", doc.id);
    return;
  }

  let res;
  try {
    res = await fetchUrl(doc.url);
  } catch (err) {
    if (err instanceof TooBigError) {
      logFetch(db, doc.url, null, 0, err.bytes, "doc:too-big");
      mark.run("skipped_big", null, err.bytes, null, null, null, nowIso(), null, doc.id);
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    logFetch(db, doc.url, null, 0, 0, `doc:${msg}`);
    mark.run("error", null, null, null, null, null, nowIso(), msg.slice(0, 300), doc.id);
    return;
  }
  logFetch(db, doc.url, res.status, res.ms, res.body.length, "doc");

  if (res.status !== 200) {
    mark.run("error", null, null, res.contentType, null, res.lastModified, nowIso(),
      `HTTP ${res.status}`, doc.id);
    return;
  }

  // HTML pod linkiem "download" to zwykle strona posrednia, nie plik.
  if (isHtml(res.contentType) && !config.docExtensions.test(new URL(doc.url).pathname)) {
    mark.run("skipped_html", null, res.body.length, res.contentType, null,
      res.lastModified, nowIso(), null, doc.id);
    return;
  }

  // Filtr wieku: metadane zostaja, pliku nie skladujemy.
  if (!includeOld && res.lastModified) {
    const lm = new Date(res.lastModified);
    const cutoff = Date.now() - config.maxAgeDays * 24 * 3600 * 1000;
    if (!Number.isNaN(lm.getTime()) && lm.getTime() < cutoff) {
      mark.run("skipped_old", null, res.body.length, res.contentType, null,
        res.lastModified, nowIso(), null, doc.id);
      return;
    }
  }

  const { hash, relPath } = storeBlob(res.body, doc.url, res.contentType);
  const existing = db
    .prepare("SELECT id FROM documents WHERE sha256 = ? AND id != ? AND status = 'stored'")
    .get(hash, doc.id) as { id: number } | undefined;

  mark.run(
    existing ? "duplicate" : "stored",
    hash, res.body.length, res.contentType, relPath, res.lastModified, nowIso(), null, doc.id,
  );
}

/** Worker jednego hosta: szeregowo, z odstepem, dokumenty przed stronami. */
async function crawlHost(
  db: DatabaseSync,
  host: string,
  entities: EntityRow[],
  opts: Required<CrawlOptions>,
): Promise<void> {
  const ids = entities.map((e) => e.id);
  const placeholders = ids.map(() => "?").join(",");
  const robotsText = entities.find((e) => e.robots)?.robots ?? null;
  const rules = robotsText ? parseRobots(robotsText) : null;
  const delay = Math.max(opts.delayMs, rules?.crawlDelayMs ?? 0);

  const nextDoc = db.prepare(
    `SELECT id, url, entity_id FROM documents
     WHERE status = 'pending' AND entity_id IN (${placeholders}) ORDER BY id LIMIT 1`,
  );
  const nextPage = db.prepare(
    `SELECT id, url, depth, entity_id FROM pages
     WHERE status = 'pending' AND entity_id IN (${placeholders})
     ORDER BY depth, id LIMIT 1`,
  );

  for (const entity of entities) {
    if (stopRequested) return;
    await seedEntity(db, entity, opts.maxPages);
  }

  let processed = 0;
  for (;;) {
    if (stopRequested) return;

    const doc = nextDoc.get(...ids) as { id: number; url: string; entity_id: number } | undefined;
    if (doc) {
      await processDocument(db, doc, rules, opts.includeOld);
    } else {
      const page = nextPage.get(...ids) as
        | { id: number; url: string; depth: number; entity_id: number }
        | undefined;
      if (!page) break; // host wyczerpany
      const entity = entities.find((e) => e.id === page.entity_id)!;
      await processPage(db, entity, page, rules, opts);
    }

    processed++;
    if (processed % 25 === 0) log(`${host}: przerobiono ${processed} pozycji`);
    await new Promise((r) => setTimeout(r, delay));
  }
  log(`${host}: zakonczony (${processed} pozycji)`);
}

export async function runCrawl(db: DatabaseSync, options: CrawlOptions): Promise<void> {
  const opts: Required<CrawlOptions> = {
    entityId: options.entityId ?? 0,
    maxDepth: options.maxDepth ?? config.maxDepth,
    maxPages: options.maxPages ?? config.maxPagesPerEntity,
    delayMs: options.delayMs ?? config.perHostDelayMs,
    includeOld: options.includeOld ?? false,
  };

  const entities = loadEntities(db, options.entityId);
  if (entities.length === 0) {
    console.log("Brak podmiotow do crawla. Najpierw: registry, potem probe.");
    return;
  }

  const byHost = new Map<string, EntityRow[]>();
  for (const e of entities) {
    // Zakres liczymy po hoscie docelowym z probe (redirecty!), inaczej
    // crawl konczylby sie na pierwszym URL.
    const host = e.final_url ? new URL(e.final_url).hostname : e.host;
    const scoped = { ...e, host };
    byHost.set(host, [...(byHost.get(host) ?? []), scoped]);
  }
  log(`Crawl: ${entities.length} podmiotow na ${byHost.size} hostach, ` +
    `delay ${opts.delayMs} ms, max ${opts.maxPages} stron/podmiot, glebokosc ${opts.maxDepth}`);

  process.on("SIGINT", () => {
    if (stopRequested) process.exit(1);
    stopRequested = true;
    log("Zatrzymywanie... (drugi Ctrl+C przerywa natychmiast; stan jest w bazie)");
  });

  // Pula: hostConcurrency hostow naraz, kazdy host szeregowo.
  const queue = [...byHost.entries()];
  const workers = Array.from({ length: Math.min(config.hostConcurrency, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next || stopRequested) return;
      const [host, hostEntities] = next;
      try {
        await crawlHost(db, host, hostEntities, opts);
      } catch (err) {
        log(`${host}: awaria workera: ${err instanceof Error ? err.message : err}`);
      }
    }
  });
  await Promise.all(workers);
  log(stopRequested ? "Zatrzymano. Wznowienie: ta sama komenda." : "Crawl zakonczony.");
}
