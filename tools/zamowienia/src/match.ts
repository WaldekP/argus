// Warstwa powiazan: laczy urzednikow (people/declaration_text) z firmami
// wygrywajacymi przetargi (contractors). Wynik = leady w tabeli `leads`.
//
// ZASADA: to sa TROPY DO WERYFIKACJI PRZEZ CZLOWIEKA, nie zarzuty. Kazdy lead
// niesie fragment dowodowy i typ/pewnosc. Zrodla:
//   'deklaracja' (mocny) — wyrozniajaca nazwa firmy-zwyciezcy wystepuje w tresci
//                          oswiadczenia majatkowego urzednika (co-occurrence).
//   'nazwisko'   (slaby)  — nazwisko urzednika wystepuje jako token w nazwie
//                          firmy-zwyciezcy. Duzo szumu (imiennicy), oznaczone niska.
//
// OCR skanow jest szumny, wiec dopasowanie deklaracji celuje w wyrozniajacy
// token nazwy (>= 5 znakow, nie slowo generyczne), a snippet pozwala ocenic trafnosc.

import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "./db.ts";

// Slowa generyczne (formy prawne, branze, miejsca) — do odsiania z nazw firm.
// Szeroka lista, bo pojedynczy branzowy token (np. "transport") wystepuje i w
// nazwie firmy, i w szablonie oswiadczenia, co daje fałszywe trafienia.
const GENERIC = new Set([
  "spolka", "spółka", "z", "o", "ograniczona", "ograniczoną", "odpowiedzialnoscia",
  "odpowiedzialnością", "sp", "s", "a", "sa", "przedsiebiorstwo", "przedsiębiorstwo",
  "firma", "zaklad", "zakład", "zaklady", "handlowo", "uslugowe", "usługowe", "uslugowo",
  "produkcyjno", "produkcyjne", "i", "w", "ul", "gdansk", "gdańsk", "spzoo", "akcyjna",
  "grupa", "polska", "polski", "centrum", "dom", "biuro", "the", "company", "group",
  "sc", "pph", "phu", "fhu", "ppu", "gmina", "miasto", "miejski", "miejskie",
  // branze / czynnosci (czeste, malo wyrozniajace)
  "transport", "transportowe", "budowlana", "budowlane", "budownictwo", "uslugi", "usługi",
  "handel", "handlowa", "handlowe", "market", "catering", "gastronomia", "gastronomiczne",
  "ochrona", "serwis", "technika", "techniczne", "systemy", "system", "invest", "inwestycje",
  "development", "nieruchomosci", "nieruchomości", "medyczne", "medyczna", "apteka", "energia",
  "produkcja", "dystrybucja", "logistyka", "spedycja", "konsulting", "consulting", "projekt",
  "projekty", "studio", "agencja", "fabryka", "wytwornia", "hurtownia", "sklep", "przewozy",
  "instalacje", "elektro", "eko", "bio", "med", "tech", "pol", "trans", "bud", "gaz",
  "spozywcza", "spożywcza", "rolno", "miedzynarodowy", "krajowy", "zaopatrzenie",
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Wyrozniajace tokeny nazwy firmy: dlugie, nie-generyczne. */
function distinctiveTokens(name: string): string[] {
  return [...new Set(norm(name).split(" "))].filter((t) => t.length >= 5 && !GENERIC.has(t));
}

interface Winner { nip: string | null; name: string; wins: number; }
interface Decl { person_id: number; person: string; role: string | null; text: string; }

export function runMatch(db: DatabaseSync): void {
  db.exec("DELETE FROM leads");
  const insert = db.prepare(`
    INSERT OR IGNORE INTO leads (person_id, contractor_nip, contractor_name, kind, confidence, wins, snippet, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Firmy-zwyciezcy z liczba wygranych.
  const winners = db.prepare(`
    SELECT nip, name, COUNT(*) wins FROM contractors
    WHERE name IS NOT NULL GROUP BY COALESCE(nip, name)
  `).all() as unknown as Winner[];

  // Rozczytane deklaracje (tekst).
  const decls = db.prepare(`
    SELECT pf.person_id AS person_id, p.name AS person, p.role AS role, dt.text AS text
    FROM declaration_text dt JOIN person_files pf ON pf.id = dt.person_file_id
    JOIN people p ON p.id = pf.person_id
    WHERE dt.status = 'ocr_ok' AND dt.text IS NOT NULL
  `).all() as unknown as (Decl & { person_id: number })[];

  // Frazy sekcji majatkowych, w ktorych deklaruje sie firmy (OCR-tolerancyjne,
  // na znormalizowanym tekscie). Bierzemy okno tresci ZA fraza — tam sa nazwy.
  const SECTION_RE = new RegExp(
    "(udzialy w spolkach|akcje w spolkach|w spolkach handlowych|dzialalnosc gospodarcz|" +
    "zarzadzam dzialalnosci|jestem czlonkiem zarzadu|w fundacjach|w stowarzyszeniach|" +
    "pelnomocnikiem takiej dzialalnosci)",
    "g",
  );
  const WINDOW = 260;

  // Per osoba: "strefa deklaracji" = sklejone okna tresci z sekcji o firmach.
  // Dopasowujemy TYLKO w tej strefie, nie w calym (szumnym) tekscie formularza.
  const declByPerson = new Map<number, { person: string; role: string | null; zoneNorm: string; zoneRaw: string }>();
  for (const d of decls) {
    const ntext = norm(d.text);
    let zoneNorm = "";
    let zoneRaw = "";
    for (const m of ntext.matchAll(SECTION_RE)) {
      const i = m.index ?? 0;
      zoneNorm += " " + ntext.slice(i, i + WINDOW);
      zoneRaw += " … " + d.text.slice(Math.max(0, i - 10), i + WINDOW);
    }
    const prev = declByPerson.get(d.person_id);
    declByPerson.set(d.person_id, {
      person: d.person, role: d.role,
      zoneNorm: (prev?.zoneNorm ?? "") + zoneNorm,
      zoneRaw: (prev?.zoneRaw ?? "") + zoneRaw,
    });
  }

  const now = nowIso();
  let strong = 0;
  // Lead 'deklaracja' — wysoka precyzja. Dopasowanie tylko gdy:
  //   (a) NIP firmy wystepuje wprost w tresci (najmocniej), albo
  //   (b) wspolwystepuja >=2 wyrozniajace tokeny nazwy, albo
  //   (c) jeden bardzo dlugi (>=7) wyrozniajacy token.
  // To odsiewa trafienia w slowa z szablonu formularza (wspolne wszystkim).
  const ADJ = 45; // dwa tokeny firmy musza stac blisko siebie (nie rozproszone)
  for (const w of winners) {
    const tokens = distinctiveTokens(w.name);
    if (tokens.length === 0) continue;
    for (const [pid, d] of declByPerson) {
      if (!d.zoneNorm) continue;
      let matched: { conf: string; at: number } | null = null;
      // Multi-token: dwa wyrozniajace tokeny w odleglosci <= ADJ znakow.
      const positions = tokens
        .map((t) => ({ t, i: d.zoneNorm.indexOf(t) }))
        .filter((x) => x.i >= 0)
        .sort((a, b) => a.i - b.i);
      for (let k = 1; k < positions.length; k++) {
        if (positions[k].i - positions[k - 1].i <= ADJ) {
          matched = { conf: "srednia", at: positions[k - 1].i };
          break;
        }
      }
      // Pojedynczy, bardzo dlugi token (>=9) tez akceptujemy (np. INNOBALTICA).
      if (!matched) {
        const longTok = tokens.find((t) => t.length >= 9 && d.zoneNorm.includes(t));
        if (longTok) matched = { conf: "niska", at: d.zoneNorm.indexOf(longTok) };
      }
      if (!matched) continue;
      const snippet = d.zoneRaw.slice(Math.max(0, matched.at - 30), matched.at + 100).replace(/\s+/g, " ").trim();
      insert.run(pid, w.nip, w.name, "deklaracja", matched.conf, w.wins, snippet, now);
      strong++;
    }
  }

  // Lead 'nazwisko' (slaby): nazwisko urzednika jako token w nazwie firmy.
  const people = db.prepare("SELECT id, name FROM people").all() as { id: number; name: string }[];
  let weak = 0;
  for (const p of people) {
    const surname = norm(p.name).split(" ")[0]; // format "Nazwisko Imie..."
    if (!surname || surname.length < 5 || GENERIC.has(surname)) continue;
    for (const w of winners) {
      if (norm(w.name).split(" ").includes(surname)) {
        insert.run(p.id, w.nip, w.name, "nazwisko", "niska", w.wins, `nazwisko "${surname}" w nazwie firmy`, now);
        weak++;
      }
    }
  }

  console.log(`Leady: ${strong} z deklaracji (srednia), ${weak} po nazwisku (niska).`);
  console.log("To TROPY DO WERYFIKACJI, nie zarzuty. Sprawdz snippet i skan zrodlowy.");
}
