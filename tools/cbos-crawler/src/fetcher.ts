// Pobieranie HTTP: jeden punkt wspolny dla listingu i PDF.
// Zwracamy bajty plus naglowki; dekodowanie tekstu jest osobno, bo listing
// CBOS bywa serwowany w iso-8859-2 i response.text() zrobiloby z polskich
// znakow sieczke.

import { config } from "./config.ts";

export interface FetchResult {
  status: number;
  finalUrl: string;
  contentType: string | null;
  lastModified: string | null;
  body: Buffer;
  ms: number;
}

export async function fetchUrl(url: string, opts?: { maxBytes?: number }): Promise<FetchResult> {
  const started = Date.now();
  const res = await fetch(url, {
    headers: {
      "User-Agent": config.userAgent,
      Accept: "*/*",
      "Accept-Language": "pl,en;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  const maxBytes = opts?.maxBytes ?? config.maxDocBytes;
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    res.body?.cancel();
    throw new TooBigError(declared);
  }

  // Strumieniowo z twardym limitem: content-length bywa klamstwem albo go nie ma.
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (res.body) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel();
        throw new TooBigError(total);
      }
      chunks.push(value);
    }
  }

  return {
    status: res.status,
    finalUrl: res.url || url,
    contentType: res.headers.get("content-type"),
    lastModified: res.headers.get("last-modified"),
    body: Buffer.concat(chunks),
    ms: Date.now() - started,
  };
}

export class TooBigError extends Error {
  bytes: number;
  constructor(bytes: number) {
    super(`plik przekracza limit rozmiaru (${bytes} B)`);
    this.bytes = bytes;
  }
}

export function isHtml(contentType: string | null): boolean {
  return !!contentType && /text\/html|application\/xhtml/i.test(contentType);
}

/** Dekodowanie HTML z poszanowaniem charsetu: naglowek, potem meta, na koncu UTF-8. */
export function decodeHtml(body: Buffer, contentType: string | null): string {
  const fromHeader = contentType?.match(/charset=([\w-]+)/i)?.[1];
  const sniffZone = body.subarray(0, 4096).toString("latin1");
  const fromMeta =
    sniffZone.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    sniffZone.match(/content=["'][^"']*charset=([\w-]+)/i)?.[1];
  const charset = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return body.toString("utf8");
  }
}
