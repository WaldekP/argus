// Logika domenowa rejestru sądowego, współdzielona przez argus-registry
// (operacje użytkownika) i argus-ingest (cron wykrywający zmiany).
//
// Kontrakt: docs/kontrakt-rejestr-krs.md
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type CallContext,
  getPersonConnections,
  normalizeKrs,
  orgToRow,
  type RioOrg,
} from "./rejestrio.ts";
import { describeLatestEntry, getCurrentExtract, getDailyBulletin } from "./krs-open.ts";

// Po ilu dniach uznajemy zapisane powiązania za nieświeże. Wpisy w KRS zmieniają
// się rzadko, a każde odświeżenie kosztuje, więc domyślnie miesiąc.
export const CONNECTIONS_TTL_DAYS = 30;

export function isStale(syncedAt: string | null | undefined, days = CONNECTIONS_TTL_DAYS): boolean {
  if (!syncedAt) return true;
  const age = Date.now() - new Date(syncedAt).getTime();
  return age > days * 24 * 60 * 60 * 1000;
}

// Zapisuje organizację do cache'u i zwraca jej numer KRS.
export async function upsertOrg(
  supabase: SupabaseClient,
  org: RioOrg,
): Promise<string | null> {
  const row = orgToRow(org);
  if (!row) return null;
  const { error } = await supabase
    .from("registry_orgs")
    .upsert(row, { onConflict: "krs" });
  if (error) throw new Error(`Zapis organizacji: ${error.message}`);
  return row.krs;
}

// Pobiera z płatnego API aktualne powiązania osoby i zapisuje je w cache'u.
// Zwraca liczbę zapisanych powiązań.
export async function syncPersonConnections(
  supabase: SupabaseClient,
  personId: number,
  ctx: CallContext,
): Promise<number> {
  const orgs = await getPersonConnections(personId, ctx);
  const now = new Date().toISOString();

  // Powiązania aktualne to pełny obraz: kasujemy poprzednie, żeby zniknęły te,
  // których już nie ma w rejestrze.
  const { error: deleteError } = await supabase
    .from("registry_connections")
    .delete()
    .eq("person_id", personId)
    .eq("is_current", true);
  if (deleteError) {
    throw new Error(`Czyszczenie powiazan: ${deleteError.message}`);
  }

  const rows: Record<string, unknown>[] = [];
  for (const org of orgs) {
    const krs = await upsertOrg(supabase, org);
    if (!krs) continue;
    for (const link of org.krs_powiazania_kwerendowane ?? []) {
      rows.push({
        person_id: personId,
        org_krs: krs,
        role_type: link.typ,
        direction: link.kierunek ?? null,
        date_start: link.data_start ?? null,
        date_end: link.data_koniec ?? null,
        is_current: true,
        synced_at: now,
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("registry_connections")
      .upsert(rows, { onConflict: "person_id,org_krs,role_type,date_start" });
    if (error) throw new Error(`Zapis powiazan: ${error.message}`);
  }

  await supabase
    .from("registry_persons")
    .update({ connections_current: rows.length, synced_at: now })
    .eq("rejestrio_id", personId);

  return rows.length;
}

// Zakłada obserwację wszystkich spółek powiązanych z podmiotem. Obserwacja jest
// darmowa: zmiany wykrywa biuletyn otwartego API KRS, nie płatne Rejestr.io.
export async function syncWatchesForSubject(
  supabase: SupabaseClient,
  tenantId: string,
  subjectId: string,
  personId: number,
  reason: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("registry_connections")
    .select("org_krs")
    .eq("person_id", personId)
    .eq("is_current", true);
  if (error) throw new Error(`Odczyt powiazan: ${error.message}`);

  const orgs = [...new Set((data ?? []).map((row) => row.org_krs as string))];
  if (orgs.length === 0) return 0;

  const { error: upsertError } = await supabase
    .from("registry_watches")
    .upsert(
      orgs.map((krs) => ({
        tenant_id: tenantId,
        org_krs: krs,
        subject_id: subjectId,
        reason,
        active: true,
      })),
      { onConflict: "tenant_id,org_krs" },
    );
  if (upsertError) throw new Error(`Zapis obserwacji: ${upsertError.message}`);
  return orgs.length;
}

// ---------------------------------------------------------------------------
// Wykrywanie zmian (darmowe)
// ---------------------------------------------------------------------------

export interface ScanResult {
  day: string;
  changed_in_krs: number;
  watched: number;
  matched: number;
  events_created: number;
}

// Porównuje dzienny biuletyn zmian KRS z listą obserwowanych podmiotów.
// Dla trafień zakłada zdarzenie w registry_events. Zero wywołań płatnego API.
export async function scanBulletin(
  supabase: SupabaseClient,
  day: string,
): Promise<ScanResult> {
  const changed = await getDailyBulletin(day);

  const { data: watches, error } = await supabase
    .from("registry_watches")
    .select("id, tenant_id, org_krs, reason")
    .eq("active", true);
  if (error) throw new Error(`Odczyt obserwacji: ${error.message}`);

  const matched = (watches ?? []).filter((w) => changed.has(w.org_krs as string));
  let created = 0;

  for (const watch of matched) {
    const krs = watch.org_krs as string;
    // Otwarte API mówi tylko, że był nowy wpis. Szczegóły bierzemy z odpisu,
    // też za darmo. Awaria pojedynczego odpisu nie może zatrzymać skanu.
    let summary = "Nowy wpis w KRS obserwowanej spółki.";
    try {
      const extract = await getCurrentExtract(krs);
      if (extract) summary = describeLatestEntry(extract.extract);
    } catch (err) {
      console.error(`registry scan: odpis ${krs}:`, err);
    }

    const { error: insertError } = await supabase
      .from("registry_events")
      .upsert(
        {
          tenant_id: watch.tenant_id,
          org_krs: krs,
          watch_id: watch.id,
          event_date: day,
          source: "krs_bulletin",
          summary,
          details: { reason: watch.reason },
        },
        { onConflict: "tenant_id,org_krs,event_date,source" },
      );
    if (insertError) {
      console.error(`registry scan: zapis zdarzenia ${krs}:`, insertError.message);
      continue;
    }
    created += 1;

    await supabase
      .from("registry_watches")
      .update({ last_change_seen_at: new Date().toISOString() })
      .eq("id", watch.id);
  }

  return {
    day,
    changed_in_krs: changed.size,
    watched: watches?.length ?? 0,
    matched: matched.length,
    events_created: created,
  };
}

// ---------------------------------------------------------------------------
// Heurystyka konfliktu interesów
// ---------------------------------------------------------------------------

// Słowa nieniosące treści. Lista celowo krótka: to filtr szumu, nie lingwistyka.
const STOPWORDS = new Set([
  "oraz", "jest", "sie", "się", "tego", "tym", "przez", "dla", "nie", "tak",
  "jako", "przy", "pod", "nad", "aby", "żeby", "zeby", "ale", "czy", "gdy",
  "który", "ktory", "która", "ktora", "które", "ktore", "jego", "jej", "ich",
  "spółka", "spolka", "ograniczoną", "ograniczona", "odpowiedzialnością",
  "odpowiedzialnoscia", "akcyjna", "pozostałe", "pozostale", "wyłączeniem",
  "wylaczeniem", "działalność", "dzialalnosc", "produkcja", "sprzedaż", "sprzedaz",
]);

// Rdzeń wyrazu: przycięcie do 6 znaków zdejmuje większość polskiej fleksji
// bez stemmera. Świadomy kompromis, bo to wejście dla AI, nie werdykt.
function stems(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word))
      .map((word) => word.slice(0, 6)),
  );
}

