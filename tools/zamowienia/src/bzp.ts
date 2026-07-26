// Ingest ogloszen z BZP dla zamawiajacych z Gdanska.
//
// API wymaga zakresu dat i typu ogloszenia, wiec iterujemy oknami miesiecznymi
// (bezpieczny rozmiar) x dwa typy. Filtr miasta robimy w kodzie na dokladne
// dopasowanie (API lapie po fragmencie, wpuszczajac "Starogard Gdanski").
//
// Wznawialnosc: okno (typ, rok, miesiac) po zakonczeniu ladzie w ingest_windows;
// ponowny bieg pomija ukonczone. Zapis rekordow jest i tak idempotentny
// (INSERT OR IGNORE / upsert po bzpNumber).

import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";

interface BzpNotice {
  bzpNumber: string;
  noticeType: string;
  tenderId: string | null;
  publicationDate: string | null;
  orderObject: string | null;
  cpvCode: string | null;
  procedureResult: string | null;
  isTenderAmountBelowEU: boolean | null;
  orderType: string | null;
  organizationName: string;
  organizationNationalId: string | null;
  organizationCity: string | null;
  organizationProvince: string | null;
  submittingOffersDate: string | null;
  contractors: {
    contractorName?: string;
    contractorNationalId?: string;
    contractorCity?: string;
    contractorProvince?: string;
  }[] | null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wszystkie dni [from..to] wlacznie, jako "YYYY-MM-DD". */
function eachDay(fromYear: number, toYear: number): string[] {
  const days: string[] = [];
  const thisYear = new Date().getUTCFullYear();
  const thisMonth = new Date().getUTCMonth() + 1;
  const thisDay = new Date().getUTCDate();
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      for (let d = 1; d <= last; d++) {
        // Nie idziemy w przyszlosc.
        if (y > thisYear || (y === thisYear && (m > thisMonth || (m === thisMonth && d > thisDay)))) {
          return days;
        }
        days.push(`${y}-${pad(m)}-${pad(d)}`);
      }
    }
  }
  return days;
}

/**
 * Ogloszenia danego typu z jednego dnia. API IGNORUJE PageNumber (strona 1 i 50
 * zwracaja to samo), dlatego oknem jest pojedynczy dzien: dla Gdanska to ~5-10
 * rekordow, mieszczace sie w jednej odpowiedzi. Gdyby dzien przekroczyl limit,
 * runIngest to zaloguje (raw_count == pageSize).
 */
