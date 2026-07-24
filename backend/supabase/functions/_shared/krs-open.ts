// Klient otwartego API KRS Ministerstwa Sprawiedliwości (api-krs.ms.gov.pl).
// Darmowe, bez klucza i bez rejestracji, podstawa prawna: art. 4b ust. 2 ustawy
// o KRS w związku z ustawą o otwartych danych.
//
// Ograniczenie, przez które to API nie zastępuje Rejestr.io: dane osób
// fizycznych są zamaskowane ("K*******", PESEL "7**********"). Nie da się z
// niego zbudować powiązań osobowych.
//
// Rola w Argusie: DARMOWY DETEKTOR ZMIAN. Biuletyn dzienny zwraca numery KRS
// zmienione danego dnia, więc płatne Rejestr.io wołamy tylko dla obserwowanych
// podmiotów, które faktycznie się zmieniły.
//
// Kontrakt: docs/kontrakt-rejestr-krs.md

const BASE_URL = "https://api-krs.ms.gov.pl/api";

// Nieoficjalny limit po stronie MS to ok. 100 zapytań na 15 minut z jednego IP.
// Biuletyn wołamy raz dziennie, więc mieścimy się z zapasem.
const REQUEST_TIMEOUT_MS = 30_000;

export type KrsRegister = "P" | "S";

async function getJson<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
    });
    // Brak podmiotu w danym rejestrze: API zwraca raz 404, raz 204 z pustym
    // ciałem. Oba traktujemy jako "nie ma".
    if (response.status === 404 || response.status === 204) return null;
    if (!response.ok) {
      throw new Error(`Otwarte API KRS (${response.status}) dla ${path}`);
    }
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

// Numery KRS zmienione danego dnia. Powtórzenia w tablicy oznaczają liczbę
// zmian, dlatego zwracamy unikalny, znormalizowany zbiór.
export async function getDailyBulletin(day: string): Promise<Set<string>> {
  const raw = await getJson<string[]>(`/Krs/Biuletyn/${day}`);
  const result = new Set<string>();
  for (const entry of raw ?? []) {
    const digits = String(entry).replace(/\D/g, "");
    if (digits) result.add(digits.padStart(10, "0"));
  }
  return result;
}

export interface KrsHeader {
  numerKRS?: string;
  stanZDnia?: string;
  dataOstatniegoWpisu?: string;
  numerOstatniegoWpisu?: number;
  oznaczenieSaduDokonujacegoOstatniegoWpisu?: string;
}

export interface KrsExtract {
  odpis: {
    rodzaj: string;
    naglowekA?: KrsHeader;
    naglowekP?: KrsHeader;
    dane: Record<string, unknown>;
  };
}

// Odpis aktualny. Podmiot jest tylko w jednym rejestrze (P albo S), a parametr
// jest obowiązkowy, więc przy nieznanym podmiocie próbujemy obu.
export async function getCurrentExtract(
  krs: string,
  register?: KrsRegister,
): Promise<{ register: KrsRegister; extract: KrsExtract } | null> {
  const registers: KrsRegister[] = register ? [register] : ["P", "S"];
  for (const rej of registers) {
    const extract = await getJson<KrsExtract>(
      `/krs/OdpisAktualny/${krs}?rejestr=${rej}&format=json`,
    );
    if (extract?.odpis) return { register: rej, extract };
  }
  return null;
}

// Skrót zmiany do opisu zdarzenia. Otwarte API nie mówi, CO się zmieniło,
// tylko że był nowy wpis, więc opis budujemy z nagłówka odpisu.
export function describeLatestEntry(extract: KrsExtract): string {
  const header = extract.odpis?.naglowekA ?? extract.odpis?.naglowekP ?? {};
  const number = header.numerOstatniegoWpisu;
  const date = header.dataOstatniegoWpisu;
  if (!number && !date) return "Nowy wpis w KRS. Brak danych o szczegółach.";
  return `Wpis nr ${number ?? "brak danych"} z dnia ${date ?? "brak danych"}.`;
}

// ---------------------------------------------------------------------------
// Wyciąganie szczegółów podmiotu z odpisu (wszystko darmowe)
// ---------------------------------------------------------------------------

// Daty w odpisie są w formacie DD.MM.RRRR, baza chce RRRR-MM-DD.
function toIsoDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

