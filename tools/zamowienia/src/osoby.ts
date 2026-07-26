// Harvester osob z oswiadczen majatkowych BIP Gdanska.
//
// Struktura (odkryta rekonesansem): rok -> kategoria -> osoba -> PDF.
//   rok:      /prawo-lokalne/Oswiadczenia-2024-rok,a,256573
//   kategoria: Prezydent / Zastepcy / Sekretarz / Skarbnik / Radni /
//              Kierownicy jednostek / Osoby wydajace decyzje / Osoby zarzadzajace
//   osoba:    /prawo-lokalne/Banach-Jolanta-Maria,a,269700  (NAZWISKO w tekscie!)
//
// Nazwiska sa strukturalne, wiec indeks osob powstaje BEZ OCR. PDF-y zapisujemy
// jako odnosniki (person_files) pod pozniejszy OCR tresci (zadeklarowane spolki).
//
// UWAGA (RODO/etyka): to publiczne oswiadczenia osob pelniacych funkcje publiczne.
// Sluza analizie kontrolnej; wynik to tropy do weryfikacji przez czlowieka.

import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";

const BASE = "https://bip.gdansk.pl";

// Strony roczne (z rekonesansu). Klucz = rok.
const YEAR_PAGES: Record<number, string> = {
  2020: `${BASE}/prawo-lokalne/Oswiadczenia-2020-rok,a,108527`,
  2021: `${BASE}/prawo-lokalne/Oswiadczenia-2021,a,194930`,
  2022: `${BASE}/prawo-lokalne/Oswiadczenia-2022-rok,a,219194`,
  2023: `${BASE}/prawo-lokalne/Oswiadczenia-2023-rok,a,235858`,
  2024: `${BASE}/prawo-lokalne/Oswiadczenia-2024-rok,a,256573`,
  2025: `${BASE}/prawo-lokalne/Oswiadczenia-2025-rok,a,277888`,
  2026: `${BASE}/prawo-lokalne/Oswiadczenia-2026-rok,a,302844`,
};

// Tekst linku wskazujacy KATEGORIE (rola), nie osobe.
const ROLE_RE = /prezydent|zastępc|sekretarz|skarbnik|przewodnicząc|radn|kierownic|osoby wydając|osoby zarządzając|członkowie organów/i;
// Link nawigacyjny miedzy rocznikami (pomijamy).
const YEAR_NAV_RE = /oświadczenia\s*-?\s*20\d\d|oświadczenia majątkowe/i;
// Nazwisko: "Slowo Slowo[...]" z wielkich liter (min. imie+nazwisko).
const PERSON_RE = /^[A-ZĄĆĘŁŃÓŚŹŻ][\wąćęłńóśźż-]+(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][\wąćęłńóśźż-]+){1,3}$/;
// Strony grupujace jednostki (nie osoby): "Pracownicy X", "Wydzial ...", itp.
// Ich osoby siedza poziom glebiej (do dobrania w refinemencie).
const GROUP_RE = /^(pracownicy|wydział|biuro|zespół|centrum|urząd|dyrekcja|gdański|miejski|referat|dział)\b/i;

interface Link { href: string; text: string; }

