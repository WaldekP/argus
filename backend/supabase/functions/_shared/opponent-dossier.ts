/**
 * Teczka oponenta: logika czysta (bez sieci i bez SDK).
 *
 * Tu mieszka wszystko, co decyduje, czy pozycja z odpowiedzi modelu wchodzi
 * do teczki: wyciągnięcie JSON-a z tekstu, normalizacja adresów, walidacja
 * źródła przeciw puli wyników wyszukiwarki i deduplikacja. Wywołania modelu
 * są w `opponent-research.ts`.
 *
 * Zasada nadrzędna: pozycja, której adresu nie zwróciła wyszukiwarka, jest
 * odrzucana. Model potrafi podać wiarygodnie wyglądający adres z pamięci,
 * a polityk wyjdzie z tym cytatem na antenę.
 */

export const DOSSIER_CATEGORIES = [
  "kontrowersja",
  "sprzecznosc-z-programem",
  "zmiana-zdania",
  "zweryfikowane-przez-fakty",
  "wypowiedz",
] as const;

export type DossierCategory = typeof DOSSIER_CATEGORIES[number];

export interface DossierItem {
  id: string;
  date: string | null;
  quote: string;
  context: string;
  source_url: string;
  source_title: string;
  category: DossierCategory;
  why_it_matters: string;
  later_facts: string | null;
  later_facts_url: string | null;
  pass: string;
}

export interface DossierSource {
  url: string;
  title: string;
  page_age: string | null;
}

export interface AttackPoint {
  teza: string;
  item_ids: string[];
  jak_uzyc: string;
  obrona_przeciwnika: string;
}

export interface DossierSummary {
  linia: string;
  punkty_ataku: AttackPoint[];
  czego_unikac: string[];
  luki: string[];
  identity_notes: string[];
  failed_passes: string[];
}

/** Twardy sufit teczki. Powyżej tego to już archiwum, nie materiał przed debatą. */
export const MAX_ITEMS = 80;
const QUOTE_MAX = 600;
const TEXT_MAX = 400;

/**
 * Ostatni blok ```json ...``` z tekstu, a gdy go brak, od pierwszej `{` do
 * ostatniej `}`. Zwraca null, gdy nic nie daje się sparsować.
 *
 * Odpowiedź z wyszukiwaniem przychodzi jako wiele bloków tekstu (cytowania
 * dzielą ją na kawałki), więc wołający skleja je przed wywołaniem.
 */
export function extractJson(text: string): unknown {
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  const candidates: string[] = [];
  if (fences.length > 0) candidates.push(fences[fences.length - 1][1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      // następny kandydat
    }
  }
  return null;
}

/**
 * Klucz porównania adresów: bez protokołu, `www.`, fragmentu, parametrów
 * śledzących i końcowego ukośnika. Model przepisuje adres z wyników
 * z drobnymi różnicami i nie chcemy przez nie odrzucać poprawnej pozycji.
 */
