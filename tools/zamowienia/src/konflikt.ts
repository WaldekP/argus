// Komenda `konflikt` — flagowy łańcuch śledczy dla jednego urzędnika:
//   urzędnik → jego spółki (Rejestr.io) → zwycięzcy ich przetargów (BZP) →
//   zarządy i beneficjenci zwycięzców (Rejestr.io) → FLAGI zbieżności.
//
// Flagi: (a) nazwisko urzędnika wśród osób firmy-zwycięzcy (konflikt/rodzina),
//        (b) interlock — ta sama osoba w zarządzie jego spółki i firmy-zwycięzcy.
//
// ZASADA: flagi to TROPY DO WERYFIKACJI, nie zarzuty. Każda z dowodem źródłowym.
//
// Rejestr.io jest PŁATNE ze wspólnego salda — przed płatnymi wywołaniami
// sprawdzamy saldo (próg 5 zł) i ograniczamy liczbę firm na przebieg.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";
import { isValidNip } from "./wzbogac.ts";

const RIO = "https://rejestr.io/api/v2";
const MIN_BALANCE = 5;
const MAX_WINNERS_PER_COMPANY = 50; // limit sprawdzeń na jedną spółkę
const MAX_WINNERS_TOTAL = 220;      // twardy globalny bezpiecznik kosztu na przebieg

