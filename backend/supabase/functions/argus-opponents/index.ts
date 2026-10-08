// argus-opponents — teczka oponenta.
// Operacje: create, ensure, step, get, list, refresh, delete.
// Kontrakt: docs/kontrakt-teczka-oponenta.md
//
// Petru chce przed debatą albo wywiadem dostać wszystkie dostępne wypowiedzi
// przeciwnika z ostatniego roku, zwłaszcza kontrowersyjne, sprzeczne
// z programem jego partii albo z tym, co wydarzyło się później. Dane z Sejmu
// tego nie dają (politycy medialni prawie nie mówią z mównicy), więc teczka
// powstaje z wyszukiwania w sieci.
//
// Przepływ: create zapisuje osobę i zwraca id, potem klient woła `step` w pętli
// aż do `next: false`. Każdy krok to jeden przebieg (PASSES w
// _shared/opponent-research.ts): kilka wyszukiwań na jeden aspekt, walidacja
// źródeł w kodzie, zapis. Ostatni krok to synteza bez wyszukiwania.
//
// Przebieg, który się wywrócił (limit czasu, odpowiedź bez JSON-a), NIE
// zatrzymuje teczki: jest odnotowany w `summary.failed_passes` i pokazany
// w UI jako luka. Ponowienie kosztowałoby drugi raz, a polityk woli niepełną
// teczkę z jawną luką niż żadną.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import { logAccess } from "../_shared/access-log.ts";
import { today } from "../_shared/date.ts";
import {
  applyLaterFacts,
  dossierMatches,
  type DossierItem,
  type DossierSource,
  mergeItems,
  mergeSources,
  normalizeSummary,
} from "../_shared/opponent-dossier.ts";
import {
  type DossierSubject,
  PASSES,
  runSearchPass,
  runSynthesis,
} from "../_shared/opponent-research.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MIN_LENGTH = 5;
const LIST_LIMIT = 50;

/**
 * Bezpiecznik kosztów: przebiegi z wyszukiwaniem idą ze wspólnego klucza API,
 * więc liczba uruchomień (nowa teczka albo odświeżenie) na tenanta na dobę
 * jest ograniczona. Przy ok. 1-2 USD za teczkę to sufit ok. 20 USD dziennie.
 */
const MAX_RUNS_PER_TENANT_PER_DAY = 10;

const DOSSIER_COLUMNS =
  "id, full_name, role_hint, party, mp_id, notes, status, pass_index, items, summary, search_count, error, last_refreshed_at, created_at, updated_at";

interface DossierRow {
  id: string;
  full_name: string;
  role_hint: string | null;
  party: string | null;
  mp_id: number | null;
  notes: string | null;
  status: "collecting" | "done" | "error";
  pass_index: number;
  items: DossierItem[];
  summary: Record<string, unknown> | null;
  sources: DossierSource[];
  search_count: number;
  error: string | null;
}

function readId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (id === "") throw new HttpError(400, "Brak identyfikatora teczki.");
  if (!UUID_RE.test(id)) throw new HttpError(404, "Nie znaleziono teczki.");
  return id;
}

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

async function assertDailyBudget(supabase: SupabaseClient, tenantId: string) {
  const { count, error } = await supabase
    .from("opponent_dossiers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("last_refreshed_at", `${today()}T00:00:00+00:00`);
  if (error) throw new Error(`Limit teczek: ${error.message}`);
  if ((count ?? 0) >= MAX_RUNS_PER_TENANT_PER_DAY) {
    throw new HttpError(
      429,
      `Dzienny limit teczek (${MAX_RUNS_PER_TENANT_PER_DAY}) został wyczerpany. Spróbuj jutro.`,
    );
  }
}

async function loadDossier(
  supabase: SupabaseClient,
  tenantId: string,
  id: string,
): Promise<DossierRow> {
  const { data, error } = await supabase
    .from("opponent_dossiers")
    .select(`${DOSSIER_COLUMNS}, sources`)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Odczyt teczki: ${error.message}`);
  if (!data) throw new HttpError(404, "Nie znaleziono teczki.");
  return data as unknown as DossierRow;
}

async function readDossier(supabase: SupabaseClient, tenantId: string, id: string) {
  const { data, error } = await supabase
    .from("opponent_dossiers")
    .select(DOSSIER_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Odczyt teczki: ${error.message}`);
  if (!data) throw new HttpError(404, "Nie znaleziono teczki.");
  return { ...data, passes: PASSES.map((p) => ({ id: p.id, label: p.label })) };
}

// ---------------------------------------------------------------------------
// Operacje
// ---------------------------------------------------------------------------

