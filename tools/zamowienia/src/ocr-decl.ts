// OCR oswiadczen majatkowych (skany PDF z person_files).
//
// Oswiadczenia to skany formularzy, wiec potrzebny OCR (pol). Rozczytany tekst
// laduje w declaration_text i jest podstawa ekstrakcji zadeklarowanych spolek
// i funkcji w fazie dopasowania do firm wygrywajacych przetargi.
//
// Odpornosc (nauczka z bip-scrapera): handler odrzuconych obietnic pdfjs +
// timeout na PDF, zeby jeden trefny skan nie ubil calego biegu.

import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";

const MIN_CONFIDENCE = 50;
const RENDER_SCALE = 2;
const PDF_TIMEOUT_MS = 120_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}ms: ${label}`)), ms)),
  ]);
}

interface FileRow {
  id: number;
  url: string;
  name: string;
}

export async function runOcrDecl(
  db: DatabaseSync,
  opts: { limit?: number },
): Promise<void> {
  const rows = db
    .prepare(
      `SELECT pf.id, pf.url, p.name
       FROM person_files pf JOIN people p ON p.id = pf.person_id
       LEFT JOIN declaration_text dt ON dt.person_file_id = pf.id
       WHERE dt.person_file_id IS NULL AND pf.url LIKE '%.pdf'
       ${opts.limit ? "LIMIT " + Math.floor(opts.limit) : ""}`,
    )
    .all() as unknown as FileRow[];

  if (rows.length === 0) {
    console.log("Brak deklaracji do OCR (albo wszystkie zrobione). Najpierw: osoby.");
    return;
  }
  console.log(`Do OCR: ${rows.length} deklaracji (polski). Wolne.`);

  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error(`  [pominieto] odrzucona obietnica pdfjs: ${msg.slice(0, 140)}`);
  });

  const { pdf } = await import("pdf-to-img");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("pol");

  const upd = db.prepare(`
    INSERT INTO declaration_text (person_file_id, status, text, conf, pages, ocr_at, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(person_file_id) DO UPDATE SET
      status=excluded.status, text=excluded.text, conf=excluded.conf,
      pages=excluded.pages, ocr_at=excluded.ocr_at, error=excluded.error
  `);

  const counts: Record<string, number> = {};
  let done = 0;
  try {
    for (const row of rows) {
      done++;
      try {
        const buf = Buffer.from(await (await fetch(row.url, {
          headers: { "User-Agent": config.userAgent },
          signal: AbortSignal.timeout(config.requestTimeoutMs),
        })).arrayBuffer());
        const doc = await withTimeout(pdf(buf, { scale: RENDER_SCALE }), PDF_TIMEOUT_MS, "pdf-to-img");
        const parts: string[] = [];
        const confs: number[] = [];
        let pages = 0;
        for await (const image of doc) {
          pages++;
          const { data } = await worker.recognize(image);
          parts.push(data.text);
          if (typeof data.confidence === "number") confs.push(data.confidence);
        }
        const text = parts.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
        const conf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
        const status = text.replace(/\s/g, "").length < 40 || conf < MIN_CONFIDENCE ? "ocr_low" : "ocr_ok";
        upd.run(row.id, status, status === "ocr_ok" ? text : text.slice(0, 4000), conf, pages, nowIso(), `conf ${conf.toFixed(0)}`);
        counts[status] = (counts[status] ?? 0) + 1;
      } catch (err) {
        upd.run(row.id, "error", null, null, null, nowIso(), (err instanceof Error ? err.message : String(err)).slice(0, 200));
        counts["error"] = (counts["error"] ?? 0) + 1;
      }
      if (done % 10 === 0 || done === rows.length) {
        console.log(`  ${done}/${rows.length} (${row.name.slice(0, 24)}) -> ` + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", "));
      }
    }
  } finally {
    await worker.terminate();
  }
  console.log("Wynik OCR deklaracji: " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", "));
}
