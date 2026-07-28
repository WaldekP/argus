// Etap 5: export — zlozenie payloadu pod baze wiedzy Argusa.
//
// Zbiera komunikaty przerobione przez potok (metadane + tekst + struktura AI)
// do jednego pliku JSON. To wejscie dla operacji `load_knowledge` w Edge
// Function argus-ingest, ktora liczy embeddingi (Supabase.ai gte-small — tylko
// server-side) i wstawia do tabeli knowledge_docs. Embeddingow NIE liczymy tu:
// Node nie ma dostepu do modelu edge-runtime.
//
// Klucz dedup: content_hash (sha256 PDF). Ten sam plik = jeden rekord.

import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";

interface Row {
  id: number;
  numer: string;
  year: number;
  title: string;
  summary: string | null;
  author: string | null;
  pub_date: string | null;
  report_url: string;
  pdf_url: string;
  topic_tags: string;
  sha256: string;
  chars: number | null;
  pages: number | null;
  text_path: string;
  badanie: string | null;
}

export interface ExportOptions {
  /** Gdy true, do pliku trafiaja tez rekordy oznaczone przez AI jako nieprzydatne. */
  includeUnusable?: boolean;
  /** Gdy true, dolacza pelny tekst komunikatu (duzo miejsca). Domyslnie tak. */
  withText?: boolean;
}

export function runExport(db: DatabaseSync, opts: ExportOptions): void {
  const withText = opts.withText ?? true;

  const rows = db
    .prepare(
      `SELECT k.id, k.numer, k.year, k.title, k.summary, k.author, k.pub_date,
              k.report_url, k.pdf_url, k.topic_tags, k.sha256,
              x.chars, x.pages, x.text_path, s.badanie
       FROM komunikaty k
       JOIN extractions x ON x.sha256 = k.sha256 AND x.status = 'ok'
       JOIN structured s ON s.komunikat_id = k.id AND s.status = 'ok'
       WHERE k.matched = 1 AND k.pdf_status = 'stored'
       ORDER BY k.year DESC, k.num DESC`,
    )
    .all() as unknown as Row[];

  const records = [];
  let skippedUnusable = 0;
  for (const r of rows) {
    let structured: Record<string, unknown> | null = null;
    try {
      structured = r.badanie ? JSON.parse(r.badanie) : null;
    } catch {
      structured = null;
    }
    const usable = structured?.przydatny !== false; // brak pola => traktuj jako przydatny
    if (!usable && !opts.includeUnusable) {
      skippedUnusable++;
      continue;
    }

    let text: string | undefined;
    if (withText) {
      try {
        text = fs.readFileSync(path.join(config.textDir, r.text_path), "utf8");
      } catch {
        text = undefined;
      }
    }

    records.push({
      source: "CBOS",
      external_id: r.numer,
      title: r.title,
      report_url: r.report_url,
      pdf_url: r.pdf_url,
      pub_date: r.pub_date,
      author: r.author,
      year: r.year,
      topic_tags: safeJsonArray(r.topic_tags),
      content_hash: r.sha256,
      chars: r.chars,
      pages: r.pages,
      summary: r.summary,
      structured,
      ...(text !== undefined ? { text } : {}),
    });
  }

  fs.mkdirSync(config.exportDir, { recursive: true });
  const outPath = path.join(config.exportDir, "cbos-knowledge.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { generated_at_note: "stempel czasu nadaje ingest", count: records.length, records },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `Wyeksportowano ${records.length} rekordow do ${outPath}` +
      (skippedUnusable ? ` (pominieto ${skippedUnusable} oznaczonych jako nieprzydatne)` : ""),
  );
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
