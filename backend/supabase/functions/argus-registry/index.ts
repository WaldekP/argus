// argus-registry — powiązania z Krajowego Rejestru Sądowego.
// Operacje: balance, search_person, link_person, list_subjects, unlink,
// get_connections, refresh_connections, search_org, get_org_details, link_org,
// list_events, mark_event_seen, check_conflicts, scan_changes.
//
// Dwa źródła danych, świadomie rozdzielone kosztem:
//   - otwarte API KRS (darmowe) wykrywa, że coś się zmieniło,
//   - Rejestr.io (płatne) dostarcza nazwiska i sieć powiązań.
//
// Zasada bezpieczeństwa: wyszukiwanie osoby po imieniu i nazwisku zwraca
// imienników i NIE MA pola pozwalającego ich rozróżnić. Dlatego żadne
// powiązanie nie jest przypisywane automatycznie. Człowiek potwierdza
// tożsamość, a my zapisujemy kto i kiedy.
//
// Kontrakt: docs/kontrakt-rejestr-krs.md
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/types.ts";
import {
  type CallContext,
  getBalance,
  getOrg,
  normalizeKrs,
  personToRow,
  roleLabel,
  searchOrgs,
  searchPersons,
} from "../_shared/rejestrio.ts";
import {
  enrichOrgFromOpenKrs,
  findPotentialConflicts,
  findRelatedVotes,
  isStale,
  scanBulletin,
  syncFinancials,
  syncOrgPeople,
  syncPersonConnections,
  syncWatchesForSubject,
  upsertOrg,
} from "../_shared/registry.ts";
import { getGenerationModel, loadPrompt } from "../_shared/ai.ts";
import { embedText } from "../_shared/embeddings.ts";
import { z } from "npm:zod";

const SUBJECT_TYPES = ["politician", "journalist", "outlet", "other"] as const;
type SubjectType = typeof SUBJECT_TYPES[number];

// Ile spółek wzbogacamy z darmowego API MS w jednym wywołaniu. Otwarte API
// ministerstwa ma nieoficjalny limit ok. 100 zapytań na 15 minut z jednego IP,
// a wzbogacenie jednej spółki to jedno lub dwa zapytania (rejestr P, potem S).
const ENRICH_PER_CALL = 12;

function requireString(value: unknown, field: string, min = 1): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min) {
    throw new HttpError(400, `Pole ${field} jest wymagane.`);
  }
  return text;
}

function requireSubjectType(value: unknown): SubjectType {
  if (!SUBJECT_TYPES.includes(value as SubjectType)) {
    throw new HttpError(400, `Nieprawidłowy typ podmiotu: ${String(value)}`);
  }
  return value as SubjectType;
}

// Rozbicie pełnego imienia i nazwiska. Rejestr.io wymaga obu pól osobno,
// a w Argusie polityk ma jedno pole full_name.
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    throw new HttpError(400, "Podaj imię i nazwisko, oddzielone spacją.");
  }
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

async function logAccess(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  action: string,
  resource: string | null,
) {
  await supabase.from("access_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    action,
    resource,
  });
}

// ---------------------------------------------------------------------------
// Operacje
// ---------------------------------------------------------------------------

// Stan konta w płatnym API. Darmowe, pokazujemy w ustawieniach, żeby
// wyczerpane środki nie objawiały się jako tajemniczy błąd.
async function opBalance(ctx: CallContext) {
  const balance = await getBalance(ctx);
  const { count } = await ctx.supabase
    .from("registry_api_calls")
    .select("id", { count: "exact", head: true })
    .eq("provider", "rejestrio");
  return { balance_pln: balance, calls_total: count ?? 0 };
}

