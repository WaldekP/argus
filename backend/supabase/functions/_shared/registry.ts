// Logika domenowa rejestru sądowego, współdzielona przez argus-registry
// (operacje użytkownika) i argus-ingest (cron wykrywający zmiany).
//
// Kontrakt: docs/kontrakt-rejestr-krs.md
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type CallContext,
  getFinancialDocuments,
  getFinancialDocumentJson,
  getOrgConnections,
  getPersonConnections,
  orgToRow,
  type RioOrg,
  type RioPerson,
} from "./rejestrio.ts";
import {
  extractFinancials,
  type FinancialDocument,
  findProfitAndLossDocument,
} from "./financials.ts";
import { getMpList } from "./sejm.ts";
import {
  describeLatestEntry,
  getCurrentExtract,
  getDailyBulletin,
  parseOrgDetails,
} from "./krs-open.ts";

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

// Po ilu dniach odświeżamy szczegóły z darmowego API MS. Krócej niż powiązania,
// bo to nic nie kosztuje, a sprawozdanie finansowe dochodzi raz w roku.
export const ORG_DETAILS_TTL_DAYS = 7;

// Uzupełnia organizację o dane z DARMOWEGO otwartego API KRS: kapitał zakładowy,
// datę rejestracji, pełne PKD i historię złożonych sprawozdań finansowych.
// Rejestr.io tych danych nie da bez abonamentu, a tu są za darmo.
//
// Nie rzuca wyjątkiem: brak wzbogacenia ma zubożyć kartę spółki, a nie wywrócić
// operację, w której środku jesteśmy.
export async function enrichOrgFromOpenKrs(
  supabase: SupabaseClient,
  krs: string,
  force = false,
): Promise<boolean> {
  if (!force) {
    const { data } = await supabase
      .from("registry_orgs")
      .select("enriched_at")
      .eq("krs", krs)
      .maybeSingle();
    if (data && !isStale(data.enriched_at, ORG_DETAILS_TTL_DAYS)) return false;
  }

  try {
    const found = await getCurrentExtract(krs);
    if (!found) return false;
    const details = parseOrgDetails(found.extract);

    const { error } = await supabase
      .from("registry_orgs")
      .update({
        capital_amount: details.capital_amount,
        capital_currency: details.capital_currency,
        registered_on: details.registered_on,
        last_entry_on: details.last_entry_on,
        last_entry_number: details.last_entry_number,
        pkd_all: details.pkd_all,
        enriched_at: new Date().toISOString(),
      })
      .eq("krs", krs);
    if (error) throw new Error(error.message);

    if (details.filings.length > 0) {
      // ignoreDuplicates jest tu krytyczne. Zwykly upsert nadpisalby kolumne
      // `source` wartoscia "krs_open" takze w wierszach, dla ktorych mamy juz
      // kwoty z Rejestr.io, a interfejs czyta `source`, zeby odroznic "kwot
      // jeszcze nie pobieralismy" od "sprawozdanie jest tylko jako PDF".
      // Po odswiezeniu po TTL spolka z kwotami zaczelaby klamac, ze ich nie ma.
      // Data zlozenia raz wpisanego sprawozdania i tak sie nie zmienia.
      const { error: filingsError } = await supabase
        .from("registry_org_financials")
        .upsert(
          details.filings.map((filing) => ({
            org_krs: krs,
            period_start: filing.period_start,
            period_end: filing.period_end,
            filed_on: filing.filed_on,
            source: "krs_open",
            synced_at: new Date().toISOString(),
          })),
          { onConflict: "org_krs,period_start,period_end", ignoreDuplicates: true },
        );
      if (filingsError) throw new Error(filingsError.message);
    }
    return true;
  } catch (err) {
    console.error(`enrichOrgFromOpenKrs ${krs}:`, err);
    return false;
  }
}