export interface ConflictHit {
  org_krs: string;
  org_name: string;
  role: string;
  branch: string | null;
  matched_terms: string[];
}

// Zwraca powiązania podmiotu, których branża lub nazwa pokrywa się leksykalnie
// z badanym tekstem. To sygnał do sprawdzenia przez człowieka albo model,
// a nie stwierdzenie konfliktu interesów.
export async function findPotentialConflicts(
  supabase: SupabaseClient,
  tenantId: string,
  text: string,
): Promise<ConflictHit[]> {
  const needle = stems(text);
  if (needle.size === 0) return [];

  const { data, error } = await supabase
    .from("registry_subjects")
    .select("person_id")
    .eq("tenant_id", tenantId)
    .eq("match_status", "confirmed")
    .not("person_id", "is", null);
  if (error) throw new Error(`Odczyt podmiotow: ${error.message}`);

  const personIds = (data ?? []).map((row) => row.person_id as number);
  if (personIds.length === 0) return [];

  const { data: connections, error: connError } = await supabase
    .from("registry_connections")
    .select("role_type, org_krs, registry_orgs(krs, name_full, pkd_main_section)")
    .in("person_id", personIds)
    .eq("is_current", true);
  if (connError) throw new Error(`Odczyt powiazan: ${connError.message}`);

  const hits: ConflictHit[] = [];
  for (const row of connections ?? []) {
    const org = row.registry_orgs as
      | { krs: string; name_full: string; pkd_main_section: string | null }
      | null;
    if (!org) continue;
    const haystack = stems(`${org.name_full} ${org.pkd_main_section ?? ""}`);
    const matched = [...needle].filter((term) => haystack.has(term));
    if (matched.length === 0) continue;
    hits.push({
      org_krs: org.krs,
      org_name: org.name_full,
      role: row.role_type as string,
      branch: org.pkd_main_section,
      matched_terms: matched,
    });
  }

  // Najmocniejsze pokrycia na górze: tyle wystarczy, żeby brief nie utonął.
  return hits.sort((a, b) => b.matched_terms.length - a.matched_terms.length);
}

export { normalizeKrs };