// Wyszukanie kandydatów. Zwraca listę do ręcznego wyboru, nigdy jednego wyniku
// "na pewno". Pole ostrzezenie mówi interfejsowi, kiedy podkreślić ryzyko.
async function opSearchPerson(
  ctx: CallContext,
  body: { query?: unknown; first_name?: unknown; last_name?: unknown },
) {
  const { firstName, lastName } = typeof body.query === "string" && body.query.trim()
    ? splitName(body.query as string)
    : {
      firstName: requireString(body.first_name, "first_name", 2),
      lastName: requireString(body.last_name, "last_name", 2),
    };

  const persons = await searchPersons(firstName, lastName, ctx);

  // Cache osób: pozwala pokazać liczbę powiązań bez ponownego wywołania.
  if (persons.length > 0) {
    const { error } = await ctx.supabase
      .from("registry_persons")
      .upsert(persons.map(personToRow), { onConflict: "rejestrio_id" });
    if (error) throw new Error(`Zapis osob: ${error.message}`);
  }

  return {
    query: { first_name: firstName, last_name: lastName },
    candidates: persons.map((p) => ({
      person_id: p.id,
      full_name: p.tozsamosc?.imiona_i_nazwisko ?? `${firstName} ${lastName}`,
      middle_names: p.tozsamosc?.drugie_imiona || null,
      // Data urodzenia (plan Biznes) rozstrzyga imienników. To ona zamienia
      // zgadywanie w wybór na podstawie danych.
      birth_date: p.tozsamosc?.data_urodzenia ?? null,
      connections_current: p.krs_powiazania_liczby?.aktualne ?? 0,
      connections_past: p.krs_powiazania_liczby?.przeszle ?? 0,
      organizations_preview: (p.organizacje_skrot ?? []).map((o) => o.nazwa_skrocona),
    })),
    // Imiennicy są normą, nie wyjątkiem. Interfejs musi to powiedzieć wprost.
    ambiguous: persons.length > 1,
  };
}