export function urlKey(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const params = [...url.searchParams.entries()]
    .filter(([k]) => !/^(utm_|fbclid|gclid|ref$|src$)/i.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length > 0 ? "?" + new URLSearchParams(params).toString() : "";
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${path}${query}`;
}

function str(value: unknown, max = TEXT_MAX): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return match[3] ? `${match[1]}-${match[2]}-${match[3]}` : `${match[1]}-${match[2]}`;
}

function normalizeCategory(value: unknown): DossierCategory {
  return (DOSSIER_CATEGORIES as readonly string[]).includes(value as string)
    ? value as DossierCategory
    : "wypowiedz";
}

function quoteKey(quote: string): string {
  return quote
    .toLowerCase()
    .replace(/^\[parafraza\]\s*/, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export interface MergeResult {
  items: DossierItem[];
  added: number;
  /** Pozycje odrzucone, bo ich adres nie pochodzi z wyników wyszukiwania. */
  rejectedUnknownSource: number;
  /** Pozycje odrzucone z innych powodów (brak cytatu, duplikat, sufit). */
  rejectedOther: number;
}

/**
 * Dołącza pozycje z jednego przebiegu do teczki.
 *
 * `knownSources` to pula adresów zwróconych przez wyszukiwarkę (we wszystkich
 * przebiegach). Pozycja z adresem spoza puli wypada, tak samo jak duplikat
 * (ten sam adres i ten sam początek cytatu).
 */
export function mergeItems(
  existing: DossierItem[],
  rawItems: unknown,
  knownSources: DossierSource[],
  pass: string,
): MergeResult {
  const items = [...existing];
  const known = new Map<string, DossierSource>();
  for (const source of knownSources) {
    const key = urlKey(source.url);
    if (key) known.set(key, source);
  }
  const seen = new Set(items.map((i) => `${urlKey(i.source_url)}|${quoteKey(i.quote)}`));
  let nextId = items.reduce((max, i) => Math.max(max, Number(i.id.slice(1)) || 0), 0) + 1;

  let added = 0;
  let rejectedUnknownSource = 0;
  let rejectedOther = 0;
  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    if (typeof raw !== "object" || raw === null) {
      rejectedOther += 1;
      continue;
    }
    const row = raw as Record<string, unknown>;
    const quote = str(row.quote, QUOTE_MAX);
    const key = urlKey(str(row.source_url, 2000));
    if (quote.length < 10 || !key) {
      rejectedOther += 1;
      continue;
    }
    const source = known.get(key);
    if (!source) {
      rejectedUnknownSource += 1;
      continue;
    }
    const dedupe = `${key}|${quoteKey(quote)}`;
    if (seen.has(dedupe) || items.length >= MAX_ITEMS) {
      rejectedOther += 1;
      continue;
    }
    seen.add(dedupe);
    const laterKey = urlKey(str(row.later_facts_url, 2000));
    const laterSource = laterKey ? known.get(laterKey) : undefined;
    items.push({
      id: `w${nextId++}`,
      date: normalizeDate(row.date),
      quote,
      context: str(row.context),
      source_url: source.url,
      source_title: str(row.source_title) || source.title,
      category: normalizeCategory(row.category),
      why_it_matters: str(row.why_it_matters),
      // Fakt późniejszy bez źródła z puli nie wchodzi, z tego samego powodu co cytat.
      later_facts: laterSource ? str(row.later_facts) || null : null,
      later_facts_url: laterSource ? laterSource.url : null,
      pass,
    });
    added += 1;
  }
  return { items, added, rejectedUnknownSource, rejectedOther };
}

/**
 * Uzupełnienia z przebiegu weryfikacji („co wydarzyło się później").
 * Zmienia tylko pozycje istniejące i tylko wtedy, gdy fakt ma źródło z puli.
 */
export function applyLaterFacts(
  items: DossierItem[],
  rawUpdates: unknown,
  knownSources: DossierSource[],
): { items: DossierItem[]; applied: number } {
  const known = new Map<string, DossierSource>();
  for (const source of knownSources) {
    const key = urlKey(source.url);
    if (key) known.set(key, source);
  }
  const byId = new Map(items.map((i) => [i.id, { ...i }]));
  let applied = 0;
  for (const raw of Array.isArray(rawUpdates) ? rawUpdates : []) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const item = byId.get(str(row.id, 20));
    const facts = str(row.later_facts);
    const key = urlKey(str(row.later_facts_url, 2000));
    const source = key ? known.get(key) : undefined;
    if (!item || facts === "" || !source) continue;
    item.later_facts = facts;
    item.later_facts_url = source.url;
    if (item.category === "wypowiedz") item.category = "zweryfikowane-przez-fakty";
    applied += 1;
  }
  return { items: items.map((i) => byId.get(i.id) ?? i), applied };
}

/** Dołącza nowe adresy z wyników wyszukiwania do puli (bez duplikatów). */
export function mergeSources(existing: DossierSource[], found: DossierSource[]): DossierSource[] {
  const out = [...existing];
  const seen = new Set(existing.map((s) => urlKey(s.url)));
  for (const source of found) {
    const key = urlKey(source.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

/** Podsumowanie z syntezy, z punktami ataku przyciętymi do istniejących pozycji. */
export function normalizeSummary(
  raw: unknown,
  items: DossierItem[],
  extra: { identity_notes: string[]; failed_passes: string[] },
): DossierSummary {
  const row = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const ids = new Set(items.map((i) => i.id));
  const list = (value: unknown, max: number) =>
    (Array.isArray(value) ? value : []).map((v) => str(v)).filter((v) => v !== "").slice(0, max);
  const points: AttackPoint[] = [];
  for (const p of Array.isArray(row.punkty_ataku) ? row.punkty_ataku : []) {
    if (typeof p !== "object" || p === null) continue;
    const point = p as Record<string, unknown>;
    const itemIds = (Array.isArray(point.item_ids) ? point.item_ids : [])
      .map((v) => str(v, 20))
      .filter((v) => ids.has(v));
    const teza = str(point.teza);
    // Punkt bez pozycji, na której stoi, nie istnieje (zasada 1 promptu syntezy).
    if (teza === "" || itemIds.length === 0) continue;
    points.push({
      teza,
      item_ids: itemIds,
      jak_uzyc: str(point.jak_uzyc),
      obrona_przeciwnika: str(point.obrona_przeciwnika),
    });
    if (points.length >= 7) break;
  }
  return {
    linia: str(row.linia, 1000),
    punkty_ataku: points,
    czego_unikac: list(row.czego_unikac, 5),
    luki: list(row.luki, 5),
    identity_notes: extra.identity_notes.slice(0, 5),
    failed_passes: extra.failed_passes,
  };
}