async function opCreate(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const fullName = optionalText(body.full_name, 120) ?? "";
  if (fullName.length < NAME_MIN_LENGTH) {
    throw new HttpError(400, "Podaj imię i nazwisko oponenta.");
  }
  await assertDailyBudget(supabase, tenantId);

  const mpId = typeof body.mp_id === "number" ? Math.trunc(body.mp_id) : null;
  const { data, error } = await supabase
    .from("opponent_dossiers")
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      full_name: fullName,
      role_hint: optionalText(body.role_hint, 200),
      party: optionalText(body.party, 120),
      mp_id: mpId,
      notes: optionalText(body.notes, 600),
      status: "collecting",
      pass_index: 0,
      summary: { identity_notes: [], failed_passes: [] },
      last_refreshed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis teczki: ${error.message}`);
  await logAccess(supabase, tenantId, userId, "opponent_dossier_create", data.id as string);
  return { id: data.id as string };
}

/**
 * Teczka dla osoby z obsady briefu: istniejąca albo nowa.
 *
 * Brief z oponentem sam zbiera teczkę (decyzja usera 2026-10-08), więc
 * formularz briefu woła to przed generacją i dopiero potem pętlę `step`.
 * Kolejność wyboru: gotowa teczka, potem teczka w trakcie (dokończymy ją,
 * zamiast płacić drugi raz), potem zatrzymana (odświeżamy ją), na końcu
 * nowa. Gotowej nie odświeżamy sami, bo to 1-2 USD: robi to człowiek.
 */
async function opEnsure(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const fullName = optionalText(body.full_name, 120) ?? "";
  if (fullName.length < NAME_MIN_LENGTH) {
    throw new HttpError(400, "Podaj imię i nazwisko oponenta.");
  }
  const mpId = typeof body.mp_id === "number" ? Math.trunc(body.mp_id) : null;

  const { data, error } = await supabase
    .from("opponent_dossiers")
    .select("id, full_name, mp_id, status, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Szukanie teczki: ${error.message}`);
  const matching = (data ?? []).filter((d) =>
    dossierMatches(d as { full_name: string; mp_id: number | null }, {
      name: fullName,
      mp_id: mpId,
    })
  ) as { id: string; status: string }[];

  for (const status of ["done", "collecting"]) {
    const found = matching.find((d) => d.status === status);
    if (found) return { id: found.id, status, created: false };
  }
  const stopped = matching.find((d) => d.status === "error");
  if (stopped) {
    await opRefresh(supabase, tenantId, userId, stopped.id);
    return { id: stopped.id, status: "collecting", created: false };
  }
  const { id } = await opCreate(supabase, tenantId, userId, body);
  return { id, status: "collecting", created: true };
}

/** Jeden przebieg porcjowanej pętli. Zwraca stan postępu dla UI. */
async function opStep(supabase: SupabaseClient, tenantId: string, id: string) {
  const dossier = await loadDossier(supabase, tenantId, id);
  const total = PASSES.length;
  if (dossier.status !== "collecting" || dossier.pass_index >= total) {
    return { phase: "done", processed: total, total, next: false };
  }

  const pass = PASSES[dossier.pass_index];
  const subject: DossierSubject = {
    full_name: dossier.full_name,
    role_hint: dossier.role_hint,
    party: dossier.party,
    notes: dossier.notes,
  };
  const interim = (dossier.summary ?? {}) as Record<string, unknown>;
  const identityNotes = Array.isArray(interim.identity_notes)
    ? interim.identity_notes as string[]
    : [];
  const failedPasses = Array.isArray(interim.failed_passes)
    ? interim.failed_passes as string[]
    : [];

  let items = dossier.items ?? [];
  let sources = dossier.sources ?? [];
  let searchCount = dossier.search_count ?? 0;
  let summary: Record<string, unknown> = { ...interim };

  if (pass.searches > 0) {
    try {
      const out = await runSearchPass(pass, subject, items, today());
      sources = mergeSources(sources, out.sources);
      searchCount += out.searchCount;
      const merged = mergeItems(items, out.rawItems, sources, pass.id);
      items = merged.items;
      if (pass.id === "fakty") {
        items = applyLaterFacts(items, out.rawUpdates, sources).items;
      }
      if (merged.rejectedUnknownSource > 0) {
        console.warn(
          `argus-opponents: ${pass.id} odrzucil ${merged.rejectedUnknownSource} pozycji spoza wynikow wyszukiwania`,
        );
      }
      if (out.notes) identityNotes.push(`${pass.label}: ${out.notes}`);
    } catch (err) {
      console.error(`argus-opponents: przebieg ${pass.id} nie powiodl sie`, err);
      // Odmowa API (brak środków na koncie, zły klucz, błąd zapytania) nie
      // minie w następnym przebiegu. Bez tego zatrzymania 8 października każdy
      // przebieg zostałby oznaczony jako luka i teczka skończyłaby się pusta,
      // wyglądając na „nic nie znaleziono". Limit zapytań (429) i timeout
      // (408) są przejściowe, więc te traktujemy jak zwykłą lukę.
      const status = (err as { status?: unknown }).status;
      if (
        typeof status === "number" && status >= 400 && status < 500 &&
        status !== 408 && status !== 429
      ) {
        await supabase
          .from("opponent_dossiers")
          .update({
            status: "error",
            error:
              "Usługa wyszukiwania odrzuciła zapytanie. Teczka została zatrzymana, odśwież ją później.",
          })
          .eq("tenant_id", tenantId)
          .eq("id", id);
        return { phase: "error", processed: dossier.pass_index, total, next: false };
      }
      failedPasses.push(pass.label);
    }
    summary = { ...summary, identity_notes: identityNotes, failed_passes: failedPasses };
  } else {
    // Synteza. Jej porażka też nie wywraca teczki: lista pozycji zostaje,
    // brakuje tylko podsumowania, i UI to mówi.
    const { data: profile } = await supabase
      .from("politician_profiles")
      .select("values, boundaries")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    let raw: unknown = null;
    try {
      raw = items.length > 0
        ? await runSynthesis(subject, items, profile ?? null, failedPasses)
        : null;
    } catch (err) {
      console.error("argus-opponents: synteza nie powiodla sie", err);
      failedPasses.push(pass.label);
    }
    summary = normalizeSummary(raw, items, {
      identity_notes: identityNotes,
      failed_passes: failedPasses,
    }) as unknown as Record<string, unknown>;
  }

  const nextIndex = dossier.pass_index + 1;
  const finished = nextIndex >= total;
  const { error } = await supabase
    .from("opponent_dossiers")
    .update({
      items,
      sources,
      search_count: searchCount,
      summary,
      pass_index: nextIndex,
      status: finished ? "done" : "collecting",
    })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(`Zapis przebiegu: ${error.message}`);

  return {
    phase: finished ? "done" : PASSES[nextIndex].id,
    processed: nextIndex,
    total,
    next: !finished,
    items_count: items.length,
  };
}