// Potwierdzenie tożsamości i pobranie powiązań. To jedyne miejsce, w którym
// powstaje wpis o statusie confirmed.
async function opLinkPerson(
  ctx: CallContext,
  tenantId: string,
  userId: string,
  body: {
    person_id?: unknown;
    subject_type?: unknown;
    subject_id?: unknown;
    label?: unknown;
  },
) {
  const personId = Number(body.person_id);
  if (!Number.isInteger(personId) || personId <= 0) {
    throw new HttpError(400, "Nieprawidłowy identyfikator osoby (person_id).");
  }
  const subjectType = requireSubjectType(body.subject_type);
  const label = requireString(body.label, "label", 2);
  const subjectId = typeof body.subject_id === "string" ? body.subject_id : null;

  const now = new Date().toISOString();
  const { data: subject, error } = await ctx.supabase
    .from("registry_subjects")
    .upsert(
      {
        tenant_id: tenantId,
        subject_type: subjectType,
        subject_id: subjectId,
        label,
        person_id: personId,
        match_status: "confirmed",
        confirmed_by: userId,
        confirmed_at: now,
      },
      { onConflict: "tenant_id,subject_type,subject_id,person_id,org_krs" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`Zapis podmiotu: ${error.message}`);

  const count = await syncPersonConnections(ctx.supabase, personId, ctx);
  await ctx.supabase
    .from("registry_subjects")
    .update({ connections_synced_at: new Date().toISOString() })
    .eq("id", subject.id);

  const watched = await syncWatchesForSubject(
    ctx.supabase,
    tenantId,
    subject.id,
    personId,
    `Powiązanie: ${label}`,
  );

  await logAccess(ctx.supabase, tenantId, userId, "registry_link_person", `person:${personId}`);
  return { subject, connections: count, watched };
}

async function opUnlink(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: { subject_id?: unknown },
) {
  const id = requireString(body.subject_id, "subject_id");
  const { error } = await supabase
    .from("registry_subjects")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(`Usuniecie podmiotu: ${error.message}`);
  await logAccess(supabase, tenantId, userId, "registry_unlink", `subject:${id}`);
  return { ok: true };
}

async function opListSubjects(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("registry_subjects")
    .select("*, registry_persons(full_name, connections_current, connections_past)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Odczyt podmiotow: ${error.message}`);
  return { subjects: data ?? [] };
}

async function loadSubject(
  supabase: SupabaseClient,
  tenantId: string,
  subjectId: string,
) {
  const { data, error } = await supabase
    .from("registry_subjects")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", subjectId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt podmiotu: ${error.message}`);
  if (!data) throw new HttpError(404, "Nie znaleziono podmiotu.");
  return data;
}

// Powiązania z cache'u. Płatne API wołamy tylko, gdy dane są nieświeże
// albo gdy użytkownik jawnie poprosi o odświeżenie.
async function opGetConnections(
  ctx: CallContext,
  tenantId: string,
  body: { subject_id?: unknown; refresh?: unknown },
) {
  const subject = await loadSubject(
    ctx.supabase,
    tenantId,
    requireString(body.subject_id, "subject_id"),
  );
  if (!subject.person_id) {
    throw new HttpError(400, "Ten podmiot nie ma przypisanej osoby z rejestru.");
  }
  if (subject.match_status !== "confirmed") {
    throw new HttpError(
      400,
      "Tożsamość nie została potwierdzona. Powiązań nie pokazujemy dla niepotwierdzonych osób.",
    );
  }

  const stale = isStale(subject.connections_synced_at);
  const refreshed = body.refresh === true || stale;

  // Ile spolek dostaje kwoty przy jednym odswiezeniu. Dokument finansowy
  // w JSON kosztuje wiecej niz zwykle wywolanie, wiec ograniczamy porcje.
  const FINANCIALS_PER_REFRESH = 10;
  if (refreshed) {
    await syncPersonConnections(ctx.supabase, subject.person_id, ctx);
    await ctx.supabase
      .from("registry_subjects")
      .update({ connections_synced_at: new Date().toISOString() })
      .eq("id", subject.id);
    await syncWatchesForSubject(
      ctx.supabase,
      tenantId,
      subject.id,
      subject.person_id,
      `Powiązanie: ${subject.label}`,
    );

    // Kwoty ze sprawozdan dla spolek, w ktorych polityk jest OBECNIE.
    // Zakonczone powiazania zostawiamy do wejscia w karte spolki.
    const { data: currentOrgs } = await ctx.supabase
      .from("registry_connections")
      .select("org_krs")
      .eq("person_id", subject.person_id)
      .eq("is_current", true);
    const unique = [...new Set((currentOrgs ?? []).map((r) => r.org_krs as string))]
      .slice(0, FINANCIALS_PER_REFRESH);
    for (const krs of unique) {
      try {
        await syncFinancials(ctx.supabase, krs, ctx);
      } catch (err) {
        console.error(`syncFinancials ${krs}:`, err);
      }
    }
  }

  // Bierzemy powiazania aktualne ORAZ zakonczone. Spolka, z ktorej polityk
  // wyszedl rok temu, jest tak samo dobrym tematem na pytanie od dziennikarza.
  let { data, error } = await ctx.supabase
    .from("registry_connections")
    .select("*, registry_orgs(*)")
    .eq("person_id", subject.person_id)
    .order("is_current", { ascending: false });
  if (error) throw new Error(`Odczyt powiazan: ${error.message}`);

  const krsList = [...new Set((data ?? []).map((row) => row.org_krs as string))];

  // Wzbogacenie z darmowego API MS przy odczycie. Robimy je niezależnie od
  // płatnego TTL, bo nic nie kosztuje, a bez niego karta spółki nie ma
  // kapitału ani sprawozdań. Limit na wywołanie chroni przed przekroczeniem
  // limitu zapytań po stronie ministerstwa przy dużej liczbie spółek.
  const missing = (data ?? [])
    .filter((row) => !(row.registry_orgs as { enriched_at?: string } | null)?.enriched_at)
    // Aktualne najpierw: to one sa na gorze ekranu.
    .sort((a, b) => Number(b.is_current) - Number(a.is_current))
    .map((row) => row.org_krs as string);
  const toEnrich = [...new Set(missing)].slice(0, ENRICH_PER_CALL);

  if (toEnrich.length > 0) {
    for (const krs of toEnrich) {
      await enrichOrgFromOpenKrs(ctx.supabase, krs);
    }
    const reread = await ctx.supabase
      .from("registry_connections")
      .select("*, registry_orgs(*)")
      .eq("person_id", subject.person_id)
      .order("is_current", { ascending: false });
    if (reread.error) throw new Error(`Odczyt powiazan: ${reread.error.message}`);
    data = reread.data;
  }

  // Ostatnie sprawozdanie finansowe per spółka. Jedno zapytanie na całą listę,
  // zamiast N zapytań w pętli.
  const latestFilings = await loadLatestFilings(ctx.supabase, krsList);

  return {
    subject_id: subject.id,
    refreshed,
    synced_at: subject.connections_synced_at,
    connections: (data ?? []).map((row) => {
      const org = row.registry_orgs as Record<string, unknown> | null;
      const krs = row.org_krs as string;
      return {
        org_krs: krs,
        role_type: row.role_type,
        role_label: roleLabel(row.role_type as string),
        direction: row.direction,
        date_start: row.date_start,
        date_end: row.date_end,
        // Pobieramy wyłącznie powiązania aktualne, więc wszystko, co tu jest,
        // trwa nadal. Powiązania zakończone wymagają abonamentu premium.
        is_current: row.is_current,
        name: org?.name_full ?? "brak danych",
        legal_form: org?.legal_form ?? null,
        branch: org?.pkd_main_section ?? null,
        capital_amount: org?.capital_amount ?? null,
        capital_currency: org?.capital_currency ?? null,
        registered_on: org?.registered_on ?? null,
        status: org?.status ?? {},
        latest_filing: latestFilings.get(krs) ?? null,
      };
    }),
    // Interfejs musi powiedzieć wprost, czego nie wie.
    limits: LIMITS,
  };
}

// Czego integracja nie wie i dlaczego. Zwracane przy każdej liście powiązań,
// żeby interfejs nie musiał tego wiedzieć na sztywno.
// Plan Rejestr.io Biznes (wykupiony 2026-07-24) odblokował kwoty ze sprawozdań,
// powiązania historyczne i datę urodzenia. Zostaje jedno ograniczenie: spółki
// raportujące według MSSF składają sprawozdanie jako PDF bez wersji JSON,
// więc dla nich kwot nie wyciągniemy.
const LIMITS = {
  historical_connections: true,
  financial_amounts: true,
  note:
    "Dane z Krajowego Rejestru Sądowego przez Rejestr.io i otwarte API " +
    "Ministerstwa Sprawiedliwości. Spółki raportujące według MSSF składają " +
    "sprawozdanie tylko jako PDF, więc dla nich kwoty pozostają nieznane.",
} as const;

interface LatestFiling {
  period_start: string;
  period_end: string;
  filed_on: string | null;
  revenue: number | null;
  revenue_label: string | null;
  revenue_prev: number | null;
  net_result: number | null;
  net_result_label: string | null;
  net_result_prev: number | null;
  currency: string;
  has_json: boolean;
  // krs_open = znamy tylko wzmianke z darmowego API, kwot nikt jeszcze nie
  // probowal pobrac. rejestrio = probowalismy i wiemy, czy sa.
  source: string;
}

async function loadLatestFilings(
  supabase: SupabaseClient,
  krsList: string[],
): Promise<Map<string, LatestFiling>> {
  const result = new Map<string, LatestFiling>();
  if (krsList.length === 0) return result;

  const { data, error } = await supabase
    .from("registry_org_financials")
    .select(
      "org_krs, period_start, period_end, filed_on, revenue, revenue_label, " +
        "revenue_prev, net_result, net_result_label, net_result_prev, currency, " +
        "has_json, source",
    )
    .in("org_krs", krsList)
    .order("period_end", { ascending: false });
  if (error) throw new Error(`Odczyt sprawozdan: ${error.message}`);

  // Kolejność malejąca po okresie, więc pierwszy wiersz dla danego KRS wygrywa.
  for (const row of data ?? []) {
    const krs = row.org_krs as string;
    if (result.has(krs)) continue;
    result.set(krs, {
      period_start: row.period_start as string,
      period_end: row.period_end as string,
      filed_on: row.filed_on as string | null,
      revenue: row.revenue as number | null,
      revenue_label: row.revenue_label as string | null,
      revenue_prev: row.revenue_prev as number | null,
      net_result: row.net_result as number | null,
      net_result_label: row.net_result_label as string | null,
      net_result_prev: row.net_result_prev as number | null,
      currency: (row.currency as string) ?? "PLN",
      has_json: Boolean(row.has_json),
      source: (row.source as string) ?? "krs_open",
    });
  }
  return result;
}

// Karta pojedynczej spółki.
//
// Wzbogacenie z darmowego API MS (kapitał, PKD, okresy sprawozdań) jest zawsze.
// Płatne pobrania (kwoty ze sprawozdań, skład osobowy) robimy raz na spółkę
// i trzymamy w cache'u, bo dokument finansowy w JSON kosztuje więcej niż
// zwykłe wywołanie API.
async function opGetOrgDetails(
  ctx: CallContext,
  body: { krs?: unknown; refresh?: unknown },
) {
  const supabase = ctx.supabase;
  const krs = normalizeKrs(requireString(body.krs, "krs"));
  if (!krs) throw new HttpError(400, "Nieprawidłowy numer KRS.");
  const forceRefresh = body.refresh === true;

  await enrichOrgFromOpenKrs(supabase, krs, forceRefresh);

  // Kwoty ze sprawozdań: pobieramy, gdy nie mamy ani jednego okresu ze
  // znanym statusem JSON, czyli gdy jeszcze nigdy o nie nie pytaliśmy.
  const { count: pricedCount } = await supabase
    .from("registry_org_financials")
    .select("id", { count: "exact", head: true })
    .eq("org_krs", krs)
    .eq("source", "rejestrio");
  if (forceRefresh || (pricedCount ?? 0) === 0) {
    try {
      await syncFinancials(supabase, krs, ctx);
    } catch (err) {
      console.error(`syncFinancials ${krs}:`, err);
    }
  }

  // Skład osobowy plus dopasowanie do posłów.
  const { count: peopleCount } = await supabase
    .from("registry_org_people")
    .select("id", { count: "exact", head: true })
    .eq("org_krs", krs);
  if (forceRefresh || (peopleCount ?? 0) === 0) {
    try {
      await syncOrgPeople(supabase, krs, ctx);
    } catch (err) {
      console.error(`syncOrgPeople ${krs}:`, err);
    }
  }

  const { data: org, error } = await supabase
    .from("registry_orgs")
    .select("*")
    .eq("krs", krs)
    .maybeSingle();
  if (error) throw new Error(`Odczyt organizacji: ${error.message}`);
  if (!org) throw new HttpError(404, "Nie znamy tej spółki.");

  const { data: filings, error: filingsError } = await supabase
    .from("registry_org_financials")
    .select(
      "period_start, period_end, filed_on, revenue, revenue_label, revenue_prev, " +
        "net_result, net_result_label, net_result_prev, currency, has_json",
    )
    .eq("org_krs", krs)
    .order("period_end", { ascending: false });
  if (filingsError) throw new Error(`Odczyt sprawozdan: ${filingsError.message}`);

  const { data: people, error: peopleError } = await supabase
    .from("registry_org_people")
    .select("*")
    .eq("org_krs", krs)
    .order("is_current", { ascending: false });
  if (peopleError) throw new Error(`Odczyt skladu: ${peopleError.message}`);

  const mapped = (people ?? []).map((row) => ({
    full_name: row.full_name as string,
    birth_date: row.birth_date as string | null,
    role_label: roleLabel(row.role_type as string),
    date_start: row.date_start as string | null,
    date_end: row.date_end as string | null,
    is_current: row.is_current as boolean,
    sejm_mp_id: row.sejm_mp_id as number | null,
    sejm_club: row.sejm_club as string | null,
    match_basis: row.match_basis as string | null,
  }));

  return {
    org,
    filings: filings ?? [],
    people: mapped,
    // Osoby, które są posłami. To jest odpowiedź na pytanie "czy siedzę w tej
    // spółce z kimś jeszcze z polityki".
    politicians: mapped.filter((person) => person.sejm_mp_id !== null),
    limits: LIMITS,
  };
}

// Zestawienie branży spółki z dorobkiem parlamentarnym polityka.
// Wynik cache'ujemy per tenant i spółka, bo generacja kosztuje wywołanie modelu.
async function opCompanyContext(
  ctx: CallContext,
  tenantId: string,
  body: { krs?: unknown; refresh?: unknown },
) {
  const supabase = ctx.supabase;
  const krs = normalizeKrs(requireString(body.krs, "krs"));
  if (!krs) throw new HttpError(400, "Nieprawidłowy numer KRS.");

  if (body.refresh !== true) {
    const { data: cached } = await supabase
      .from("registry_company_context")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("org_krs", krs)
      .maybeSingle();
    if (cached) return { ...cached, from_cache: true };
  }

  const { data: org, error } = await supabase
    .from("registry_orgs")
    .select("krs, name_full, legal_form, pkd_main_section, pkd_all, capital_amount")
    .eq("krs", krs)
    .maybeSingle();
  if (error) throw new Error(`Odczyt organizacji: ${error.message}`);
  if (!org) throw new HttpError(404, "Nie znamy tej spółki.");

  const pkd = (org.pkd_all as { code: string; description: string }[] ?? [])
    .map((entry) => entry.description)
    .join(". ");
  const branchText = `${org.name_full} ${org.pkd_main_section ?? ""} ${pkd}`.trim();

  // Rola polityka w tej spółce. Nie ma klucza obcego między connections
  // a subjects, więc idziemy przez person_id potwierdzonych podmiotów tenanta.
  const { data: subjects } = await supabase
    .from("registry_subjects")
    .select("person_id")
    .eq("tenant_id", tenantId)
    .eq("match_status", "confirmed")
    .not("person_id", "is", null);
  const personIds = (subjects ?? []).map((row) => row.person_id as number);

  let ownRoles: { role_type: string; date_start: string | null; is_current: boolean }[] = [];
  if (personIds.length > 0) {
    const { data } = await supabase
      .from("registry_connections")
      .select("role_type, date_start, is_current")
      .eq("org_krs", krs)
      .in("person_id", personIds);
    ownRoles = (data ?? []) as typeof ownRoles;
  }

  const votes = await findRelatedVotes(supabase, tenantId, branchText);

  // Wypowiedzi sejmowe: tu embeddingi są, więc szukamy semantycznie.
  let statements: { date: string; excerpt: string }[] = [];
  try {
    const embedding = await embedText(branchText.slice(0, 2000));
    const { data: matched } = await supabase.rpc("match_statements", {
      p_tenant_id: tenantId,
      p_query_embedding: embedding,
      p_limit: 5,
    });
    statements = (matched ?? []).map((row: Record<string, unknown>) => ({
      date: String(row.date ?? "brak danych"),
      excerpt: String(row.text ?? "").slice(0, 600),
    }));
  } catch (err) {
    // Brak embeddingów (pominięty onboarding) nie może wywrócić operacji.
    console.error(`company_context embed ${krs}:`, err);
  }

  const contextSchema = z.object({
    summary: z.string().describe("Podsumowanie po polsku, od 2 do 5 zdan"),
    risk: z.enum(["brak", "pytanie", "ryzyko"]).describe("Poziom ryzyka"),
  });

  const model = (await getGenerationModel()).withStructuredOutput(contextSchema, {
    name: "company_context",
  });

  const result = await model.invoke([
    ["system", loadPrompt("company-vote-context")],
    [
      "human",
      [
        "Spolka:",
        `Nazwa: ${org.name_full}`,
        `Forma prawna: ${org.legal_form ?? "brak danych"}`,
        `Branza przewazajaca: ${org.pkd_main_section ?? "brak danych"}`,
        `Pelne PKD: ${pkd || "brak danych"}`,
        `Rola polityka: ${
          ownRoles.map((r) =>
            `${roleLabel(r.role_type)} od ${r.date_start ?? "brak danych"}` +
            (r.is_current ? " (nadal)" : " (zakonczona)")
          ).join("; ") || "brak danych"
        }`,
        "",
        "Glosowania politykia tematycznie bliskie branzy:",
        votes.length === 0
          ? "brak danych"
          : votes.map((v) => `- ${v.date}: ${v.title} — glosowal: ${v.vote}`).join("\n"),
        "",
        "Fragmenty wypowiedzi sejmowych politykia:",
        statements.length === 0
          ? "brak danych"
          : statements.map((s) => `- ${s.date}: ${s.excerpt}`).join("\n\n"),
      ].join("\n"),
    ],
  ]);

  const row = {
    tenant_id: tenantId,
    org_krs: krs,
    summary: result.summary,
    evidence: { risk: result.risk, votes, statements },
    votes_found: votes.length,
    statements_found: statements.length,
    model: "claude-sonnet-5",
    generated_at: new Date().toISOString(),
  };

  const { data: saved, error: saveError } = await supabase
    .from("registry_company_context")
    .upsert(row, { onConflict: "tenant_id,org_krs" })
    .select("*")
    .single();
  if (saveError) throw new Error(`Zapis kontekstu: ${saveError.message}`);

  return { ...saved, from_cache: false };
}

async function opSearchOrg(
  ctx: CallContext,
  body: { nazwa?: unknown; nip?: unknown; regon?: unknown },
) {
  const criteria = {
    nazwa: typeof body.nazwa === "string" ? body.nazwa.trim() : undefined,
    nip: typeof body.nip === "string" ? body.nip.replace(/\D/g, "") : undefined,
    regon: typeof body.regon === "string" ? body.regon.replace(/\D/g, "") : undefined,
  };
  if (!criteria.nazwa && !criteria.nip && !criteria.regon) {
    throw new HttpError(400, "Podaj nazwę, NIP albo REGON.");
  }

  const orgs = await searchOrgs(criteria, ctx);
  for (const org of orgs.slice(0, 20)) {
    await upsertOrg(ctx.supabase, org);
  }
  return {
    organizations: orgs.map((org) => ({
      krs: normalizeKrs(org.numery?.krs ?? org.id),
      name: org.nazwy?.pelna ?? "brak danych",
      nip: org.numery?.nip ? String(org.numery.nip) : null,
      legal_form: org.stan?.forma_prawna ?? null,
      branch: org.stan?.pkd_przewazajace_dzial ?? null,
      removed: org.stan?.czy_wykreslona ?? false,
    })),
  };
}

// Przypięcie organizacji do bytu w Argusie, np. wydawcy do redakcji.
// Nazwa firmy jest jednoznaczna inaczej niż nazwisko, więc tu potwierdzenie
// jest formalnością, ale i tak zapisujemy kto je wykonał.
async function opLinkOrg(
  ctx: CallContext,
  tenantId: string,
  userId: string,
  body: {
    krs?: unknown;
    subject_type?: unknown;
    subject_id?: unknown;
    label?: unknown;
  },
) {
  const krs = normalizeKrs(requireString(body.krs, "krs"));
  if (!krs) throw new HttpError(400, "Nieprawidłowy numer KRS.");
  const subjectType = requireSubjectType(body.subject_type);
  const subjectId = typeof body.subject_id === "string" ? body.subject_id : null;

  const org = await getOrg(krs, ctx);
  await upsertOrg(ctx.supabase, org);
  const label = typeof body.label === "string" && body.label.trim()
    ? body.label.trim()
    : org.nazwy?.pelna ?? krs;

  const now = new Date().toISOString();
  const { data: subject, error } = await ctx.supabase
    .from("registry_subjects")
    .upsert(
      {
        tenant_id: tenantId,
        subject_type: subjectType,
        subject_id: subjectId,
        label,
        org_krs: krs,
        match_status: "confirmed",
        confirmed_by: userId,
        confirmed_at: now,
      },
      { onConflict: "tenant_id,subject_type,subject_id,person_id,org_krs" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`Zapis podmiotu: ${error.message}`);

  const { error: watchError } = await ctx.supabase
    .from("registry_watches")
    .upsert(
      {
        tenant_id: tenantId,
        org_krs: krs,
        subject_id: subject.id,
        reason: `Obserwacja: ${label}`,
        active: true,
      },
      { onConflict: "tenant_id,org_krs" },
    );
  if (watchError) throw new Error(`Zapis obserwacji: ${watchError.message}`);

  await logAccess(ctx.supabase, tenantId, userId, "registry_link_org", `krs:${krs}`);
  return { subject };
}

async function opListEvents(
  supabase: SupabaseClient,
  tenantId: string,
  body: { only_unseen?: unknown; limit?: unknown },
) {
  let query = supabase
    .from("registry_events")
    .select("*, registry_orgs(name_full, legal_form)")
    .eq("tenant_id", tenantId)
    .order("event_date", { ascending: false })
    .limit(Number(body.limit) || 50);
  if (body.only_unseen === true) query = query.eq("seen", false);

  const { data, error } = await query;
  if (error) throw new Error(`Odczyt zdarzen: ${error.message}`);
  return { events: data ?? [] };
}

async function opMarkEventSeen(
  supabase: SupabaseClient,
  tenantId: string,
  body: { event_id?: unknown },
) {
  const id = requireString(body.event_id, "event_id");
  const { error } = await supabase
    .from("registry_events")
    .update({ seen: true })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(`Zapis zdarzenia: ${error.message}`);
  return { ok: true };
}

// Wejście dla strażnika spójności i briefu przedwywiadowego.
// Zwraca sygnały do oceny, nie werdykt o konflikcie interesów.
async function opCheckConflicts(
  supabase: SupabaseClient,
  tenantId: string,
  body: { text?: unknown },
) {
  const text = requireString(body.text, "text", 3);
  const hits = await findPotentialConflicts(supabase, tenantId, text);
  return {
    hits: hits.map((hit) => ({
      ...hit,
      role_label: roleLabel(hit.role),
    })),
    // Nazewnictwo celowo ostrożne: to jest sygnał do sprawdzenia.
    disclaimer: hits.length > 0
      ? "Sygnały wymagają weryfikacji przez człowieka. Pokrycie słów nie oznacza konfliktu interesów."
      : "Brak pokrycia tematu z powiązaniami kapitałowymi w rejestrze.",
  };
}

// Ręczne uruchomienie darmowego skanu biuletynu (normalnie robi to cron
// w argus-ingest). Nie zużywa środków z konta Rejestr.io.
async function opScanChanges(
  supabase: SupabaseClient,
  body: { day?: unknown },
) {
  const day = typeof body.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day)
    ? body.day
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return await scanBulletin(supabase, day);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await authenticateRequest(req);
    const tenantId = await getTenantId(supabase, user.id);
    const body = await req.json().catch(() => ({}));
    const ctx: CallContext = { supabase, tenantId, userId: user.id };

    switch (body?.operation) {
      case "balance":
        return jsonResponse({ ok: true, data: await opBalance(ctx) });
      case "search_person":
        return jsonResponse({ ok: true, data: await opSearchPerson(ctx, body) });
      case "link_person":
        return jsonResponse({
          ok: true,
          data: await opLinkPerson(ctx, tenantId, user.id, body),
        });
      case "list_subjects":
        return jsonResponse({
          ok: true,
          data: await opListSubjects(supabase, tenantId),
        });
      case "unlink":
        return jsonResponse({
          ok: true,
          data: await opUnlink(supabase, tenantId, user.id, body),
        });
      case "get_connections":
        return jsonResponse({
          ok: true,
          data: await opGetConnections(ctx, tenantId, body),
        });
      case "refresh_connections":
        return jsonResponse({
          ok: true,
          data: await opGetConnections(ctx, tenantId, { ...body, refresh: true }),
        });
      case "search_org":
        return jsonResponse({ ok: true, data: await opSearchOrg(ctx, body) });
      case "get_org_details":
        return jsonResponse({
          ok: true,
          data: await opGetOrgDetails(ctx, body),
        });
      case "company_context":
        return jsonResponse({
          ok: true,
          data: await opCompanyContext(ctx, tenantId, body),
        });
      case "link_org":
        return jsonResponse({
          ok: true,
          data: await opLinkOrg(ctx, tenantId, user.id, body),
        });
      case "list_events":
        return jsonResponse({
          ok: true,
          data: await opListEvents(supabase, tenantId, body),
        });
      case "mark_event_seen":
        return jsonResponse({
          ok: true,
          data: await opMarkEventSeen(supabase, tenantId, body),
        });
      case "check_conflicts":
        return jsonResponse({
          ok: true,
          data: await opCheckConflicts(supabase, tenantId, body),
        });
      case "scan_changes":
        return jsonResponse({ ok: true, data: await opScanChanges(supabase, body) });
      default:
        return jsonResponse(
          { ok: false, error: `Nieznana operacja: ${body?.operation}` },
          400,
        );
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ ok: false, error: err.message }, err.status);
    }
    console.error("argus-registry error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { ok: false, error: `Wystąpił błąd. Spróbuj ponownie później. (${detail})` },
      500,
    );
  }
});
