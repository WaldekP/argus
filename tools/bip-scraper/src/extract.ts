// Ekstrakcja tekstu z archiwum. Osobny etap, celowo NIE w crawlu:
// najdrozszy i najbardziej zawodny krok pracuje na lokalnych oryginalach,
// wiec poprawka ekstraktora to przeliczenie archiwum, nie ponowny crawl.
//
// Klucz stanu: sha256 tresci, nie URL. Ten sam plik podlinkowany z wielu
// stron rozczytujemy raz. Zmiana silnika = podbicie EXTRACT_VERSION,
// komenda sama przeliczy wszystko z nizsza wersja.
//
// Statusy: ok | needs_ocr (skan bez warstwy tekstowej) | unsupported | error.
// OCR jest swiadomie poza zakresem tego etapu; needs_ocr to jego kolejka.

import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";
import { unzip } from "./zip.ts";
import { decodeEntities } from "./xml.ts";

export const EXTRACT_VERSION = 1;

/** Ponizej tylu znakow na strone PDF uznajemy, ze to skan bez warstwy tekstu. */
const MIN_CHARS_PER_PAGE = 30;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS extractions (
  sha256 TEXT PRIMARY KEY,
  extract_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  chars INTEGER,
  pages INTEGER,
  text_path TEXT,
  extracted_at TEXT NOT NULL,
  error TEXT
);
`;

function textDir(): string {
  return path.join(config.dataDir, "texts");
}

/** Twardy limit na jeden PDF: uszkodzony plik potrafi zawiesic pdfjs. */
const PDF_TIMEOUT_MS = 90_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout ${ms}ms: ${label}`)), ms),
    ),
  ]);
}

async function extractPdf(buf: Buffer): Promise<{ text: string; pages: number }> {
  // Import dynamiczny: pdfjs jest ciezki, nie placimy za niego przy innych komendach.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    // Nie wysypuj sie na drobnych niespojnosciach struktury (czeste w BIP-ach).
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

/** DOCX to ZIP z word/document.xml; akapity siedza w <w:p>, tekst w <w:t>. */
function extractDocx(buf: Buffer): string {
  const files = unzip(buf);
  const xml = files.get("word/document.xml")?.toString("utf8");
  if (!xml) throw new Error("DOCX bez word/document.xml");
  return xml
    .replace(/<w:p[ >]/g, "\n<")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => decodeEntities(l).trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

function extractHtml(buf: Buffer): string {
  return decodeEntities(
    buf
      .toString("utf8")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(p|br|div|li|tr|h[1-6])[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

interface BlobRow {
  sha256: string;
  blob_path: string;
  mime: string | null;
}

export async function runExtract(
  db: DatabaseSync,
  opts: { limit?: number; force?: boolean },
): Promise<void> {
  db.exec(SCHEMA);

  // pdfjs potrafi rzucic odrzucona obietnica z detachowanego zadania workera
  // (uszkodzony XRef itp.), poza naszym try/catch. Bez tego Node 24 ubija caly
  // bieg na jednym trefnym PDF. Logujemy i idziemy dalej; nieoznaczony plik
  // dostanie kolejna szanse przy wznowieniu (extract jest idempotentny).
  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error(`  [pominieto] odrzucona obietnica pdfjs: ${msg.slice(0, 160)}`);
  });

  const rows = db
    .prepare(
      `SELECT DISTINCT d.sha256, d.blob_path, d.mime
       FROM documents d
       LEFT JOIN extractions x ON x.sha256 = d.sha256
       WHERE d.status IN ('stored', 'duplicate') AND d.blob_path IS NOT NULL
         AND (${opts.force ? "1=1" : "x.sha256 IS NULL OR x.extract_version < ?"})
       ${opts.limit ? "LIMIT " + Math.floor(opts.limit) : ""}`,
    )
    .all(...(opts.force ? [] : [EXTRACT_VERSION])) as unknown as BlobRow[];

  console.log(`Do rozczytania: ${rows.length} unikalnych plikow (wersja ${EXTRACT_VERSION})`);

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
    const ext = row.blob_path.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";
    let status = "unsupported";
    let text: string | null = null;
    let pages: number | null = null;
    let error: string | null = null;

    try {
      const buf = fs.readFileSync(absPath);
      if (ext === "pdf" || row.mime?.includes("pdf")) {
        const res = await extractPdf(buf);
        text = res.text;
        pages = res.pages;
        status =
          res.text.replace(/\s+/g, "").length < MIN_CHARS_PER_PAGE * res.pages
            ? "needs_ocr"
            : "ok";
      } else if (ext === "docx") {
        text = extractDocx(buf);
        status = "ok";
      } else if (ext === "html" || ext === "htm") {
        text = extractHtml(buf);
        status = "ok";
      }
    } catch (err) {
      status = "error";
      error = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    }

    let textPath: string | null = null;
    if (status === "ok" && text) {
      textPath = path.join(row.sha256.slice(0, 2), `${row.sha256}.txt`);
      const abs = path.join(textDir(), textPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text, "utf8");
    }

    upsert.run(
      row.sha256, EXTRACT_VERSION, status,
      text?.length ?? null, pages, textPath, nowIso(), error,
    );
    counts[status] = (counts[status] ?? 0) + 1;
    if (done % 20 === 0) console.log(`  ${done}/${rows.length}...`);
  }

  console.log(
    "Wynik: " +
      Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(", "),
  );
  if (counts["needs_ocr"]) {
    console.log(
      `Skany bez warstwy tekstowej: ${counts["needs_ocr"]}. To kolejka pod przyszly OCR.`,
    );
  }
}
