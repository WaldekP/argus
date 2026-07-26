// Podglad zebranych danych: skala, najczestsi zwyciezcy, sygnaly do drazenia.

import type { DatabaseSync } from "node:sqlite";

export function runStatus(db: DatabaseSync): void {
  const notices = db.prepare("SELECT COUNT(*) c FROM notices").get() as { c: number };
  const results = db.prepare("SELECT COUNT(*) c FROM notices WHERE notice_type='TenderResultNotice'").get() as { c: number };
  const contractors = db.prepare("SELECT COUNT(*) c FROM contractors").get() as { c: number };
  const uniqWinners = db.prepare("SELECT COUNT(DISTINCT nip) c FROM contractors WHERE nip IS NOT NULL").get() as { c: number };

  console.log("=== Zamowienia publiczne Gdanska (BZP) ===");
  console.log(`Ogloszenia: ${notices.c} (w tym o wyniku: ${results.c})`);
  console.log(`Zwyciezcy: ${contractors.c} wpisow, ${uniqWinners.c} unikalnych firm (po NIP)`);

  const byYear = db.prepare(
    "SELECT year, notice_type, COUNT(*) c FROM notices GROUP BY year, notice_type ORDER BY year DESC",
  ).all() as { year: number; notice_type: string; c: number }[];
  if (byYear.length) {
    console.log("\nWg roku:");
    for (const r of byYear) console.log(`  ${r.year} ${r.notice_type}: ${r.c}`);
  }

  const topWinners = db.prepare(`
    SELECT c.name, c.nip, COUNT(*) wins
    FROM contractors c WHERE c.nip IS NOT NULL
    GROUP BY c.nip ORDER BY wins DESC LIMIT 10
  `).all() as { name: string; nip: string; wins: number }[];
  if (topWinners.length) {
    console.log("\nNajczestsi zwyciezcy (do drazenia):");
    for (const r of topWinners) console.log(`  ${r.wins}x  ${(r.name ?? "").slice(0, 55)} (NIP ${r.nip})`);
  }
}
