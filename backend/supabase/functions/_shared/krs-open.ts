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
