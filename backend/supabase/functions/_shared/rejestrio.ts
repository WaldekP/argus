// Klient Rejestr.io API v2 (płatne, per wywołanie z salda konta w PLN).
// Dokumentacja: https://rejestr.io/api
//
// Klucz: sekret Edge Functions REJESTRIO_API_KEY, ustawiany przez
// `supabase secrets set`. Nigdy w kodzie i nigdy w bundlu klienta.
//
// Kontrakt: docs/kontrakt-rejestr-krs.md
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HttpError } from "./auth.ts";

const BASE_URL = "https://rejestr.io/api/v2";

// Twardy bezpiecznik: poniżej tego salda przestajemy wołać płatne endpointy.
// Chodzi o to, żeby pętla z błędem nie wyczyściła konta do zera w tle.
const MIN_BALANCE_PLN = 5;

// Ile sekund cache'ujemy saldo, żeby nie odpytywać go przy każdym wywołaniu.
const BALANCE_CACHE_MS = 60_000;

let balanceCache: { value: number; at: number } | null = null;

function apiKey(): string {
  const key = Deno.env.get("REJESTRIO_API_KEY");
  if (!key) {
    throw new HttpError(
      503,
      "Integracja z rejestrem sądowym jest nieskonfigurowana (brak REJESTRIO_API_KEY).",
    );
  }
  return key;
}

export interface CallContext {
  supabase: SupabaseClient;
  tenantId?: string | null;
  userId?: string | null;
}

async function logCall(
  ctx: CallContext | undefined,
  endpoint: string,
  status: number | null,
  durationMs: number,
  error: string | null,
) {
  if (!ctx) return;
  // Audyt kosztów nie może wywrócić operacji użytkownika, stąd cichy catch.
  await ctx.supabase.from("registry_api_calls").insert({
    tenant_id: ctx.tenantId ?? null,
    user_id: ctx.userId ?? null,
    provider: "rejestrio",
    endpoint,
    http_status: status,
    balance_after: balanceCache?.value ?? null,
    duration_ms: durationMs,
    error,
  }).then(() => {}, () => {});
}

async function request<T>(
  path: string,
  ctx?: CallContext,
  opts: { paid?: boolean } = {},
): Promise<T> {
  const paid = opts.paid !== false;
  if (paid) await assertBudget(ctx);

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: apiKey() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logCall(ctx, path, null, Date.now() - started, message);
    throw new HttpError(502, `Rejestr sądowy nie odpowiada: ${message}`);
  }

  const durationMs = Date.now() - started;
  const text = await response.text();

  if (!response.ok) {
    let info = text;
    try {
      info = (JSON.parse(text) as { info?: string }).info ?? text;
    } catch { /* odpowiedź nie jest JSON-em, zostaw surowy tekst */ }
    await logCall(ctx, path, response.status, durationMs, info);

    if (response.status === 401) {
      throw new HttpError(503, "Klucz Rejestr.io został odrzucony.");
    }
    if (response.status === 403) {
      // Dane historyczne i data urodzenia wymagają abonamentu premium.
      throw new HttpError(403, `Rejestr.io: ${info}`);
    }
    if (response.status === 402 || /saldo|środk/i.test(info)) {
      throw new HttpError(402, "Wyczerpane środki na koncie Rejestr.io.");
    }
    throw new HttpError(502, `Rejestr.io (${response.status}): ${info}`);
  }

  await logCall(ctx, path, response.status, durationMs, null);
  if (paid) balanceCache = null; // saldo się zmieniło, wymuś ponowny odczyt
  return JSON.parse(text) as T;
}

// Odczyt salda jest darmowy i ma opóźnienie do kilku minut.
export async function getBalance(ctx?: CallContext): Promise<number> {
  const now = Date.now();
  if (balanceCache && now - balanceCache.at < BALANCE_CACHE_MS) {
    return balanceCache.value;
  }
  const raw = await request<string | number>("/konto/stan", ctx, { paid: false });
  const value = Number(raw);
  balanceCache = { value, at: now };
  return value;
}