// Pobiera z płatnego API aktualne powiązania osoby i zapisuje je w cache'u.
// Zwraca liczbę zapisanych powiązań.
export async function syncPersonConnections(
  supabase: SupabaseClient,
  personId: number,
  ctx: CallContext,
): Promise<number> {
  // Plan Biznes daje też powiązania historyczne, czyli spółki, z których
  // polityk już wyszedł. Dziennikarz pyta o nie równie chętnie, co o obecne.
  //
  // Powiązania aktualne są obowiązkowe, historyczne nie. Gdyby abonament
  // wygasł, Rejestr.io odpowie na nie 403, a to nie może zablokować
  // podpinania tożsamości. Wolimy uboższe dane niż funkcję, która przestaje
  // działać w dniu, w którym nie przejdzie płatność.
  const current = await getPersonConnections(personId, ctx, "aktualne");
  let past: RioOrg[] = [];
  try {
    past = await getPersonConnections(personId, ctx, "historyczne");
  } catch (err) {
    console.error(`syncPersonConnections ${personId} historyczne:`, err);
  }
  const now = new Date().toISOString();

  // Pobrane listy to pełny obraz, więc kasujemy poprzedni stan, żeby zniknęły
  // powiązania, których już nie ma w rejestrze.
  const { error: deleteError } = await supabase
    .from("registry_connections")
    .delete()
    .eq("person_id", personId);
  if (deleteError) {
    throw new Error(`Czyszczenie powiazan: ${deleteError.message}`);
  }

  const rows: Record<string, unknown>[] = [];
  let currentCount = 0;

  for (const [orgs, isCurrent] of [[current, true], [past, false]] as const) {
    for (const org of orgs) {
      const krs = await upsertOrg(supabase, org);
      if (!krs) continue;
      // Wzbogacenie z darmowego API: kapitał, PKD, okresy sprawozdań.
      await enrichOrgFromOpenKrs(supabase, krs);
      for (const link of org.krs_powiazania_kwerendowane ?? []) {
        rows.push({
          person_id: personId,
          org_krs: krs,
          role_type: link.typ,
          direction: link.kierunek ?? null,
          date_start: link.data_start ?? null,
          date_end: link.data_koniec ?? null,
          is_current: isCurrent,
          synced_at: now,
        });
        if (isCurrent) currentCount += 1;
      }
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
    .update({
      connections_current: currentCount,
      connections_past: rows.length - currentCount,
      synced_at: now,
    })
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
// Sprawozdania finansowe (plan Biznes)
// ---------------------------------------------------------------------------

// Ile okresów rozliczeniowych pobieramy z kwotami. Treść dokumentu w JSON
// kosztuje więcej niż zwykłe wywołanie, więc bierzemy tylko najnowsze okresy.
// Rok poprzedni i tak jest w tym samym dokumencie, więc trzy pobrania dają
// cztery lata historii.
const FINANCIAL_PERIODS_WITH_AMOUNTS = 3;

// Uzupełnia kwoty przychodu i wyniku netto dla spółki.
// Historia okresów pochodzi z darmowego API MS (wzmianki), a kwoty stąd.
export async function syncFinancials(
  supabase: SupabaseClient,
  krs: string,
  ctx: CallContext,
): Promise<{ periods: number; with_amounts: number }> {
  const groups = await getFinancialDocuments(krs, ctx);
  let withAmounts = 0;

  for (const group of groups.slice(0, FINANCIAL_PERIODS_WITH_AMOUNTS)) {
    const documentId = findProfitAndLossDocument(group);

    // Brak wersji JSON: notujemy sam okres i flagę, żeby interfejs mógł
    // powiedzieć "sprawozdanie jest, ale tylko jako PDF", zamiast milczeć.
    if (!documentId) {
      await supabase.from("registry_org_financials").upsert(
        {
          org_krs: krs,
          period_start: group.data_start,
          period_end: group.data_koniec,
          has_json: false,
          source: "rejestrio",
          synced_at: new Date().toISOString(),
        },
        { onConflict: "org_krs,period_start,period_end" },
      );
      continue;
    }

    try {
      const doc = await getFinancialDocumentJson<FinancialDocument>(
        krs,
        documentId,
        ctx,
      );
      const amounts = extractFinancials(doc);
      const { error } = await supabase.from("registry_org_financials").upsert(
        {
          org_krs: krs,
          period_start: group.data_start,
          period_end: group.data_koniec,
          document_id: documentId,
          has_json: true,
          revenue: amounts.revenue,
          revenue_label: amounts.revenue_label,
          revenue_prev: amounts.revenue_prev,
          net_result: amounts.net_result,
          net_result_label: amounts.net_result_label,
          net_result_prev: amounts.net_result_prev,
          source: "rejestrio",
          synced_at: new Date().toISOString(),
        },
        { onConflict: "org_krs,period_start,period_end" },
      );
      if (error) throw new Error(error.message);
      withAmounts += 1;
    } catch (err) {
      // Pojedynczy nieparsowalny dokument nie może wywrócić całej synchronizacji.
      console.error(`syncFinancials ${krs} dok ${documentId}:`, err);
    }
  }

  return { periods: groups.length, with_amounts: withAmounts };
}

// ---------------------------------------------------------------------------
// Skład osobowy spółki i wykrywanie innych polityków
// ---------------------------------------------------------------------------

function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/\s+/g, " ")
    .trim();
}

interface MpMatch {
  sejm_mp_id: number;
  sejm_club: string | null;
  match_basis: "birth_date" | "name_only";
}

/**
 * Dopasowanie osoby z KRS do posła.
 *
 * Samo nazwisko to poszlaka, bo imienników jest pełno. Dopiero data urodzenia
 * (mamy ją z Rejestr.io od planu Biznes, a API Sejmu podaje `birthDate`)
 * daje dopasowanie, które można pokazać jako fakt. Rozróżnienie zapisujemy
 * w `match_basis`, żeby interfejs mógł oznaczyć słabsze trafienia.
 */
function matchToMp(
  fullName: string,
  birthDate: string | null,
  mps: { id: number; firstLastName: string; club?: string; birthDate?: string }[],
): MpMatch | null {
  const needle = normalizeName(fullName);
  const byName = mps.filter((mp) => normalizeName(mp.firstLastName ?? "") === needle);
  if (byName.length === 0) return null;

  if (birthDate) {
    const exact = byName.find((mp) => mp.birthDate === birthDate);
    if (exact) {
      return {
        sejm_mp_id: exact.id,
        sejm_club: exact.club ?? null,
        match_basis: "birth_date",
      };
    }
    // Nazwisko się zgadza, data nie. To NIE jest ten poseł, tylko imiennik.
    return null;
  }

  // Bez daty urodzenia zostaje poszlaka. Jednoznaczna tylko gdy w Sejmie jest
  // dokładnie jeden poseł o tym nazwisku.
  if (byName.length > 1) return null;
  return {
    sejm_mp_id: byName[0].id,
    sejm_club: byName[0].club ?? null,
    match_basis: "name_only",
  };
}

// Pobiera skład osobowy spółki i oznacza osoby, które są posłami.
export async function syncOrgPeople(
  supabase: SupabaseClient,
  krs: string,
  ctx: CallContext,
): Promise<{ people: number; politicians: number }> {
  const entries = await getOrgConnections(krs, ctx);
  const mps = await getMpList();
  const now = new Date().toISOString();

  const rows: Record<string, unknown>[] = [];
  let politicians = 0;

  for (const entry of entries) {
    // Powiązania organizacja z organizacją pomijamy: tu interesują nas ludzie.
    if (entry.typ !== "osoba") continue;
    const person = entry as RioPerson;
    const fullName = person.tozsamosc?.imiona_i_nazwisko ??
      `${person.tozsamosc?.imie ?? ""} ${person.tozsamosc?.nazwisko ?? ""}`.trim();
    const birthDate = person.tozsamosc?.data_urodzenia ?? null;
    const match = matchToMp(fullName, birthDate, mps);
    if (match) politicians += 1;

    for (const link of person.krs_powiazania_kwerendowane ?? []) {
      rows.push({
        org_krs: krs,
        person_id: person.id,
        full_name: fullName || "brak danych",
        birth_date: birthDate,
        role_type: link.typ,
        date_start: link.data_start ?? null,
        date_end: link.data_koniec ?? null,
        is_current: !link.data_koniec,
        sejm_mp_id: match?.sejm_mp_id ?? null,
        sejm_club: match?.sejm_club ?? null,
        match_basis: match?.match_basis ?? null,
        synced_at: now,
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("registry_org_people")
      .upsert(rows, { onConflict: "org_krs,person_id,role_type" });
    if (error) throw new Error(`Zapis skladu spolki: ${error.message}`);
  }

  return { people: rows.length, politicians };
}

// ---------------------------------------------------------------------------
// Wykrywanie zmian (darmowe)
// ---------------------------------------------------------------------------

// Ile obserwowanych spolek obsluguje jeden przebieg skanu. Chroni przed
// przekroczeniem limitu zapytan otwartego API MS.
const SCAN_MAX_ORGS_PER_RUN = 40;

export interface ScanResult {
  day: string;
  changed_in_krs: number;
  watched: number;
  matched: number;
  /** Trafienia ponad limit przebiegu. Wracaja przy kolejnym uruchomieniu. */
  skipped: number;
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

  const allMatched = (watches ?? []).filter((w) => changed.has(w.org_krs as string));

  // Kazde trafienie to jedno lub dwa zapytania do otwartego API MS (rejestr P,
  // potem S). Limit ministerstwa to ok. 100 zapytan na 15 minut z jednego IP,
  // wiec przy duzej liczbie obserwowanych spolek musimy sie zatrzymac.
  // Pominiete trafienia wracaja przy kolejnym przebiegu crona.
  const matched = allMatched.slice(0, SCAN_MAX_ORGS_PER_RUN);
  const skipped = allMatched.length - matched.length;
  if (skipped > 0) {
    console.warn(
      `registry scan ${day}: pominieto ${skipped} z ${allMatched.length} trafien ` +
        `(limit ${SCAN_MAX_ORGS_PER_RUN} na przebieg).`,
    );
  }
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
    matched: allMatched.length,
    skipped,
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

/**
 * Rdzenie nieniosace tresci PO obcieciu do 6 znakow. Osobna lista od STOPWORDS,
 * bo dopiero po przycieciu widac, ze "prowadzonych" i "prowadzenie" to ten sam
 * biurokratyczny wypelniacz. Bez tego debata o finansach panstwa dopasowuje sie
 * do kazdej spolki, ktora ma w PKD slowo "finansowa".
 */
const STOP_STEMS = new Set([
  "prowad", "dziala", "zmiana", "zmiani", "ustawa", "ustawy", "ustawi",
  "projek", "spraw", "sprawi", "inform", "rozstr", "wniose", "wniosk",
  "porzad", "dzienn", "sejmu", "rzadu", "polski", "krajow", "panstw",
  "przepi", "punkt", "punktu", "posiedz", "glosow", "komisj", "posel",
  "poselsk", "rzadow", "uzupel", "zwiazan", "dotycz", "niekto", "innych",
  "ogolne", "ogolny", "obywat", "narodo",
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
      .map((word) => word.slice(0, 6))
      .filter((stem) => !STOP_STEMS.has(stem)),
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
    // Relacja many-to-one, więc PostgREST zwraca jeden obiekt. Bez
    // wygenerowanych typów bazy supabase-js zakłada tablicę, stąd rzutowanie
    // przez unknown (inaczej TS słusznie mówi, że typy się nie pokrywają).
    const org = row.registry_orgs as unknown as
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

// ---------------------------------------------------------------------------
// Zestawienie spółki z dorobkiem parlamentarnym
// ---------------------------------------------------------------------------

export interface VoteHit {
  title: string;
  date: string;
  vote: string;
  matched_terms: string[];
}

/**
 * Głosowania polityka tematycznie bliskie branży spółki.
 *
 * Głosowania nie mają embeddingów (tabela `sejm_votings` przechowuje tytuł
 * i opis), więc dopasowanie jest leksykalne, na tych samych rdzeniach co
 * heurystyka konfliktu interesów. To wejście dla modelu, nie werdykt.
 */
export async function findRelatedVotes(
  supabase: SupabaseClient,
  tenantId: string,
  branchText: string,
  limit = 8,
): Promise<VoteHit[]> {
  const needle = stems(branchText);
  if (needle.size === 0) return [];

  const { data, error } = await supabase
    .from("politician_votes")
    .select("vote, sejm_votings(title, description, date)")
    .eq("tenant_id", tenantId)
    .limit(500);
  if (error) throw new Error(`Odczyt glosowan: ${error.message}`);

  const hits: VoteHit[] = [];
  for (const row of data ?? []) {
    // Jak wyżej: many-to-one zwraca obiekt, nie tablicę.
    const voting = row.sejm_votings as unknown as
      | { title: string; description: string | null; date: string }
      | null;
    if (!voting) continue;
    const haystack = stems(`${voting.title} ${voting.description ?? ""}`);
    const matched = [...needle].filter((term) => haystack.has(term));
    // Jedno wspolne slowo to zbieg okolicznosci, dopiero dwa sa sygnalem.
    if (matched.length < 2) continue;
    hits.push({
      title: voting.title,
      date: voting.date,
      vote: row.vote as string,
      matched_terms: matched,
    });
  }

  return hits
    .sort((a, b) => b.matched_terms.length - a.matched_terms.length)
    .slice(0, limit);
}

