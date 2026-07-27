// Wzbogacanie firm-zwyciezcow o dane z bialej listy VAT (wl-api.mf.gov.pl).
//
// Darmowe, bez klucza. Po NIP zwraca nazwe, KRS, REGON, adres i DATE REJESTRACJI.
// To odblokowuje dwa sygnaly sledcze:
//   - klaster adresowy (firmy pod tym samym adresem = mozliwe wydmuszki),
//   - wiek spolki vs pierwsza wygrana (mloda firma + duzy/pierwszy kontrakt).
//
// UWAGA (nauczka z testu): pole contractorNationalId z BZP to MIESZANKA NIP-ow
// i numerow KRS. Odpytujemy biala liste tylko dla wartosci przechodzacych
// walidacje NIP (suma kontrolna), reszte pomijamy.

import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";

/** Walidacja NIP: 10 cyfr, suma kontrolna (wagi 6,5,7,2,3,4,5,6,7 mod 11). */
export function isValidNip(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((a, x, i) => a + x * Number(d[i]), 0) % 11;
  return sum === Number(d[9]);
}

function normAddr(a: string | null | undefined): string | null {
  if (!a) return null;
  return a.toUpperCase().replace(/\s+/g, " ").replace(/[.,]/g, "").trim() || null;
}

interface WlSubject {
  name?: string;
  krs?: string | null;
  regon?: string | null;
  workingAddress?: string | null;
  residenceAddress?: string | null;
  registrationLegalDate?: string | null;
}

export async function runEnrich(
  db: DatabaseSync,
  opts: { limit?: number },
): Promise<void> {
  // Kandydaci: NIP-y zwyciezcow (BZP), poprawne, jeszcze nie wzbogacone.
  const rows = db
    .prepare(
      `SELECT DISTINCT nip FROM contractors
       WHERE nip IS NOT NULL
         AND nip NOT IN (SELECT nip FROM company_details)`,
    )
    .all() as { nip: string }[];
  const nips = rows.map((r) => r.nip.replace(/\D/g, "")).filter(isValidNip);
  const uniq = [...new Set(nips)].slice(0, opts.limit ? Math.floor(opts.limit) : undefined);

  if (uniq.length === 0) {
    console.log("Brak nowych poprawnych NIP-ow do wzbogacenia.");
    return;
  }
  console.log(`Do wzbogacenia (biala lista): ${uniq.length} firm.`);

  const upsert = db.prepare(`
    INSERT INTO company_details (nip, name, krs, regon, address, address_norm,
      registration_date, is_company, status, enriched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(nip) DO UPDATE SET
      name=excluded.name, krs=excluded.krs, regon=excluded.regon,
      address=excluded.address, address_norm=excluded.address_norm,
      registration_date=excluded.registration_date, is_company=excluded.is_company,
      status=excluded.status, enriched_at=excluded.enriched_at
  `);

  const date = new Date().toISOString().slice(0, 10);
  const counts: Record<string, number> = {};
  let done = 0;
  for (const nip of uniq) {
    done++;
    try {
      const r = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${date}`, {
        headers: { "User-Agent": config.userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });
      if (r.status === 429) { // limit — poczekaj i ponow
        await new Promise((res) => setTimeout(res, 3000));
        done--;
        continue;
      }
      const body = await r.json().catch(() => null) as { result?: { subject?: WlSubject } } | null;
      const s = body?.result?.subject;
      if (s) {
        const addr = s.workingAddress ?? s.residenceAddress ?? null;
        upsert.run(
          nip, s.name ?? null, s.krs ?? null, s.regon ?? null, addr, normAddr(addr),
          s.registrationLegalDate ?? null, s.krs ? 1 : 0, "ok", nowIso(),
        );
        counts["ok"] = (counts["ok"] ?? 0) + 1;
      } else {
        upsert.run(nip, null, null, null, null, null, null, null, "brak", nowIso());
        counts["brak"] = (counts["brak"] ?? 0) + 1;
      }
    } catch (err) {
      upsert.run(nip, null, null, null, null, null, null, null, "error", nowIso());
      counts["error"] = (counts["error"] ?? 0) + 1;
    }
    if (done % 25 === 0) {
      process.stdout.write(`\r  ${done}/${uniq.length} (` + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ") + ")   ");
    }
    await new Promise((res) => setTimeout(res, 350));
  }
  console.log("\nWynik: " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", "));
  console.log("Sygnaly na tych danych: node src/cli.ts sygnaly");
}
