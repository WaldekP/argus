// Skladowanie oryginalow PDF na dysku, kluczowane po sha256 tresci.
// Ten sam plik (ta sama tresc) zapisujemy raz. Sciezka jest szardowana po
// dwoch pierwszych znakach hasha, zeby nie robic jednego katalogu z tysiacem
// plikow.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.ts";

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function storeBlob(buf: Buffer): { hash: string; relPath: string } {
  const hash = sha256(buf);
  const relPath = path.join(hash.slice(0, 2), `${hash}.pdf`);
  const abs = path.join(config.blobDir, relPath);
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
  }
  return { hash, relPath };
}
