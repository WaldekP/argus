// Etap 2: crawl — pobranie PDF komunikatow dopasowanych do tematow.
//
// Bierzemy tylko matched=1 ze statusem pending, szeregowo z odstepem (jeden
// host). URL PDF jest wyliczony w discover z numeru/roku; jesli CBOS nie ma
// pliku pod tym wzorcem (rzadkie), dostajemy 404 -> status 'missing'.
// Wznawialne: kazdy komunikat commituje sie od razu, Ctrl+C jest bezpieczne.

import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso, logFetch } from "./db.ts";
import { fetchUrl, isHtml, TooBigError } from "./fetcher.ts";
import { parseRobots, robotsAllows, type RobotsRules } from "./robots.ts";
import { storeBlob } from "./blobstore.ts";

export interface CrawlOptions {
  limit?: number;
  delayMs?: number;
  retryErrors?: boolean;
}

interface Row {
  id: number;
  numer: string;
  pdf_url: string;
}

let stopRequested = false;

async function loadRobots(db: DatabaseSync): Promise<RobotsRules | null> {
  try {
    const res = await fetchUrl(`${config.baseUrl}/robots.txt`, { maxBytes: 256 * 1024 });
    if (res.status === 200) return parseRobots(res.body.toString("utf8"));
  } catch {
    /* brak robots = brak ograniczen */
  }
  return null;
}

export async function runCrawl(db: DatabaseSync, opts: CrawlOptions): Promise<void> {
  const rules = await loadRobots(db);
  const delay = Math.max(opts.delayMs ?? config.requestDelayMs, rules?.crawlDelayMs ?? 0);

  const statuses = opts.retryErrors ? "('pending', 'error')" : "('pending')";
  const rows = db
    .prepare(
      `SELECT id, numer, pdf_url FROM komunikaty
       WHERE matched = 1 AND pdf_status IN ${statuses}
       ORDER BY year DESC, num DESC
       ${opts.limit ? "LIMIT " + Math.floor(opts.limit) : ""}`,
    )
    .all() as unknown as Row[];

  if (rows.length === 0) {
    console.log("Brak komunikatow do pobrania. Najpierw: discover.");
    return;
  }
  console.log(`Do pobrania: ${rows.length} PDF (delay ${delay} ms)`);

  process.on("SIGINT", () => {
    stopRequested = true;
    console.log("\nZatrzymywanie... (stan w bazie, wznow ta sama komenda)");
  });

  const mark = db.prepare(
    `UPDATE komunikaty SET pdf_status = ?, sha256 = ?, size = ?, blob_path = ?,
       fetched_at = ?, pdf_error = ? WHERE id = ?`,
  );

  const counts: Record<string, number> = {};
  let done = 0;
  for (const row of rows) {
    if (stopRequested) break;

    if (!robotsAllows(rules, row.pdf_url)) {
      mark.run("skipped", null, null, null, nowIso(), "robots", row.id);
      counts.skipped = (counts.skipped ?? 0) + 1;
      continue;
    }

    let status = "error";
    let sha: string | null = null;
    let size: number | null = null;
    let blobPath: string | null = null;
    let error: string | null = null;

    try {
      const res = await fetchUrl(row.pdf_url);
      logFetch(db, row.pdf_url, res.status, res.ms, res.body.length, "pdf");
      if (res.status === 404) {
        status = "missing";
        error = "404 — brak PDF pod wyliczonym URL";
      } else if (res.status !== 200) {
        error = `HTTP ${res.status}`;
      } else if (isHtml(res.contentType)) {
        status = "missing";
        error = "odpowiedz HTML zamiast PDF";
      } else {
        const stored = storeBlob(res.body);
        sha = stored.hash;
        size = res.body.length;
        blobPath = stored.relPath;
        status = "stored";
      }
    } catch (err) {
      if (err instanceof TooBigError) {
        status = "too_big";
        size = err.bytes;
      } else {
        error = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      }
      logFetch(db, row.pdf_url, null, 0, size ?? 0, `pdf:${status}`);
    }

    mark.run(status, sha, size, blobPath, nowIso(), error, row.id);
    counts[status] = (counts[status] ?? 0) + 1;
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${rows.length}...`);
    await new Promise((r) => setTimeout(r, delay));
  }

  console.log(
    "Wynik: " +
      Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(", "),
  );
}
