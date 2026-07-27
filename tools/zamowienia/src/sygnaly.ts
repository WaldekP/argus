// Sygnaly sledcze liczone na danych, ktore juz mamy (BZP + biala lista).
// Wszystko to TROPY DO WERYFIKACJI, nie zarzuty.

import type { DatabaseSync } from "node:sqlite";

export function runSygnaly(db: DatabaseSync): void {
  // 1. KLASTER ADRESOWY: rozne firmy-zwyciezcy pod tym samym adresem.
  console.log("=== Klaster adresowy (firmy-zwyciezcy pod tym samym adresem) ===");
  const clusters = db.prepare(`
    SELECT address_norm, COUNT(*) firm, GROUP_CONCAT(name, ' | ') nazwy, address_norm
    FROM company_details
    WHERE address_norm IS NOT NULL AND is_company = 1
    GROUP BY address_norm HAVING COUNT(*) >= 2
    ORDER BY firm DESC LIMIT 15
  `).all() as { address_norm: string; firm: number; nazwy: string }[];
  if (clusters.length === 0) {
    console.log("  (brak — najpierw: node src/cli.ts wzbogac)");
  } else {
    for (const c of clusters) {
      console.log(`  ${c.firm} firm @ ${c.address_norm.slice(0, 45)}`);
      console.log(`     ${(c.nazwy || "").slice(0, 110)}`);
    }
  }

  // 2. WIEK SPOLKI vs PIERWSZA WYGRANA: firma zarejestrowana krotko przed
  //    pierwszym wygranym przetargiem (mloda firma + kontrakt).
  console.log("\n=== Mloda firma vs pierwsza wygrana (rejestracja < 365 dni przed) ===");
  const young = db.prepare(`
    SELECT cd.name, cd.nip, cd.registration_date reg,
           MIN(n.publication_date) first_win,
           COUNT(DISTINCT c.bzp_number) wins,
           CAST(julianday(MIN(n.publication_date)) - julianday(cd.registration_date) AS INT) dni
    FROM company_details cd
    JOIN contractors c ON c.nip = cd.nip
    JOIN notices n ON n.bzp_number = c.bzp_number AND n.notice_type = 'TenderResultNotice'
    WHERE cd.registration_date IS NOT NULL
    GROUP BY cd.nip
    HAVING dni IS NOT NULL AND dni BETWEEN 0 AND 365
    ORDER BY dni ASC LIMIT 15
  `).all() as { name: string; nip: string; reg: string; first_win: string; wins: number; dni: number }[];
  if (young.length === 0) {
    console.log("  (brak — najpierw wzbogac + ingest wynikow)");
  } else {
    for (const y of young) {
      console.log(`  ${y.dni} dni | ${(y.name || "").slice(0, 34)} | rej. ${y.reg?.slice(0, 10)} -> 1. wygrana ${y.first_win?.slice(0, 10)} (${y.wins}x)`);
    }
  }
  console.log("\nTo tropy do weryfikacji, nie zarzuty. Sprawdz zrodlo (ogloszenie, KRS).");
}
