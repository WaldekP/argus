// Podglad postepu: czytamy te sama baze, na ktorej pracuje crawl,
// wiec komende mozna odpalac z drugiego terminala w trakcie.

import type { DatabaseSync } from "node:sqlite";

interface StatusRow {
  id: number;
  name: string;
  cms: string | null;
  pages_done: number;
  pages_pending: number;
  pages_error: number;
  docs_stored: number;
  docs_pending: number;
  docs_skipped: number;
  docs_error: number;
  bytes: number;
  last_activity: string | null;
}

export function runStatus(db: DatabaseSync, verbose: boolean): void {
  const rows = db
    .prepare(
      `SELECT e.id, e.name, p.cms_family AS cms,
        (SELECT COUNT(*) FROM pages WHERE entity_id = e.id AND status = 'done') AS pages_done,
        (SELECT COUNT(*) FROM pages WHERE entity_id = e.id AND status = 'pending') AS pages_pending,
        (SELECT COUNT(*) FROM pages WHERE entity_id = e.id AND status = 'error') AS pages_error,
        (SELECT COUNT(*) FROM documents WHERE entity_id = e.id AND status = 'stored') AS docs_stored,
        (SELECT COUNT(*) FROM documents WHERE entity_id = e.id AND status = 'pending') AS docs_pending,
        (SELECT COUNT(*) FROM documents WHERE entity_id = e.id AND status LIKE 'skipped%') AS docs_skipped,
        (SELECT COUNT(*) FROM documents WHERE entity_id = e.id AND status = 'error') AS docs_error,
        (SELECT COALESCE(SUM(size), 0) FROM documents WHERE entity_id = e.id AND status = 'stored') AS bytes,
        (SELECT MAX(fetched_at) FROM pages WHERE entity_id = e.id) AS last_activity
       FROM entities e LEFT JOIN probes p ON p.entity_id = e.id
       WHERE e.enabled = 1
       ORDER BY docs_stored DESC, e.name`,
    )
    .all() as unknown as StatusRow[];

  const mb = (b: number) => (b / (1024 * 1024)).toFixed(1);
  let tPages = 0, tPending = 0, tDocs = 0, tDocsPending = 0, tBytes = 0;

  console.log(
    "id".padStart(6) + "  " + "podmiot".padEnd(48) + "cms".padEnd(12) +
    "strony".padStart(14) + "dokumenty".padStart(16) + "MB".padStart(8),
  );
  console.log("-".repeat(106));
  for (const r of rows) {
    tPages += r.pages_done; tPending += r.pages_pending;
    tDocs += r.docs_stored; tDocsPending += r.docs_pending; tBytes += r.bytes;
    if (!verbose && r.pages_done === 0 && r.pages_pending === 0 && r.docs_stored === 0) continue;
    console.log(
      String(r.id).padStart(6) + "  " +
      r.name.slice(0, 46).padEnd(48) +
      (r.cms ?? "?").padEnd(12) +
      `${r.pages_done}+${r.pages_pending}p${r.pages_error ? `/${r.pages_error}e` : ""}`.padStart(14) +
      `${r.docs_stored}+${r.docs_pending}p${r.docs_skipped ? `/${r.docs_skipped}s` : ""}${r.docs_error ? `/${r.docs_error}e` : ""}`.padStart(16) +
      mb(r.bytes).padStart(8),
    );
  }
  console.log("-".repeat(106));
  console.log(
    `Podmiotow: ${rows.length}. Strony: ${tPages} zrobione, ${tPending} w kolejce. ` +
    `Dokumenty: ${tDocs} zapisane, ${tDocsPending} w kolejce. Archiwum: ${mb(tBytes)} MB.`,
  );
  console.log("Legenda: N+Mp = zrobione + pending, /Xs = pominiete, /Xe = bledy.");

  if (verbose) {
    const cms = db
      .prepare(
        `SELECT COALESCE(cms_family, 'niezbadany') AS family, COUNT(*) AS c
         FROM entities e LEFT JOIN probes p ON p.entity_id = e.id
         WHERE e.enabled = 1 GROUP BY family ORDER BY c DESC`,
      )
      .all() as { family: string; c: number }[];
    console.log("\nRozklad platform: " + cms.map((r) => `${r.family}=${r.c}`).join(", "));
  }
}
