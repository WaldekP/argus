// Schemat bazy. SQLite przez wbudowany node:sqlite, bez zaleznosci.
//
// Model pod analize "kto wygrywa i za ile":
//   notices     — ogloszenia BZP (o zamowieniu i o wyniku), po bzpNumber.
//   contractors — zwyciezcy per ogloszenie o wyniku (NIP = klucz do KRS).
//   ingest_windows — ktore okna (typ + rok + miesiac) sa juz pobrane,
//                    zeby wznawiac bez powtarzania.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notices (
  bzp_number TEXT PRIMARY KEY,      -- np. "2024/BZP 00347265"
  notice_type TEXT NOT NULL,        -- ContractNotice | TenderResultNotice
  tender_id TEXT,                   -- OCDS id, laczy ogloszenie z wynikiem
  publication_date TEXT,
  year INTEGER,
  order_object TEXT,                -- przedmiot zamowienia
  cpv_code TEXT,
  procedure_result TEXT,            -- np. zawarcieUmowy
  is_below_eu INTEGER,              -- 1 = ponizej progu UE
  order_type TEXT,                  -- dostawy / uslugi / roboty
  org_name TEXT NOT NULL,           -- zamawiajacy
  org_nip TEXT,
  org_city TEXT,
  org_province TEXT,
  submitting_offers_date TEXT,
  first_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notices_type_year ON notices(notice_type, year);
CREATE INDEX IF NOT EXISTS idx_notices_org ON notices(org_nip);
CREATE INDEX IF NOT EXISTS idx_notices_tender ON notices(tender_id);

CREATE TABLE IF NOT EXISTS contractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bzp_number TEXT NOT NULL REFERENCES notices(bzp_number),
  name TEXT,
  nip TEXT,                         -- NIP zwyciezcy: klucz do KRS
  city TEXT,
  province TEXT,
  UNIQUE(bzp_number, nip, name)
);
CREATE INDEX IF NOT EXISTS idx_contractors_nip ON contractors(nip);

CREATE TABLE IF NOT EXISTS ingest_windows (
  notice_type TEXT NOT NULL,
  day TEXT NOT NULL,                -- okno dzienne (API ignoruje PageNumber,
                                    -- wiec dzien = jedna strona; Gdansk ~5-10/dzien)
  fetched INTEGER NOT NULL,         -- ile rekordow (po filtrze miasta) zapisano
  raw_count INTEGER,               -- ile zwrocilo API (do wykrycia dnia > limitu)
  completed_at TEXT NOT NULL,
  PRIMARY KEY (notice_type, day)
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