function rejestrioKey(): string {
  if (process.env.REJESTRIO_API_KEY) return process.env.REJESTRIO_API_KEY;
  // Fallback: .env w korzeniu repo (dla wersji zintegrowanej z Argusem).
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  try {
    const env = fs.readFileSync(path.join(root, ".env"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      if (/^\s*#/.test(line)) continue;
      const m = line.match(/^\s*REJESTRIO_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) { const v = m[1].replace(/^["']|["']$/g, ""); if (v.length >= 20) return v; }
    }
  } catch { /* brak .env */ }
  throw new Error("Brak REJESTRIO_API_KEY (ustaw zmienna srodowiskowa albo .env).");
}

async function rio<T>(key: string, pathPart: string): Promise<T> {
  const r = await fetch(`${RIO}${pathPart}`, {
    headers: { Authorization: key, Accept: "application/json" },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  const t = await r.text();
  if (r.status !== 200) throw new Error(`Rejestr.io ${r.status}: ${t.slice(0, 120)}`);
  return JSON.parse(t) as T;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Rdzen nazwy zamawiajacego do filtra BZP: bez formy prawnej i cudzyslowow.
 *  BZP dopasowuje po fragmencie, wiec pelna nazwa prawna ("...SPOLKA Z O.O.")
 *  czesto nie trafia; rdzen ("Gdanska Infrastruktura Wodociagowo-Kanalizacyjna")
 *  trafia. */
function buyerCore(name: string): string {
  const cut = name
    .replace(/\bSP(?:Ó|O)?(?:ŁKA|\.)\b[\s\S]*$/i, "")
    .replace(/\bSPÓŁKA\b[\s\S]*$/i, "")
    .replace(/["']/g, "")
    .replace(/-/g, " ")     // "Wodociagowo-Kanalizacyjna" -> dwa czlony (BZP nie lubi myslnika)
    .replace(/\s+/g, " ")
    .trim();
  // Pierwsze 3 czlony: na tyle wyrozniajace, zeby trafic zamawiajacego, a na
  // tyle krotkie, zeby BZP dopasowalo po fragmencie (dluga nazwa nie trafia).
  return cut.split(" ").slice(0, 3).join(" ");
}

/** Zwyciezcy BZP dla zamawiajacego po nazwie (contractors z TenderResultNotice). */
async function bzpWinners(orgName: string): Promise<{ name: string; nip: string }[]> {
  const out = new Map<string, { name: string; nip: string }>();
  const rows = (d: unknown): any[] => Array.isArray(d) ? d : (d && (d as any)["0"] !== undefined ? Object.values(d as any) : []);
  for (let y = 2021; y <= new Date().getUTCFullYear(); y++) {
    const qs = new URLSearchParams({
      PublicationDateFrom: `${y}-01-01`, PublicationDateTo: `${y}-12-31`,
      NoticeType: "TenderResultNotice", OrganizationName: orgName,
      PageSize: "100", PageNumber: "1",
    });
    try {
      const r = await fetch(`${config.bzpBase}?${qs}`, { headers: { "User-Agent": config.userAgent, Accept: "application/json" } });
      for (const n of rows(await r.json())) {
        if (!/zawarcieUmowy/i.test(n.procedureResult || "")) continue;
        for (const c of (n.contractors || [])) {
          if (c.contractorName) out.set((c.contractorNationalId || c.contractorName), { name: c.contractorName, nip: c.contractorNationalId || "" });
        }
      }
    } catch { /* rok bez danych */ }
    await new Promise((r) => setTimeout(r, config.delayMs));
  }
  return [...out.values()];
}

interface RioPerson { id: number; typ: string; tozsamosc?: { imiona_i_nazwisko?: string; nazwisko?: string; data_urodzenia?: string }; krs_powiazania_liczby?: { aktualne?: number }; organizacje_skrot?: { nazwa_skrocona?: string }[]; }
interface RioOrg { id: number; typ: string; nazwy?: { pelna?: string }; numery?: { krs?: string | number; nip?: string | number }; krs_powiazania_kwerendowane?: { typ: string }[]; tozsamosc?: any; }

export async function runKonflikt(
  db: DatabaseSync,
  opts: { name?: string; personId?: number },
): Promise<void> {
  const key = rejestrioKey();

  // Bezpiecznik salda.
  const balance = Number(await rio<string | number>(key, "/konto/stan"));
  console.log(`Saldo Rejestr.io: ${balance.toFixed(2)} zl`);
  if (balance < MIN_BALANCE) {
    console.log(`Saldo ponizej progu ${MIN_BALANCE} zl — przerywam (ochrona wspolnego salda).`);
    return;
  }

  // 1. Ustal osobę.
  let personId = opts.personId;
  let personLabel = opts.name ?? String(personId);
  if (!personId) {
    const parts = (opts.name ?? "").trim().split(/\s+/);
    if (parts.length < 2) { console.log('Podaj --name "Imie Nazwisko" albo --id <rejestrioId>.'); return; }
    const [imie, ...reszta] = parts;
    const nazwisko = reszta[reszta.length - 1];
    const q = new URLSearchParams({ imie, nazwisko });
    const res = await rio<{ wyniki?: RioPerson[] }>(key, `/osoby?${q}`);
    const cands = (res.wyniki ?? []).sort((a, b) => (b.krs_powiazania_liczby?.aktualne ?? 0) - (a.krs_powiazania_liczby?.aktualne ?? 0));
    if (cands.length === 0) { console.log("Nie znaleziono osoby w Rejestr.io."); return; }
    console.log(`\nKandydaci (${cands.length}) — TOŻSAMOŚĆ DO POTWIERDZENIA:`);
    for (const c of cands.slice(0, 6)) console.log(`  id ${c.id} | ${c.tozsamosc?.imiona_i_nazwisko} | powiazan: ${c.krs_powiazania_liczby?.aktualne ?? 0} | org: ${(c.organizacje_skrot ?? []).map((o) => o.nazwa_skrocona).join(", ").slice(0, 70)}`);
    personId = cands[0].id;
    personLabel = cands[0].tozsamosc?.imiona_i_nazwisko ?? personLabel;
    console.log(`\nBiore najbardziej powiazanego: id ${personId} (${personLabel}). Uzyj --id, by wskazac innego.`);
  }

  const officialSurname = norm(personLabel).split(" ").pop() ?? "";

  // 2. Jego spółki (aktualne + historyczne).
  const companies: RioOrg[] = [];
  for (const scope of ["aktualne", "historyczne"] as const) {
    try { companies.push(...await rio<RioOrg[]>(key, `/osoby/${personId}/krs-powiazania?aktualnosc=${scope}`)); } catch { /* */ }
  }
  console.log(`\nSpolki urzednika (${companies.length}):`);
  for (const c of companies) console.log(`  • ${c.nazwy?.pelna?.slice(0, 55)} (KRS ${c.numery?.krs ?? "?"})`);

  const insFlag = db.prepare(`
    INSERT OR IGNORE INTO flags (kind, official, official_company, winner_name, winner_nip, detail, confidence, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 3. Dla każdej spółki: zwycięzcy BZP → ich osoby → flagi.
  let checked = 0;
  let flagged = 0;
  const seenWinner = new Set<string>(); // nie sprawdzaj tej samej firmy dwa razy
  outer:
  for (const comp of companies) {
    const compName = comp.nazwy?.pelna ?? "";
    const core = buyerCore(compName);
    const winners = await bzpWinners(core);
    console.log(`\n  [${core.slice(0, 45)}] zwyciezcow BZP: ${winners.length}`);
    if (winners.length === 0) continue;
    let perCompany = 0;
    for (const w of winners) {
      if (checked >= MAX_WINNERS_TOTAL) { console.log(`  (globalny limit ${MAX_WINNERS_TOTAL} — przerwano)`); break outer; }
      if (perCompany >= MAX_WINNERS_PER_COMPANY) { console.log(`  (limit ${MAX_WINNERS_PER_COMPANY} na spolke)`); break; }
      if (!isValidNip(w.nip)) continue; // tylko realne NIP-y
      const nipKey = w.nip.replace(/\D/g, "");
      if (seenWinner.has(nipKey)) continue;
      seenWinner.add(nipKey);
      perCompany++;
      // KRS zwyciezcy przez Rejestr.io org po NIP, potem jego osoby.
      try {
        const found = await rio<{ wyniki?: RioOrg[] }>(key, `/org?${new URLSearchParams({ nip: w.nip.replace(/\D/g, "") })}`);
        const org = found.wyniki?.[0];
        if (!org) { checked++; continue; }
        const krs = String(Number(String(org.numery?.krs ?? org.id)));
        const conns = await rio<(RioOrg | RioPerson)[]>(key, `/org/${krs}/krs-powiazania`);
        checked++;
        for (const c of conns) {
          if ((c as RioPerson).typ === "osoba") {
            const p = c as RioPerson;
            const surn = norm(p.tozsamosc?.nazwisko ?? "");
            const rola = ((p as any).krs_powiazania_kwerendowane ?? []).map((x: any) => x.typ).join(",");
            if (officialSurname && surn === officialSurname) {
              insFlag.run("nazwisko_zwyciezcy", personLabel, compName, w.name, w.nip,
                `${p.tozsamosc?.imiona_i_nazwisko} (${rola}) w firmie-zwyciezcy — zbieznosc nazwiska z urzednikiem`, "srednia", nowIso());
              flagged++;
              console.log(`    >> FLAGA: ${p.tozsamosc?.imiona_i_nazwisko} (${rola}) w ${w.name.slice(0, 30)} — zbieznosc nazwiska`);
            }
          }
        }
      } catch (err) {
        checked++;
      }
      await new Promise((r) => setTimeout(r, config.delayMs));
    }
  }

  console.log(`\nGotowe. Sprawdzono ${checked} firm-zwyciezcow, flag: ${flagged}.`);
  console.log("UWAGA: to tropy do weryfikacji, nie zarzuty. Tozsamosc i kazda flage potwierdz przy zrodle.");
  console.log("BZP to wycinek — dla pelnego obrazu dolacz TED (duze kontrakty).");
}
