// Etap 3: extract — rozczytanie tekstu z PDF do data/texts.
//
// Osobny etap, celowo poza crawlem: najdrozszy i najbardziej zawodny krok
// pracuje na lokalnych oryginalach, wiec poprawka ekstraktora to przeliczenie
// archiwum, nie ponowny crawl. Klucz stanu: sha256 tresci — ten sam plik
// rozczytujemy raz. Zmiana silnika = podbicie EXTRACT_VERSION.
//
// Statusy: ok | needs_ocr (skan bez warstwy tekstowej) | error.

import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";

export const EXTRACT_VERSION = 1;

/** Ponizej tylu znakow na strone uznajemy PDF za skan bez warstwy tekstu. */
const MIN_CHARS_PER_PAGE = 40;
const PDF_TIMEOUT_MS = 90_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}ms: ${label}`)), ms)),
  ]);
}

async function extractPdf(buf: Buffer): Promise<{ text: string; pages: number }> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    stopAtErrors: false,
  });
  const doc = await withTimeout(loadingTask.promise, PDF_TIMEOUT_MS, "getDocument");

  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as { str: string; hasEOL?: boolean }[]) {
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (item.str && !item.str.endsWith(" ")) {
        line += " ";
      }
    }
    if (line.trim()) lines.push(line);
    parts.push(lines.join("\n"));
    page.cleanup();
  }
  const pages = doc.numPages;
  await loadingTask.destroy();
  return { text: parts.join("\n\n"), pages };
}

interface BlobRow {
  sha256: string;
  blob_path: string;
}

export async function runExtract(db: DatabaseSync, opts: { limit?: number; force?: boolean }): Promise<void> {
  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error(`  [pominieto] odrzucona obietnica pdfjs: ${msg.slice(0, 160)}`);
  });

  const rows = db
    .prepare(
      `SELECT DISTINCT k.sha256, k.blob_path
       FROM komunikaty k
       LEFT JOIN extractions x ON x.sha256 = k.sha256
       WHERE k.pdf_status = 'stored' AND k.sha256 IS NOT NULL
         AND (${opts.force ? "1=1" : "x.sha256 IS NULL OR x.extract_version < ?"})
       ${opts.limit ? "LIMIT " + Math.floor(opts.limit) : ""}`,
    )
    .all(...(opts.force ? [] : [EXTRACT_VERSION])) as unknown as BlobRow[];

  console.log(`Do rozczytania: ${rows.length} PDF (wersja ${EXTRACT_VERSION})`);

  const upsert = db.prepare(`
    INSERT INTO extractions (sha256, extract_version, status, chars, pages, text_path, extracted_at, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sha256) DO UPDATE SET
      extract_version = excluded.extract_version, status = excluded.status,
      chars = excluded.chars, pages = excluded.pages, text_path = excluded.text_path,
      extracted_at = excluded.extracted_at, error = excluded.error
  `);

  const counts: Record<string, number> = {};
  let done = 0;
  for (const row of rows) {
    done++;
    const absPath = path.join(config.blobDir, row.blob_path);
    let status = "error";
    let text: string | null = null;
    let pages: number | null = null;
    let error: string | null = null;

    try {
      const buf = fs.readFileSync(absPath);
      const res = await extractPdf(buf);
      text = res.text;
      pages = res.pages;
      status =
        res.text.replace(/\s+/g, "").length < MIN_CHARS_PER_PAGE * res.pages ? "needs_ocr" : "ok";
    } catch (err) {
      error = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    }

    let textPath: string | null = null;
    if (status === "ok" && text) {
      textPath = path.join(row.sha256.slice(0, 2), `${row.sha256}.txt`);
      const abs = path.join(config.textDir, textPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text, "utf8");
    }

    upsert.run(row.sha256, EXTRACT_VERSION, status, text?.length ?? null, pages, textPath, nowIso(), error);
    counts[status] = (counts[status] ?? 0) + 1;
    if (done % 20 === 0) console.log(`  ${done}/${rows.length}...`);
  }

  console.log("Wynik: " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", "));
  if (counts["needs_ocr"]) {
    console.log(`Skany bez warstwy tekstowej: ${counts["needs_ocr"]} (kolejka pod przyszly OCR).`);
  }
}
