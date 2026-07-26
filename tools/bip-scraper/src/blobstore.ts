// Archiwum oryginalow. Plik lezy pod sciezka wyliczona z sha256, wiec
// ten sam dokument podlinkowany z dziesieciu stron zajmuje miejsce raz,
// a zawartosc pliku nigdy nie jest nadpisywana.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.ts";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/rtf": "rtf",
  "text/csv": "csv",
  "text/html": "html",
};

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function pickExtension(url: string, mime: string | null): string {
  const fromUrl = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (fromUrl) return fromUrl;
  const clean = mime?.split(";")[0].trim().toLowerCase() ?? "";
  return EXT_BY_MIME[clean] ?? "bin";
}

/**
 * Zapis do data/blobs/<2 znaki sha>/<sha>.<ext>. Zwraca sciezke wzgledna.
 * Gdy plik juz istnieje, nic nie pisze.
 */
export function storeBlob(body: Buffer, url: string, mime: string | null): {
  hash: string;
  relPath: string;
} {
  const hash = sha256(body);
  const ext = pickExtension(url, mime);
  const relPath = path.join(hash.slice(0, 2), `${hash}.${ext}`);
  const absPath = path.join(config.blobDir, relPath);
  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, body);
  }
  return { hash, relPath };
}
