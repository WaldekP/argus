// Schemat bazy stanu. SQLite przez wbudowany node:sqlite, bez zaleznosci.
//
// Baza jest jednoczesnie katalogiem komunikatow, kolejka (status pending)
// i archiwum metadanych. Kazdy etap potoku commituje od razu, wiec przerwanie
// procesu (Ctrl+C, restart) jest bezpieczne: wznowienie bierze kolejne pending.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS komunikaty (
  id INTEGER PRIMARY KEY,           -- id komunikatu z CBOS (raporty_tekst.php?id=)
  numer TEXT NOT NULL,              -- np. "79/2026" (numer/rok)
  num INTEGER NOT NULL,             -- numer w roku (79)
  year INTEGER NOT NULL,            -- rok (2026)
  title TEXT NOT NULL,
  summary TEXT,                     -- streszczenie z listingu (z procentami)
  author TEXT,
  pub_date TEXT,                    -- data publikacji YYYY-MM-DD
  report_url TEXT NOT NULL,         -- strona komunikatu
  pdf_url TEXT NOT NULL,            -- wyliczony bezposredni PDF
  topic_tags TEXT NOT NULL DEFAULT '[]',  -- JSON: tagi tematyczne (12 tematow Argusa)
  matched INTEGER NOT NULL DEFAULT 0,     -- 1 = pasuje do tematow, kwalifikuje do pobrania
  discovered_at TEXT NOT NULL,

  -- Stan pobierania PDF:
  pdf_status TEXT NOT NULL DEFAULT 'pending',
  -- pending | stored | missing (404) | too_big | error | skipped
  sha256 TEXT,
  size INTEGER,
  blob_path TEXT,                   -- sciezka wzgledna w data/blobs
  fetched_at TEXT,
  pdf_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_komunikaty_matched_status
  ON komunikaty(matched, pdf_status);
CREATE INDEX IF NOT EXISTS idx_komunikaty_year ON komunikaty(year);

CREATE TABLE IF NOT EXISTS extractions (
  sha256 TEXT PRIMARY KEY,
  extract_version INTEGER NOT NULL,
  status TEXT NOT NULL,             -- ok | needs_ocr | error
  chars INTEGER,
  pages INTEGER,
  text_path TEXT,                   -- sciezka wzgledna w data/texts
  extracted_at TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS structured (
  komunikat_id INTEGER PRIMARY KEY REFERENCES komunikaty(id),
  status TEXT NOT NULL,             -- ok | error | skipped
  model TEXT,
  badanie TEXT,                     -- JSON: pola typu Badanie (patrz structure.ts)
  structured_at TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS fetch_log (
  ts TEXT NOT NULL,
  url TEXT NOT NULL,
  status INTEGER,
  ms INTEGER,
  bytes INTEGER,
  note TEXT
);
`;

export function openDb(): DatabaseSync {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function logFetch(
  db: DatabaseSync,
  url: string,
  status: number | null,
  ms: number,
  bytes: number,
  note?: string,
): void {
  db.prepare(
    "INSERT INTO fetch_log (ts, url, status, ms, bytes, note) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(nowIso(), url, status, ms, bytes, note ?? null);
}
