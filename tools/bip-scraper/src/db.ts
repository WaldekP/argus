// Schemat bazy stanu. SQLite przez wbudowany node:sqlite, bez zaleznosci.
//
// Baza jest jednoczesnie kolejka (pages/documents ze statusem pending)
// i archiwum metadanych. Kazdy krok crawla commituje od razu, wiec
// przerwanie procesu w dowolnym momencie jest bezpieczne: wznowienie
// po prostu bierze kolejne pending z bazy.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY,          -- id podmiotu ze spisu gov.pl
  name TEXT NOT NULL,
  url TEXT,                        -- adres strony BIP ze spisu
  host TEXT,                       -- host wyliczony z url
  path_prefix TEXT,                -- sciezka bazowa (dla BIP-ow bedacych podstrona)
  terc TEXT,
  place TEXT,
  parent_id INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS probes (
  entity_id INTEGER PRIMARY KEY REFERENCES entities(id),
  probed_at TEXT,
  http_status INTEGER,
  final_url TEXT,                  -- po przekierowaniach
  generator TEXT,                  -- meta generator, doslownie
  cms_family TEXT,                 -- rozpoznana rodzina platformy
  sitemap_url TEXT,
  rss_urls TEXT,                   -- JSON array
  robots TEXT,                     -- tresc robots.txt
  error TEXT
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id INTEGER NOT NULL REFERENCES entities(id),
  url TEXT NOT NULL UNIQUE,
  depth INTEGER NOT NULL DEFAULT 0,
  discovered_from TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done | error | skipped
  http_status INTEGER,
  content_type TEXT,
  fetched_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_pages_entity_status ON pages(entity_id, status);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id INTEGER NOT NULL REFERENCES entities(id),
  url TEXT NOT NULL UNIQUE,
  source_page TEXT,                -- strona, na ktorej znaleziono link
  link_text TEXT,                  -- tekst linku, czesto jedyny "tytul" dokumentu
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | stored | duplicate | skipped_old | skipped_big | error
  sha256 TEXT,
  size INTEGER,
  mime TEXT,
  blob_path TEXT,                  -- sciezka wzgledna w data/blobs
  last_modified TEXT,              -- naglowek Last-Modified, jesli byl
  first_seen_at TEXT NOT NULL,
  fetched_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_entity_status ON documents(entity_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_sha ON documents(sha256);

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