async function assertBudget(ctx?: CallContext) {
  const balance = await getBalance(ctx);
  if (balance < MIN_BALANCE_PLN) {
    throw new HttpError(
      402,
      `Saldo konta Rejestr.io (${balance.toFixed(2)} zł) spadło poniżej progu ` +
        `bezpieczeństwa ${MIN_BALANCE_PLN} zł. Doładuj konto, żeby wznowić ` +
        `pobieranie danych z rejestru.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Kształt odpowiedzi (tylko pola, których faktycznie używamy)
// ---------------------------------------------------------------------------

export interface RioPerson {
  id: number;
  typ: "osoba";
  tozsamosc: {
    imie: string;
    drugie_imiona?: string;
    nazwisko: string;
    imiona_i_nazwisko: string;
    plec?: string;
    data_urodzenia?: string; // tylko z abonamentem premium
  };
  krs_powiazania_liczby?: {
    aktualne?: number;
    aktualne_organizacje?: number;
    przeszle?: number;
  };
  organizacje_skrot?: { id: number; nazwa_skrocona: string }[];
}

export interface RioOrg {
  id: number;
  typ: "organizacja";
  nazwy: { pelna: string; skrocona?: string };
  numery: { krs?: string | number; nip?: string | number; regon?: string | number };
  adres?: Record<string, unknown>;
  stan?: {
    forma_prawna?: string;
    pkd_przewazajace_dzial?: string;
    czy_wykreslona?: boolean;
    czy_spolka_skarbu_panstwa?: boolean;
    czy_pozytku_publicznego?: boolean;
    czy_jest_na_gpw?: boolean;
    w_likwidacji?: boolean;
    w_upadlosci?: boolean;
    w_zawieszeniu?: boolean;
    wielkosc?: string;
  };
  // Obecne tylko w odpowiedzi na zapytanie o powiązania: jak dany podmiot
  // wiąże się z podmiotem, o który pytaliśmy.
  krs_powiazania_kwerendowane?: {
    typ: string;
    kierunek?: string;
    data_start?: string | null;
    data_koniec?: string | null;
  }[];
}

interface RioSearchResponse<T> {
  liczba_wszystkich_wynikow: number;
  wyniki: T[];
}

// ---------------------------------------------------------------------------
// Operacje
// ---------------------------------------------------------------------------

// Wyszukiwanie osoby po imieniu i nazwisku.
// UWAGA: zwraca imienników i nie ma pola pozwalającego ich rozróżnić
// (data urodzenia wymaga abonamentu premium). Wynik jest listą kandydatów
// do ręcznego potwierdzenia, nigdy gotowym dopasowaniem.
export async function searchPersons(
  firstName: string,
  lastName: string,
  ctx?: CallContext,
): Promise<RioPerson[]> {
  const query = new URLSearchParams({ imie: firstName, nazwisko: lastName });
  const res = await request<RioSearchResponse<RioPerson>>(
    `/osoby?${query}`,
    ctx,
  );
  return res.wyniki ?? [];
}

export function getPerson(id: number, ctx?: CallContext): Promise<RioPerson> {
  return request<RioPerson>(`/osoby/${id}`, ctx);
}

// Aktualne powiązania osoby z organizacjami w KRS.
// Powiązania historyczne (aktualnosc=historyczne) wymagają abonamentu premium
// i na koncie testowym zwracają 403.
export function getPersonConnections(
  id: number,
  ctx?: CallContext,
): Promise<RioOrg[]> {
  return request<RioOrg[]>(`/osoby/${id}/krs-powiazania`, ctx);
}

export async function searchOrgs(
  criteria: { nazwa?: string; nip?: string; regon?: string },
  ctx?: CallContext,
): Promise<RioOrg[]> {
  const query = new URLSearchParams();
  if (criteria.nazwa) query.set("nazwa", criteria.nazwa);
  if (criteria.nip) query.set("nip", criteria.nip);
  if (criteria.regon) query.set("regon", criteria.regon);
  const res = await request<RioSearchResponse<RioOrg>>(`/org?${query}`, ctx);
  return res.wyniki ?? [];
}

// Id organizacji w Rejestr.io to numer KRS bez wiodących zer.
export function getOrg(krs: string, ctx?: CallContext): Promise<RioOrg> {
  return request<RioOrg>(`/org/${String(Number(krs))}`, ctx);
}

// Powiązania organizacji: zwraca mieszankę osób i organizacji.
export function getOrgConnections(
  krs: string,
  ctx?: CallContext,
): Promise<(RioOrg | RioPerson)[]> {
  return request<(RioOrg | RioPerson)[]>(
    `/org/${String(Number(krs))}/krs-powiazania`,
    ctx,
  );
}

// ---------------------------------------------------------------------------
// Normalizacja do modelu Argusa
// ---------------------------------------------------------------------------

// Numer KRS w bazie trzymamy zawsze jako 10 znaków z wiodącymi zerami,
// bo tak wygląda w otwartym API MS i tak go widzi użytkownik.
export function normalizeKrs(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(10, "0");
}

export function orgToRow(org: RioOrg) {
  const krs = normalizeKrs(org.numery?.krs ?? org.id);
  if (!krs) return null;
  return {
    krs,
    rejestrio_id: org.id,
    name_full: org.nazwy?.pelna ?? "brak danych",
    name_short: org.nazwy?.skrocona ?? null,
    nip: org.numery?.nip ? String(org.numery.nip) : null,
    regon: org.numery?.regon ? String(org.numery.regon) : null,
    legal_form: org.stan?.forma_prawna ?? null,
    pkd_main_section: org.stan?.pkd_przewazajace_dzial ?? null,
    address: org.adres ?? {},
    status: org.stan ?? {},
    raw: org as unknown as Record<string, unknown>,
    source: "rejestrio",
    synced_at: new Date().toISOString(),
  };
}

export function personToRow(person: RioPerson) {
  const t = person.tozsamosc ?? { imie: "", nazwisko: "", imiona_i_nazwisko: "" };
  return {
    rejestrio_id: person.id,
    first_name: t.imie ?? "brak danych",
    middle_names: t.drugie_imiona || null,
    last_name: t.nazwisko ?? "brak danych",
    full_name: t.imiona_i_nazwisko ?? `${t.imie} ${t.nazwisko}`.trim(),
    connections_current: person.krs_powiazania_liczby?.aktualne ?? 0,
    connections_past: person.krs_powiazania_liczby?.przeszle ?? 0,
    raw: person as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  };
}

// Etykiety ról po polsku. Nieznany typ pokazujemy surowo, zamiast zgadywać.
const ROLE_LABELS: Record<string, string> = {
  KRS_BOARD: "zarząd",
  KRS_SUPERVISION: "rada nadzorcza",
  KRS_SHAREHOLDER: "wspólnik lub akcjonariusz",
  KRS_PROXY: "prokura",
  KRS_PARTNER: "wspólnik spółki osobowej",
  KRS_LIQUIDATOR: "likwidator",
  KRS_FOUNDER: "fundator",
  KRS_REPRESENTATIVE: "reprezentant",
  KRS_BENEFICIARY: "beneficjent rzeczywisty",
};

export function roleLabel(roleType: string): string {
  return ROLE_LABELS[roleType] ?? roleType;
}
