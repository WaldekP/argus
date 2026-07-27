// Adapter TED (Tenders Electronic Daily) — ogloszenia UE powyzej progow.
//
// Po co: BZP ma tylko zamowienia krajowe od 2021. Duze kontrakty (infrastruktura,
// lotnisko, kolej) i cala historia sprzed 2021 sa w TED. Przyklad: GIWK ma 5
// ogloszen w BZP, a ~400 w TED od 2016.
//
// Faza 1 (ta): indeks ogloszen danego nabywcy + pobor plikow zrodlowych XML do
// archiwum. Faza 2 (osobno): parsowanie zwyciezcy i kwoty z XML — schematy TED
// (2016) i eForms (2024+) sa rozne, wiec to osobna robota.
//
// API: POST /v3/notices/search, expert query (FT~"nazwa" dziala), paginacja
// kursorowa przez iterationNextToken. Darmowe, bez klucza.

import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";

interface TedNotice {
  "publication-number": string;
  "publication-date"?: string;
  "notice-title"?: Record<string, string[]> | string;
  "buyer-name"?: Record<string, string[]> | string;
  links?: { xml?: Record<string, string>; pdf?: Record<string, string> };
}

interface TedResponse {
  notices?: TedNotice[];
  totalNoticeCount?: number;
  iterationNextToken?: string | null;
}

/** Pole wielojezyczne TED: preferuj polski, potem angielski, potem pierwsze. */
function pickLang(v: Record<string, string[]> | string | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const order = ["pol", "eng", ...Object.keys(v)];
  for (const k of order) {
    const arr = v[k];
    if (Array.isArray(arr) && arr[0]) return arr[0];
  }
  return null;
}

async function search(query: string, token: string | null): Promise<TedResponse> {
  const res = await fetch(config.tedBase, {
    method: "POST",
    headers: {
      "User-Agent": config.userAgent,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      query,
      fields: ["publication-number", "publication-date", "notice-title", "buyer-name", "links"],
      limit: 100,
      scope: "ALL",
      paginationMode: "ITERATION",
      ...(token ? { iterationNextToken: token } : {}),
    }),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  if (res.status !== 200) throw new Error(`TED HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<TedResponse>;
}

function yearOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export async function runTed(
  db: DatabaseSync,
  opts: { buyer: string; downloadXml?: boolean },
): Promise<void> {
  const query = `FT~"${opts.buyer.replace(/"/g, "")}"`;
  console.log(`Adapter TED: nabywca ~ "${opts.buyer}"`);

  const upsert = db.prepare(`
    INSERT INTO ted_notices (pub_number, publication_date, year, buyer_name, title,
      buyer_query, notice_url, xml_url, first_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pub_number) DO UPDATE SET
      buyer_name = excluded.buyer_name, title = excluded.title,
      xml_url = excluded.xml_url
  `);
  const markXml = db.prepare("UPDATE ted_notices SET xml_path = ? WHERE pub_number = ?");

  let token: string | null = null;
  let total = -1;
  let stored = 0;
  const toDownload: { pub: string; url: string }[] = [];

  for (;;) {
    let page: TedResponse;
    try {
      page = await search(query, token);
    } catch (err) {
      console.log(`  blad wyszukiwania: ${err instanceof Error ? err.message : err}; ponawiam za 5s`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (total < 0) {
      total = page.totalNoticeCount ?? 0;
      console.log(`  ogloszen w TED: ${total}`);
    }
    const notices = page.notices ?? [];
    if (notices.length === 0) break;

    db.exec("BEGIN");
    for (const n of notices) {
      const pub = n["publication-number"];
      if (!pub) continue;
      const date = n["publication-date"]?.slice(0, 10) ?? null;
      const xmlUrl = n.links?.xml?.MUL ?? Object.values(n.links?.xml ?? {})[0] ?? null;
      upsert.run(
        pub, date, yearOf(date), pickLang(n["buyer-name"]), pickLang(n["notice-title"]),
        opts.buyer, `https://ted.europa.eu/en/notice/${pub}`, xmlUrl, nowIso(),
      );
      stored++;
      if (opts.downloadXml && xmlUrl) toDownload.push({ pub, url: xmlUrl });
    }
    db.exec("COMMIT");
    process.stdout.write(`\r  zapisano ${stored}/${total}   `);

    token = page.iterationNextToken ?? null;
    if (!token || notices.length < 100) break;
    await new Promise((r) => setTimeout(r, config.delayMs));
  }
  console.log(`\n  indeks: ${stored} ogloszen.`);

  // Pobor plikow zrodlowych XML (osobno, bo wolniejsze).
  if (opts.downloadXml && toDownload.length) {
    fs.mkdirSync(config.tedDir, { recursive: true });
    let dl = 0;
    for (const { pub, url } of toDownload) {
      const rel = `${pub}.xml`;
      const abs = path.join(config.tedDir, rel);
      if (fs.existsSync(abs)) { markXml.run(rel, pub); continue; }
      try {
        const r = await fetch(url, { headers: { "User-Agent": config.userAgent }, signal: AbortSignal.timeout(config.requestTimeoutMs) });
        if (r.status === 200) {
          fs.writeFileSync(abs, Buffer.from(await r.arrayBuffer()));
          markXml.run(rel, pub);
          dl++;
        }
      } catch {
        /* pojedynczy plik moze sie nie pobrac; indeks zostaje */
      }
      if (dl % 20 === 0 && dl) process.stdout.write(`\r  XML pobrane ${dl}/${toDownload.length}   `);
      await new Promise((r) => setTimeout(r, config.delayMs));
    }
    console.log(`\n  pobrano ${dl} plikow XML do data/ted.`);
  }

  const summary = db.prepare(
    "SELECT MIN(year) miny, MAX(year) maxy, COUNT(*) c FROM ted_notices WHERE buyer_query = ?",
  ).get(opts.buyer) as { miny: number; maxy: number; c: number };
  console.log(`Gotowe. ${summary.c} ogloszen TED dla "${opts.buyer}" (${summary.miny}-${summary.maxy}).`);
  console.log("Zwyciezca i kwota: parsowanie z XML to faza 2 (schematy TED/eForms).");
}
