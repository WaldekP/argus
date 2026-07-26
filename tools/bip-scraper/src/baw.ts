// Adapter Bazy Aktow Wlasnych (baw.bip.gdansk.pl) — akty prawne Urzedu Miasta,
// ktorych plaski crawl nie widzi (SPA AngularJS z REST API).
//
// Model odkryty przez inzynierie wsteczna aplikacji:
//   - Instytucja: UrzadMiejskiwGdansku, InstitutionId = 216.
//   - Zbiory (bags): 1200 = uchwaly Rady Miasta, 1202 = zarzadzenia Prezydenta.
//   - Lista: POST /api/documents/GetDocumentsNewGrid z obiektem gridsearch,
//     paginacja przez DevExtremeGridOptions.skip/take. Odpowiedz:
//     { DevExtremeDocuments: { data: [...], totalCount } }. Dostepna anonimowo.
//   - Sortowanie domyslne: od najnowszych, wiec filtr roku (>= bawMinYear)
//     pozwala przerwac pobieranie, gdy zejdziemy ponizej progu.
//
// Pliki PDF aktow: endpoint GetDocumentFiles wymaga zalogowania (401 anonimowo),
// wiec ten etap zbiera KATALOG (metadane + permalink). Pobranie tresci plikow
// to osobny, pozniejszy krok (publiczny URL podgladu do domkniecia).

import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";

const BASE = "https://baw.bip.gdansk.pl";
const INSTITUTION_ID = 216;
const BAGS = [
  { id: 1200, name: "Zbiór uchwał Rady Miasta Gdańska", kind: "uchwała" },
  { id: 1202, name: "Zbiór zarządzeń Prezydenta Miasta Gdańska", kind: "zarządzenie" },
];
const PAGE = 100;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS baw_acts (
  id INTEGER PRIMARY KEY,          -- BAW document Id
  bag_id INTEGER NOT NULL,
  kind TEXT,                       -- uchwala | zarzadzenie
  act_type TEXT,                   -- LegalActTypeDescription
  act_number TEXT,                 -- ActNumberComputed / numer
  act_date TEXT,                   -- ActDate (ISO)
  published_date TEXT,             -- PublishedDate
  year INTEGER,
  subject TEXT,                    -- pelny tytul
  status TEXT,                     -- LegalActStatusDescription
  link_url TEXT,                   -- publiczny permalink
  first_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_baw_year ON baw_acts(year);
CREATE INDEX IF NOT EXISTS idx_baw_bag ON baw_acts(bag_id);
`;

interface GridDoc {
  Id: number;
  LegalActTypeDescription: string | null;
  ActNumberComputed: string | null;
  ActDate: string | null;
  PublishedDate: string | null;
  Subject: string | null;
  LegalActStatusDescription: string | null;
  LinkUrl: string | null;
}

/** Payload siatki — ksztalt przechwycony z realnego XHR aplikacji. */
function gridBody(bagId: number, skip: number, take: number) {
  return {
    pageNumber: 0, pageSize: take, isBlocked: true, searchText: "",
    searchInContentWithElasticSearch: false, hideAmendingActs: false,
    SearchText: "", Asc: 1, ColumnId: -1, InstitutionId: INSTITUTION_ID,
    PageNumber: 0, PageSize: take, SearchTextInPdf: false,
    DevExtremeGridOptions: {
      sort: null, group: null, searchOperation: "contains",
      searchValue: null, skip, take, requireTotalCount: true, userData: {},
    },
    AdditionalId: bagId, SearchForType: 0,
  };
}

async function fetchPage(
  bagId: number,
  skip: number,
): Promise<{ docs: GridDoc[]; total: number }> {
  const res = await fetch(`${BASE}/api/documents/GetDocumentsNewGrid`, {
    method: "POST",
    headers: {
      "User-Agent": config.userAgent,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(gridBody(bagId, skip, PAGE)),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  if (res.status !== 200) throw new Error(`GetDocumentsNewGrid HTTP ${res.status}`);
  const json = await res.json() as { DevExtremeDocuments?: { data?: GridDoc[]; totalCount?: number } };
  const dx = json.DevExtremeDocuments;
  return { docs: dx?.data ?? [], total: dx?.totalCount ?? -1 };
}

function yearOf(iso: string | null): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export async function runBaw(
  db: DatabaseSync,
  opts: { minYear?: number },
): Promise<void> {
  db.exec(SCHEMA);
  const minYear = opts.minYear ?? config.bawMinYear;
  console.log(`Adapter BAW: Urzad Miasta Gdanska (inst ${INSTITUTION_ID}), akty od ${minYear}`);

  const upsert = db.prepare(`
    INSERT INTO baw_acts (id, bag_id, kind, act_type, act_number, act_date,
      published_date, year, subject, status, link_url, first_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      act_type=excluded.act_type, act_number=excluded.act_number,
      act_date=excluded.act_date, published_date=excluded.published_date,
      year=excluded.year, subject=excluded.subject, status=excluded.status,
      link_url=excluded.link_url
  `);

  for (const bag of BAGS) {
    console.log(`\n=== ${bag.name} (bag ${bag.id})`);
    let skip = 0;
    let total = -1;
    let kept = 0;
    let stop = false;
    while (!stop) {
      let page;
      try {
        page = await fetchPage(bag.id, skip);
      } catch (err) {
        console.log(`  blad na skip=${skip}: ${err instanceof Error ? err.message : err}; ponawiam za 5s`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      if (total < 0) total = page.total;
      if (page.docs.length === 0) break;

      db.exec("BEGIN");
      for (const d of page.docs) {
        const year = yearOf(d.ActDate);
        // Sortowanie od najnowszych: gdy zejdziemy ponizej progu, konczymy zbior.
        if (year !== null && year < minYear) { stop = true; continue; }
        upsert.run(
          d.Id, bag.id, bag.kind, d.LegalActTypeDescription ?? null,
          d.ActNumberComputed ?? null, d.ActDate ?? null, d.PublishedDate ?? null,
          year, d.Subject ?? null, d.LegalActStatusDescription ?? null,
          d.LinkUrl ?? null, nowIso(),
        );
        kept++;
      }
      db.exec("COMMIT");

      skip += PAGE;
      process.stdout.write(`\r  pobrano ${Math.min(skip, total)}/${total}, zapisano od ${minYear}: ${kept}   `);
      if (skip >= total) break;
      await new Promise((r) => setTimeout(r, config.perHostDelayMs));
    }
    console.log(`\n  ${bag.name}: zapisano ${kept} aktow od ${minYear} (z ${total} w zbiorze).`);
  }

  const summary = db.prepare(
    "SELECT kind, COUNT(*) c, MIN(year) miny, MAX(year) maxy FROM baw_acts GROUP BY kind",
  ).all() as { kind: string; c: number; miny: number; maxy: number }[];
  console.log("\nKatalog BAW:");
  for (const s of summary) console.log(`  ${s.kind}: ${s.c} aktow (${s.miny}-${s.maxy})`);
  console.log("Pliki PDF aktow: osobny etap (endpoint plikow wymaga autoryzacji).");
}
