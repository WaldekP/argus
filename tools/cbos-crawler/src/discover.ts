// Etap 1: discover — katalogowanie komunikatow z listingu CBOS.
//
// Przechodzimy listing oknami (publikacje_offset), parsujemy metadane wprost
// z HTML (numer, tytul, streszczenie, autor, data), klasyfikujemy tematycznie
// i zapisujemy do bazy. PDF-y NIE sa tu pobierane — to robi etap crawl, tylko
// dla komunikatow dopasowanych do tematow (matched=1).
//
// Listing jest od najnowszych: gdy caly ekran ma rok < minYear, konczymy.

import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso, logFetch } from "./db.ts";
import { fetchUrl, decodeHtml } from "./fetcher.ts";
import { parseRobots, robotsAllows, type RobotsRules } from "./robots.ts";
import { parseListing, pdfUrlFor } from "./parse-listing.ts";
import { classify } from "./topics.ts";

export interface DiscoverOptions {
  minYear?: number;
  maxPages?: number;
  delayMs?: number;
}

async function loadRobots(db: DatabaseSync): Promise<RobotsRules | null> {
  try {
    const res = await fetchUrl(`${config.baseUrl}/robots.txt`, { maxBytes: 256 * 1024 });
    logFetch(db, `${config.baseUrl}/robots.txt`, res.status, res.ms, res.body.length, "robots");
    if (res.status === 200) return parseRobots(res.body.toString("utf8"));
  } catch {
    /* brak robots.txt = brak ograniczen */
  }
  return null;
}

export async function runDiscover(db: DatabaseSync, opts: DiscoverOptions): Promise<void> {
  const minYear = opts.minYear ?? config.minYear;
  const maxPages = opts.maxPages ?? config.maxListPages;
  const delay = Math.max(opts.delayMs ?? config.requestDelayMs, 0);

  const rules = await loadRobots(db);
  const delayMs = Math.max(delay, rules?.crawlDelayMs ?? 0);

  const insert = db.prepare(
    `INSERT OR IGNORE INTO komunikaty
       (id, numer, num, year, title, summary, author, pub_date, report_url, pdf_url,
        topic_tags, matched, discovered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let offset = 0;
  let pages = 0;
  let added = 0;
  let matchedAdded = 0;

  for (; pages < maxPages; pages++) {
    const url = `${config.baseUrl}${config.listPath}?publikacje_offset=${offset}`;
    if (!robotsAllows(rules, url)) {
      console.log(`robots.txt blokuje ${url} — stop`);
      break;
    }

    let res;
    try {
      res = await fetchUrl(url, { maxBytes: 5 * 1024 * 1024 });
    } catch (err) {
      console.log(`Blad pobierania listingu (offset ${offset}): ${err instanceof Error ? err.message : err}`);
      break;
    }
    logFetch(db, url, res.status, res.ms, res.body.length, "list");
    if (res.status !== 200) {
      console.log(`Listing offset ${offset}: HTTP ${res.status} — stop`);
      break;
    }

    const rows = parseListing(decodeHtml(res.body, res.contentType));
    if (rows.length === 0) {
      console.log(`Listing offset ${offset}: 0 komunikatow — koniec archiwum`);
      break;
    }

    const maxYearOnPage = Math.max(...rows.map((r) => r.year));
    for (const r of rows) {
      if (r.year < minYear) continue;
      const c = classify(r.title, r.summary);
      const matched = c.tags.length > 0 ? 1 : 0;
      const info = insert.run(
        r.id,
        r.numer,
        r.num,
        r.year,
        r.title,
        r.summary || null,
        r.author,
        r.pubDate,
        `${config.baseUrl}${config.reportPath}?id=${r.id}`,
        pdfUrlFor(config.baseUrl, config.pdfDir, r.num, r.year),
        JSON.stringify(c.tags),
        matched,
        nowIso(),
      );
      if (info.changes > 0) {
        added++;
        if (matched) matchedAdded++;
      }
    }

    console.log(
      `offset ${offset}: ${rows.length} pozycji, max rok ${maxYearOnPage}, ` +
        `dodano ${added} (dopasowanych ${matchedAdded})`,
    );

    // Cala strona ponizej progu roku: dalej beda tylko starsze.
    if (maxYearOnPage < minYear) {
      console.log(`Zszedlem ponizej ${minYear} — stop`);
      break;
    }

    offset += config.listOffsetStep;
    await new Promise((r) => setTimeout(r, delayMs));
  }

  console.log(
    `\nDiscover zakonczony: ${pages + 1} stron listingu, ` +
      `dodano ${added} nowych komunikatow, w tym ${matchedAdded} dopasowanych do tematow.`,
  );
}