function cleanUrl(href: string): string | null {
  // CMS Gdanska wstawia zdublowany prefiks "/https://bip.gdansk.pl/...".
  let h = href.replace(/^\/https?:\/\/[^/]*bip\.gdansk\.pl/i, "");
  if (h.startsWith("/")) h = BASE + h;
  if (!/^https?:\/\//.test(h)) return null;
  try {
    const u = new URL(h);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function mainLinks(html: string): Link[] {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  return [...main.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({
      href: m[1],
      text: m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    }))
    .filter((l) => l.text.length > 1);
}

function normName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": config.userAgent },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function pdfLinks(links: Link[]): Link[] {
  return links.filter(
    (l) =>
      /download\.cloudgdansk|\.pdf(?=$|[?#])/i.test(l.href) &&
      // footer/accessibility PDF obecny na kazdej stronie
      !/informacja-o-urzedzie-miejskim-w-gdansku-w-etr/i.test(l.href),
  );
}

export async function runOsoby(
  db: DatabaseSync,
  opts: { fromYear?: number; toYear?: number },
): Promise<void> {
  const fromYear = opts.fromYear ?? config.defaultFromYear;
  const toYear = opts.toYear ?? new Date().getUTCFullYear();
  console.log(`Harvester osob z oswiadczen: lata ${fromYear}-${toYear}`);

  const upPerson = db.prepare(`
    INSERT INTO people (name, name_norm, role, year, page_url, source, first_seen_at)
    VALUES (?, ?, ?, ?, ?, 'oswiadczenia_bip_gdansk', ?)
    ON CONFLICT(name, role, year) DO UPDATE SET page_url = excluded.page_url
  `);
  const findPerson = db.prepare("SELECT id FROM people WHERE name=? AND role=? AND year=?");
  const insFile = db.prepare(
    "INSERT OR IGNORE INTO person_files (person_id, url, link_text) VALUES (?, ?, ?)",
  );

  let totalPeople = 0;
  for (let year = fromYear; year <= toYear; year++) {
    const yearUrl = YEAR_PAGES[year];
    if (!yearUrl) continue;
    let yearHtml: string;
    try {
      yearHtml = await getHtml(yearUrl);
    } catch (err) {
      console.log(`  rok ${year}: nieosiagalny (${err instanceof Error ? err.message : err})`);
      continue;
    }

    // Kategorie: linki z tekstem-rola, nie nawigacja roczna.
    const seenCat = new Set<string>();
    const categories = mainLinks(yearHtml)
      .filter((l) => ROLE_RE.test(l.text) && !YEAR_NAV_RE.test(l.text))
      .map((l) => ({ url: cleanUrl(l.href), role: l.text }))
      .filter((c): c is { url: string; role: string } => !!c.url && !seenCat.has(c.url) && (seenCat.add(c.url), true));

    let yearPeople = 0;
    for (const cat of categories) {
      await new Promise((r) => setTimeout(r, config.delayMs));
      let catHtml: string;
      try {
        catHtml = await getHtml(cat.url);
      } catch {
        continue;
      }
      // Osoby: linki z nazwiskiem, nie kategorie/nawigacja.
      const seenP = new Set<string>();
      const persons = mainLinks(catHtml)
        .filter((l) => PERSON_RE.test(l.text) && !ROLE_RE.test(l.text) && !YEAR_NAV_RE.test(l.text) && !GROUP_RE.test(l.text))
        .map((l) => ({ url: cleanUrl(l.href), name: l.text }))
        .filter((p): p is { url: string; name: string } => !!p.url && !seenP.has(p.name) && (seenP.add(p.name), true));

      for (const p of persons) {
        upPerson.run(p.name, normName(p.name), cat.role, year, p.url, nowIso());
        const row = findPerson.get(p.name, cat.role, year) as { id: number } | undefined;
        if (!row) continue;
        yearPeople++;
        // PDF-y osoby (odnosniki pod pozniejszy OCR).
        await new Promise((r) => setTimeout(r, config.delayMs));
        try {
          const pHtml = await getHtml(p.url);
          for (const f of pdfLinks(mainLinks(pHtml))) {
            const url = cleanUrl(f.href);
            if (url) insFile.run(row.id, url, f.text || null);
          }
        } catch {
          /* brak PDF to nie blad krytyczny dla indeksu */
        }
      }
      console.log(`  ${year} / ${cat.role.slice(0, 40)}: ${persons.length} osob`);
    }
    totalPeople += yearPeople;
    console.log(`  == rok ${year}: ${yearPeople} osob (${categories.length} kategorii)`);
  }

  const uniq = db.prepare("SELECT COUNT(DISTINCT name_norm) c FROM people").get() as { c: number };
  const files = db.prepare("SELECT COUNT(*) c FROM person_files").get() as { c: number };
  console.log(`\nGotowe. Wpisow osoba-rok-rola: ${totalPeople}, unikalnych osob: ${uniq.c}, PDF-ow: ${files.c}`);
}