async function fetchDay(noticeType: string, day: string): Promise<BzpNotice[]> {
  const qs = new URLSearchParams({
    PublicationDateFrom: day,
    PublicationDateTo: day,
    NoticeType: noticeType,
    // Filtr miasta serwerowo (fragment, lapie tez "Starogard Gdanski");
    // dokladne dopasowanie robi inGdansk().
    OrganizationCity: config.city,
    PageSize: String(config.pageSize),
    PageNumber: "1",
  });
  const res = await fetch(`${config.bzpBase}?${qs}`, {
    headers: { "User-Agent": config.userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  if (res.status !== 200) throw new Error(`BZP HTTP ${res.status}`);
  const data = await res.json();
  // API zwraca tablice albo obiekt z kluczami "0","1",... (zaleznie od strony).
  if (Array.isArray(data)) return data as BzpNotice[];
  if (data && typeof data === "object") return Object.values(data) as BzpNotice[];
  return [];
}

function inGdansk(n: BzpNotice): boolean {
  return (n.organizationCity ?? "").trim().toLowerCase() === config.city.toLowerCase();
}

function yearOf(iso: string | null): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export async function runIngest(
  db: DatabaseSync,
  opts: { fromYear?: number; toYear?: number; force?: boolean },
): Promise<void> {
  const fromYear = opts.fromYear ?? config.defaultFromYear;
  const toYear = opts.toYear ?? new Date().getUTCFullYear();
  console.log(
    `Ingest BZP: ${config.city}, lata ${fromYear}-${toYear}, typy: ${config.noticeTypes.join(", ")}`,
  );

  const upsertNotice = db.prepare(`
    INSERT INTO notices (bzp_number, notice_type, tender_id, publication_date, year,
      order_object, cpv_code, procedure_result, is_below_eu, order_type,
      org_name, org_nip, org_city, org_province, submitting_offers_date, first_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bzp_number) DO UPDATE SET
      procedure_result = excluded.procedure_result,
      order_object = excluded.order_object
  `);
  const insContractor = db.prepare(`
    INSERT OR IGNORE INTO contractors (bzp_number, name, nip, city, province)
    VALUES (?, ?, ?, ?, ?)
  `);
  const markWindow = db.prepare(`
    INSERT INTO ingest_windows (notice_type, day, fetched, raw_count, completed_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(notice_type, day) DO UPDATE SET
      fetched = excluded.fetched, raw_count = excluded.raw_count,
      completed_at = excluded.completed_at
  `);
  const windowDone = db.prepare(
    "SELECT 1 FROM ingest_windows WHERE notice_type = ? AND day = ?",
  );

  const days = eachDay(fromYear, toYear);
  const today = new Date().toISOString().slice(0, 10);
  let totalKept = 0;
  let overflowDays = 0;

  for (const noticeType of config.noticeTypes) {
    let doneInType = 0;
    for (const day of days) {
      // Okno ukonczone pomijamy, chyba ze --force LUB to dzisiaj (moze dojsc nowych).
      if (!opts.force && day !== today && windowDone.get(noticeType, day)) continue;

      let batch: BzpNotice[];
      try {
        batch = await fetchDay(noticeType, day);
      } catch (err) {
        console.log(`  ${noticeType} ${day}: blad (${err instanceof Error ? err.message : err}), ponawiam za 5s`);
        await new Promise((r) => setTimeout(r, 5000));
        continue; // ten sam dzien jeszcze raz
      }

      let kept = 0;
      db.exec("BEGIN");
      for (const n of batch) {
        if (!inGdansk(n)) continue;
        upsertNotice.run(
          n.bzpNumber, n.noticeType, n.tenderId ?? null, n.publicationDate ?? null,
          yearOf(n.publicationDate), n.orderObject ?? null, n.cpvCode ?? null,
          n.procedureResult ?? null, n.isTenderAmountBelowEU ? 1 : 0, n.orderType ?? null,
          n.organizationName, n.organizationNationalId ?? null, n.organizationCity ?? null,
          n.organizationProvince ?? null, n.submittingOffersDate ?? null, nowIso(),
        );
        for (const c of n.contractors ?? []) {
          insContractor.run(
            n.bzpNumber, c.contractorName ?? null, c.contractorNationalId ?? null,
            c.contractorCity ?? null, c.contractorProvince ?? null,
          );
        }
        kept++;
      }
      db.exec("COMMIT");

      markWindow.run(noticeType, day, kept, batch.length, nowIso());
      totalKept += kept;
      // Dzien na limicie strony => mogl sie nie zmiescic (API nie paginuje).
      if (batch.length >= config.pageSize) {
        overflowDays++;
        console.log(`  UWAGA: ${noticeType} ${day} zwrocil ${batch.length} (limit) - mozliwe obciecie`);
      }
      doneInType++;
      if (doneInType % 90 === 0) {
        console.log(`  ${noticeType}: ${day} przerobione, lacznie zapisano ${totalKept}`);
      }
      await new Promise((r) => setTimeout(r, config.delayMs));
    }
  }
  console.log(`\nGotowe. Zapisano/odswiezono ${totalKept} ogloszen dla Gdanska.`);
  if (overflowDays) {
    console.log(`Dni na limicie strony: ${overflowDays} (do rozbicia na wezsze okna, jesli istotne).`);
  }
}
