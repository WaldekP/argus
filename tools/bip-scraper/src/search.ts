// Wyszukiwarka pelnotekstowa po archiwum: FTS5 z tokenizerem trigram.
//
// Trigram zamiast domyslnego unicode61, bo polska fleksja: zapytanie
// "zielen" ma znajdowac "zieleni" i "zielenia" bez stemmera, ktorego
// SQLite dla polskiego nie ma. Cena: zapytanie musi miec >= 3 znaki.
//
// Indeksujemy per dokument (nie per sha), zeby wynik od razu niosl
// podmiot i URL. Tekst dokumentow bez ekstrakcji (skany przed OCR,
// formaty binarne) jest pusty, ale tytul z linku nadal jest szukalny.

import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";

const FTS_SCHEMA = `
CREATE VIRTUAL TABLE IF NOT EXISTS fts_documents USING fts5(
  doc_id UNINDEXED,
  entity UNINDEXED,
  url UNINDEXED,
  title,
  body,
  tokenize = 'trigram remove_diacritics 1'
);
`;

export function runIndex(db: DatabaseSync): void {
  // Pelna przebudowa od zera: prosciej i pewniej niz przyrostowo, a przy tej
  // skali trwa sekundy. Drop, nie DELETE, bo zmiana tokenizera wymaga
  // nowej definicji tabeli.
  db.exec("DROP TABLE IF EXISTS fts_documents");
  db.exec(FTS_SCHEMA);

  const rows = db
    .prepare(
      `SELECT d.id, d.url, d.link_text, e.name AS entity, x.text_path
       FROM documents d
       JOIN entities e ON e.id = d.entity_id
       LEFT JOIN extractions x ON x.sha256 = d.sha256 AND x.status = 'ok'
       WHERE d.status IN ('stored', 'duplicate')`,
    )
    .all() as {
    id: number;
    url: string;
    link_text: string | null;
    entity: string;
    text_path: string | null;
  }[];

  const insert = db.prepare(
    "INSERT INTO fts_documents (doc_id, entity, url, title, body) VALUES (?, ?, ?, ?, ?)",
  );

  let withText = 0;
  db.exec("BEGIN");
  for (const row of rows) {
    let body = "";
    if (row.text_path) {
      try {
        body = fs.readFileSync(path.join(config.dataDir, "texts", row.text_path), "utf8");
        withText++;
      } catch {
        /* tekst usuniety z dysku: zostaje samo wyszukiwanie po tytule */
      }
    }
    insert.run(row.id, row.entity, row.url, row.link_text ?? "", body);
  }
  db.exec("COMMIT");
  console.log(`Zaindeksowano ${rows.length} dokumentow, w tym ${withText} z pelnym tekstem.`);
  console.log("Pamietaj: po kolejnym crawl/extract odpal index ponownie.");
}

export function runSearch(db: DatabaseSync, query: string, limit: number): void {
  if (query.trim().length < 3) {
    console.log("Zapytanie musi miec co najmniej 3 znaki (tokenizer trigram).");
    return;
  }
  const hasFts = db
    .prepare("SELECT name FROM sqlite_master WHERE name = 'fts_documents'")
    .get();
  if (!hasFts) {
    console.log("Brak indeksu. Najpierw: node src/cli.ts index");
    return;
  }

  // Frazy w cudzyslowach zostawiamy, gole slowa tez sa poprawnym FTS.
  const rows = db
    .prepare(
      `SELECT doc_id, entity, url, title,
              snippet(fts_documents, 4, '>>', '<<', ' ... ', 16) AS frag,
              bm25(fts_documents) AS score
       FROM fts_documents WHERE fts_documents MATCH ?
       ORDER BY score LIMIT ?`,
    )
    .all(query, limit) as {
    doc_id: number;
    entity: string;
    url: string;
    title: string;
    frag: string;
    score: number;
  }[];

  if (rows.length === 0) {
    console.log("Nic nie znaleziono.");
    return;
  }
  for (const r of rows) {
    console.log(`\n#${r.doc_id} [${r.entity}]`);
    if (r.title) console.log(`  ${r.title}`);
    console.log(`  ${r.url}`);
    const frag = r.frag.replace(/\s+/g, " ").trim();
    if (frag) console.log(`  ${frag}`);
  }
  console.log(`\nWynikow: ${rows.length} (limit ${limit}).`);
}