/**
 * Odświeżenie: te same przebiegi od początku, ale z dotychczasowymi pozycjami
 * jako „już zebrane”, więc doklejają się tylko nowe wypowiedzi.
 */
async function opRefresh(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  id: string,
) {
  const dossier = await loadDossier(supabase, tenantId, id);
  if (dossier.status === "collecting") {
    return { id };
  }
  await assertDailyBudget(supabase, tenantId);
  const { error } = await supabase
    .from("opponent_dossiers")
    .update({
      status: "collecting",
      pass_index: 0,
      error: null,
      summary: { identity_notes: [], failed_passes: [] },
      last_refreshed_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(`Odswiezenie teczki: ${error.message}`);
  await logAccess(supabase, tenantId, userId, "opponent_dossier_refresh", id);
  return { id };
}

async function opList(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("opponent_dossiers")
    .select("id, full_name, role_hint, party, status, pass_index, items, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Lista teczek: ${error.message}`);
  // Lista nie niesie pozycji, tylko ich liczbę: teczka potrafi mieć 80 cytatów.
  return (data ?? []).map((row) => {
    const { items, ...rest } = row as Record<string, unknown>;
    return { ...rest, items_count: Array.isArray(items) ? items.length : 0 };
  });
}

async function opDelete(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  id: string,
) {
  const { error } = await supabase
    .from("opponent_dossiers")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(`Usuniecie teczki: ${error.message}`);
  await logAccess(supabase, tenantId, userId, "opponent_dossier_delete", id);
  return { deleted: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await authenticateRequest(req);
    const tenantId = await getTenantId(supabase, user.id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    switch (body?.operation) {
      case "create":
        return jsonResponse({ ok: true, data: await opCreate(supabase, tenantId, user.id, body) });
      case "ensure":
        return jsonResponse({ ok: true, data: await opEnsure(supabase, tenantId, user.id, body) });
      case "step":
        return jsonResponse({ ok: true, data: await opStep(supabase, tenantId, readId(body.id)) });
      case "get":
        return jsonResponse({
          ok: true,
          data: await readDossier(supabase, tenantId, readId(body.id)),
        });
      case "list":
        return jsonResponse({ ok: true, data: await opList(supabase, tenantId) });
      case "refresh":
        return jsonResponse({
          ok: true,
          data: await opRefresh(supabase, tenantId, user.id, readId(body.id)),
        });
      case "delete":
        return jsonResponse({
          ok: true,
          data: await opDelete(supabase, tenantId, user.id, readId(body.id)),
        });
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
    return serverErrorResponse("argus-opponents", err);
  }
});
