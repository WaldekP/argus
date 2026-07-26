// Etap OCR: rozczytanie skanow z kolejki needs_ocr (PDF bez warstwy tekstowej).
//
// Osobno od `extract`, bo OCR jest wolny (sekundy na strone) i zawodny.
// Rasteryzacja stron przez pdf-to-img (prebuilt canvas, bez kompilacji native),
// rozpoznanie przez tesseract.js z polskim modelem.
//
// Prowenancja: tekst z OCR dostaje status 'ocr_ok' (nie 'ok'), bo to
// rozpoznanie o nizszej pewnosci niz natywna warstwa tekstowa. Zapisujemy
// srednia pewnosc; strony ponizej progu id do 'ocr_low' i NIE wchodza do
// korpusu (zasada: lepsza dziura niz zmyslona liczba ze skanu).

import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";
import { EXTRACT_VERSION } from "./extract.ts";

/** Ponizej tej sredniej pewnosci tesseract tekst uznajemy za niewiarygodny. */
const MIN_CONFIDENCE = 55;
/** Skala rasteryzacji: kompromis jakosc OCR / pamiec i czas. */
const RENDER_SCALE = 2;

function textDir(): string {
  return path.join(config.dataDir, "texts");
}

interface Row {
  sha256: string;
  blob_path: string;
}

export async function runOcr(
  db: DatabaseSync,
  opts: { limit?: number },
): Promise<void> {
  const rows = db
    .prepare(
      `SELECT DISTINCT d.sha256, d.blob_path
       FROM documents d JOIN extractions x ON x.sha256 = d.sha256
       WHERE x.status = 'needs_ocr' AND d.blob_path IS NOT NULL
       ${opts.limit ? "LIMIT " + Math.floor(opts.limit) : ""}`,
    )
    .all() as unknown as Row[];

  if (rows.length === 0) {
    console.log("Kolejka needs_ocr pusta. Najpierw: extract.");
    return;
  }
  console.log(`Do OCR: ${rows.length} skanow (polski). To wolny etap.`);

  // Importy dynamiczne: ciezkie, placimy za nie tylko przy OCR.
  const { pdf } = await import("pdf-to-img");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("pol");

  const upd = db.prepare(
    `UPDATE extractions SET status = ?, chars = ?, pages = ?, text_path = ?,
       extracted_at = ?, error = ? WHERE sha256 = ?`,
  );

  const counts: Record<string, number> = {};
  let done = 0;
  try {
    for (const row of rows) {
      done++;
      const abs = path.join(config.blobDir, row.blob_path);
      try {
        const doc = await pdf(abs, { scale: RENDER_SCALE });
        const parts: string[] = [];
        const confs: number[] = [];
        let pageNo = 0;
        for await (const image of doc) {
          pageNo++;
          const { data } = await worker.recognize(image);
          parts.push(data.text);
          if (typeof data.confidence === "number") confs.push(data.confidence);
        }
        const text = parts.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
        const avgConf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;

        if (text.replace(/\s/g, "").length < 20 || avgConf < MIN_CONFIDENCE) {
          upd.run("ocr_low", text.length, pageNo, null, nowIso(),
            `pewnosc ${avgConf.toFixed(0)}`, row.sha256);
          counts["ocr_low"] = (counts["ocr_low"] ?? 0) + 1;
        } else {
          const rel = path.join(row.sha256.slice(0, 2), `${row.sha256}.txt`);
          const out = path.join(textDir(), rel);
          fs.mkdirSync(path.dirname(out), { recursive: true });
          fs.writeFileSync(out, text, "utf8");
          upd.run("ocr_ok", text.length, pageNo, rel, nowIso(),
            `pewnosc ${avgConf.toFixed(0)}`, row.sha256);
          counts["ocr_ok"] = (counts["ocr_ok"] ?? 0) + 1;
        }
      } catch (err) {
        upd.run("ocr_error", null, null, null, nowIso(),
          (err instanceof Error ? err.message : String(err)).slice(0, 200), row.sha256);
        counts["ocr_error"] = (counts["ocr_error"] ?? 0) + 1;
      }
      console.log(`  ${done}/${rows.length} ${row.sha256.slice(0, 10)} -> ` +
        Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", "));
    }
  } finally {
    await worker.terminate();
  }

  console.log("Wynik OCR: " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", "));
  console.log("Po OCR odpal `index`, zeby wciagnac rozpoznany tekst do wyszukiwarki.");
  void EXTRACT_VERSION;
}
