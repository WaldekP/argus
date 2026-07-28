// Podglad postepu potoku. Mozna odpalac w trakcie z drugiego terminala.

import type { DatabaseSync } from "node:sqlite";

function rowsToMap(rows: Array<{ k: string; c: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.k ?? "null"] = r.c;
  return out;
}

function fmt(m: Record<string, number>): string {
  const entries = Object.entries(m);
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(", ") : "(brak)";
}

export function runStatus(db: DatabaseSync): void {
  const total = (db.prepare("SELECT COUNT(*) AS c FROM komunikaty").get() as { c: number }).c;
  const matched = (
    db.prepare("SELECT COUNT(*) AS c FROM komunikaty WHERE matched = 1").get() as { c: number }
  ).c;
  const years = db
    .prepare("SELECT MIN(year) AS lo, MAX(year) AS hi FROM komunikaty")
    .get() as { lo: number | null; hi: number | null };

  const pdf = rowsToMap(
    db
      .prepare(
        "SELECT pdf_status AS k, COUNT(*) AS c FROM komunikaty WHERE matched = 1 GROUP BY pdf_status",
      )
      .all() as Array<{ k: string; c: number }>,
  );
  const extr = rowsToMap(
    db.prepare("SELECT status AS k, COUNT(*) AS c FROM extractions GROUP BY status").all() as Array<{
      k: string;
      c: number;
    }>,
  );
  const struct = rowsToMap(
    db.prepare("SELECT status AS k, COUNT(*) AS c FROM structured GROUP BY status").all() as Array<{
      k: string;
      c: number;
    }>,
  );

  // Tagi tematyczne: rozklad po komunikatach dopasowanych.
  const tagCounts: Record<string, number> = {};
  for (const r of db
    .prepare("SELECT topic_tags FROM komunikaty WHERE matched = 1")
    .all() as Array<{ topic_tags: string }>) {
    try {
      for (const t of JSON.parse(r.topic_tags) as string[]) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    } catch {
      /* ignoruj */
    }
  }

  console.log("=== cbos-crawler: status ===");
  console.log(`Komunikaty w katalogu: ${total} (lata ${years.lo ?? "?"}-${years.hi ?? "?"})`);
  console.log(`Dopasowane do tematow:  ${matched}`);
  console.log(`PDF (matched):          ${fmt(pdf)}`);
  console.log(`Ekstrakcja tekstu:      ${fmt(extr)}`);
  console.log(`Strukturyzacja AI:      ${fmt(struct)}`);
  console.log(`Tagi tematyczne:        ${fmt(tagCounts)}`);
}