// Kwoty w odpisie mają polski separator dziesiętny: "46580831,00".
function toNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface FinancialFiling {
  period_start: string;
  period_end: string;
  filed_on: string | null;
}

// Okres w polu zaOkresOdDo jest tekstem swobodnym i w praktyce występuje
// w kilku wariantach zapisu, np.:
//   "OD 01.01.2025 DO 31.12.2025"
//   "ZA OKRES OD 01.01.2000 R. - 31.12.2000 R., ZŁOŻONO DNIA"
//   "01. 01. 2001r. - 31. 12. 2001r."
// Dlatego nie parsujemy struktury, tylko wyciągamy dwie pierwsze daty.
const DATE_IN_TEXT = /(\d{2})[.\s]*(\d{2})[.\s]*(\d{4})/g;

export function parseFinancialFilings(extract: KrsExtract): FinancialFiling[] {
  const dzial3 = (extract.odpis?.dane?.dzial3 ?? {}) as Record<string, unknown>;
  const mentions = (dzial3.wzmiankiOZlozonychDokumentach ?? {}) as Record<string, unknown>;
  const rows = mentions.wzmiankaOZlozeniuRocznegoSprawozdaniaFinansowego;
  if (!Array.isArray(rows)) return [];

  const filings: FinancialFiling[] = [];
  for (const row of rows as { dataZlozenia?: string; zaOkresOdDo?: string }[]) {
    const dates = [...(row.zaOkresOdDo ?? "").matchAll(DATE_IN_TEXT)];
    if (dates.length < 2) continue;
    const [start, end] = dates;
    filings.push({
      period_start: `${start[3]}-${start[2]}-${start[1]}`,
      period_end: `${end[3]}-${end[2]}-${end[1]}`,
      filed_on: toIsoDate(row.dataZlozenia),
    });
  }
  // Najnowszy okres pierwszy: interfejs pokazuje ostatnie sprawozdanie.
  return filings.sort((a, b) => b.period_end.localeCompare(a.period_end));
}

export interface OrgDetails {
  capital_amount: number | null;
  capital_currency: string | null;
  registered_on: string | null;
  last_entry_on: string | null;
  last_entry_number: number | null;
  pkd_all: { code: string; description: string; main: boolean }[];
  legal_form: string | null;
  name_full: string | null;
  filings: FinancialFiling[];
}

function pkdCode(entry: Record<string, unknown>): string {
  const parts = [entry.kodDzial, entry.kodKlasa, entry.kodPodklasa]
    .filter((p) => typeof p === "string" && p);
  if (parts.length < 3) return String(entry.kodDzial ?? "");
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

export function parseOrgDetails(extract: KrsExtract): OrgDetails {
  const odpis = extract.odpis;
  const header = odpis?.naglowekA ?? odpis?.naglowekP ?? {};
  const dzial1 = (odpis?.dane?.dzial1 ?? {}) as Record<string, unknown>;
  const dzial3 = (odpis?.dane?.dzial3 ?? {}) as Record<string, unknown>;
  const entity = (dzial1.danePodmiotu ?? {}) as Record<string, unknown>;
  const capital = ((dzial1.kapital ?? {}) as Record<string, unknown>)
    .wysokoscKapitaluZakladowego as { wartosc?: string; waluta?: string } | undefined;
  const activity = (dzial3.przedmiotDzialalnosci ?? {}) as Record<string, unknown>;

  const pkd: OrgDetails["pkd_all"] = [];
  for (const [key, main] of [
    ["przedmiotPrzewazajacejDzialalnosci", true],
    ["przedmiotPozostalejDzialalnosci", false],
  ] as const) {
    for (const entry of (activity[key] as Record<string, unknown>[] ?? [])) {
      pkd.push({
        code: pkdCode(entry),
        description: String(entry.opis ?? "brak danych"),
        main,
      });
    }
  }

  return {
    capital_amount: toNumber(capital?.wartosc),
    capital_currency: capital?.waluta ?? null,
    registered_on: toIsoDate(header.dataRejestracjiWKRS),
    last_entry_on: toIsoDate(header.dataOstatniegoWpisu),
    last_entry_number: header.numerOstatniegoWpisu ?? null,
    pkd_all: pkd,
    legal_form: typeof entity.formaPrawna === "string" ? entity.formaPrawna : null,
    name_full: typeof entity.nazwa === "string" ? entity.nazwa : null,
    filings: parseFinancialFilings(extract),
  };
}
