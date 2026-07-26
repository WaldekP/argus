/**
 * Klient Edge Function `argus-registry` (powiązania z KRS).
 * Wiążący kontrakt: docs/kontrakt-rejestr-krs.md.
 *
 * Konwencja: POST {SUPABASE_URL}/functions/v1/argus-registry
 * z tokenem usera w Authorization i polem `operation` w body.
 * Odpowiedź: { ok: true, data } albo { ok: false, error }.
 *
 * Klucz do Rejestr.io nie pojawia się po stronie klienta. Cała komunikacja
 * z płatnym API idzie przez Edge Function.
 */

import { edgeClient } from '@/lib/api/client';

/** Do czego przypinamy tożsamość z rejestru. */
export type RegistrySubjectType = 'politician' | 'journalist' | 'outlet' | 'other';

/** Status dopasowania osoby. Potwierdza wyłącznie człowiek. */
export type RegistryMatchStatus = 'candidate' | 'confirmed' | 'rejected';

/** Kandydat z wyszukiwania po imieniu i nazwisku (operation: search_person). */
export type PersonCandidate = {
  person_id: number;
  full_name: string;
  middle_names: string | null;
  /** Data urodzenia z Rejestr.io (plan Biznes). Rozstrzyga imienników. */
  birth_date: string | null;
  connections_current: number;
  connections_past: number;
  organizations_preview: string[];
};

export type PersonSearchResult = {
  query: { first_name: string; last_name: string };
  candidates: PersonCandidate[];
  /** Więcej niż jeden wynik: interfejs musi ostrzec przed imiennikami. */
  ambiguous: boolean;
};

/**
 * Ostatnie sprawozdanie finansowe spółki.
 * Okres i data złożenia pochodzą z darmowego API KRS. Kwoty (revenue,
 * net_result) są null dopóki konto Rejestr.io nie ma planu Biznes.
 */
export type FinancialFiling = {
  period_start: string;
  period_end: string;
  filed_on: string | null;
  revenue: number | null;
  /**
   * Etykieta księgowa kwoty. W schemach Ministerstwa Finansów "przychód"
   * znaczy co innego dla spółki, a co innego dla organizacji pozarządowej.
   */
  revenue_label: string | null;
  revenue_prev: number | null;
  net_result: number | null;
  net_result_label: string | null;
  net_result_prev: number | null;
  currency: string;
  /** Spółki raportujące według MSSF składają tylko PDF, wtedy kwot nie ma. */
  has_json: boolean;
  /**
   * krs_open = mamy tylko wzmiankę z darmowego API, kwot nikt nie pobierał.
   * rejestrio = pytaliśmy o kwoty i wiemy, czy istnieją.
   */
  source: string;
};

/** Osoba w spółce, z ewentualnym dopasowaniem do posła. */
export type OrgPerson = {
  full_name: string;
  birth_date: string | null;
  role_label: string;
  date_start: string | null;
  date_end: string | null;
  is_current: boolean;
  sejm_mp_id: number | null;
  sejm_club: string | null;
  /** birth_date = dopasowanie pewne, name_only = do weryfikacji. */
  match_basis: 'birth_date' | 'name_only' | null;
};

/** Zestawienie branży spółki z dorobkiem parlamentarnym (operation: company_context). */
export type CompanyContext = {
  org_krs: string;
  summary: string;
  evidence: {
    risk?: 'brak' | 'pytanie' | 'ryzyko';
    votes?: { title: string; date: string; vote: string }[];
    statements?: { date: string; excerpt: string }[];
  };
  votes_found: number;
  statements_found: number;
  generated_at: string;
  from_cache: boolean;
};

/** Czego integracja nie wie i dlaczego. Interfejs to pokazuje wprost. */
export type RegistryLimits = {
  historical_connections: boolean;
  financial_amounts: boolean;
  note: string;
};

/** Powiązanie osoby ze spółką (operation: get_connections). */
export type RegistryConnection = {
  org_krs: string;
  role_type: string;
  role_label: string;
  direction: string | null;
  date_start: string | null;
  date_end: string | null;
  /** Fałsz dla powiązań zakończonych (plan Biznes daje też historyczne). */
  is_current: boolean;
  name: string;
  legal_form: string | null;
  branch: string | null;
  capital_amount: number | null;
  capital_currency: string | null;
  registered_on: string | null;
  status: Record<string, unknown>;
  latest_filing: FinancialFiling | null;
};

export type ConnectionsResult = {
  subject_id: string;
  refreshed: boolean;
  synced_at: string | null;
  connections: RegistryConnection[];
  limits: RegistryLimits;
};

/** Karta spółki (operation: get_org_details). */
export type OrgDetails = {
  org: {
    krs: string;
    name_full: string;
    name_short: string | null;
    nip: string | null;
    regon: string | null;
    legal_form: string | null;
    pkd_main_section: string | null;
    pkd_all: { code: string; description: string; main: boolean }[];
    capital_amount: number | null;
    capital_currency: string | null;
    registered_on: string | null;
    last_entry_on: string | null;
    last_entry_number: number | null;
    address: Record<string, unknown>;
    status: Record<string, unknown>;
  };
  filings: FinancialFiling[];
  people: OrgPerson[];
  /** Osoby ze spółki, które są posłami. */
  politicians: OrgPerson[];
  limits: RegistryLimits;
};

/** Podmiot z potwierdzoną (lub nie) tożsamością w rejestrze. */
export type RegistrySubject = {
  id: string;
  subject_type: RegistrySubjectType;
  subject_id: string | null;
  label: string;
  person_id: number | null;
  org_krs: string | null;
  match_status: RegistryMatchStatus;
  confirmed_at: string | null;
  connections_synced_at: string | null;
  registry_persons?: {
    full_name: string;
    connections_current: number;
    connections_past: number;
  } | null;
};

/** Zdarzenie w rejestrze dla obserwowanej spółki (operation: list_events). */
export type RegistryEvent = {
  id: string;
  org_krs: string;
  event_date: string;
  source: string;
  summary: string;
  seen: boolean;
  registry_orgs?: { name_full: string; legal_form: string | null } | null;
};

/** Sygnał możliwego konfliktu interesów (operation: check_conflicts). */
export type ConflictHit = {
  org_krs: string;
  org_name: string;
  role: string;
  role_label: string;
  branch: string | null;
  matched_terms: string[];
};

export type ConflictResult = {
  hits: ConflictHit[];
  disclaimer: string;
};

export type OrgSearchItem = {
  krs: string | null;
  name: string;
  nip: string | null;
  legal_form: string | null;
  branch: string | null;
  removed: boolean;
};

type RegistryOperation =
  | 'balance'
  | 'check_conflicts'
  | 'company_context'
  | 'get_connections'
  | 'get_org_details'
  | 'link_org'
  | 'link_person'
  | 'list_events'
  | 'list_subjects'
  | 'mark_event_seen'
  | 'refresh_connections'
  | 'search_org'
  | 'search_person'
  | 'unlink';

/** Klient tej domeny: transport w @/lib/api/client. */
const call = edgeClient<RegistryOperation>('argus-registry');

/** Stan konta w płatnym API. Wywołanie darmowe. */
export function getRegistryBalance() {
  return call<{ balance_pln: number; calls_total: number }>('balance');
}

/**
 * Wyszukanie osoby w KRS. Zwraca kandydatów do ręcznego wyboru.
 * Nigdy nie zakładaj, że pierwszy wynik to właściwa osoba.
 */
export function searchPerson(query: string) {
  return call<PersonSearchResult>('search_person', { query });
}

/** Potwierdzenie tożsamości i pobranie powiązań. */
export function linkPerson(params: {
  person_id: number;
  subject_type: RegistrySubjectType;
  subject_id?: string | null;
  label: string;
}) {
  return call<{ subject: RegistrySubject; connections: number; watched: number }>(
    'link_person',
    params,
  );
}

export function unlinkSubject(subjectId: string) {
  return call<{ ok: true }>('unlink', { subject_id: subjectId });
}

export function listSubjects() {
  return call<{ subjects: RegistrySubject[] }>('list_subjects');
}

export function getConnections(subjectId: string) {
  return call<ConnectionsResult>('get_connections', { subject_id: subjectId });
}

export function refreshConnections(subjectId: string) {
  return call<ConnectionsResult>('refresh_connections', { subject_id: subjectId });
}

export function searchOrg(criteria: { nazwa?: string; nip?: string }) {
  return call<{ organizations: OrgSearchItem[] }>('search_org', criteria);
}

/**
 * Karta spółki. Pierwsze otwarcie pobiera kwoty ze sprawozdań i skład osobowy
 * z płatnego API, kolejne idą z cache'u.
 */
export function getOrgDetails(krs: string, refresh = false) {
  return call<OrgDetails>('get_org_details', { krs, refresh });
}

/**
 * Zestawienie branży spółki z głosowaniami i wypowiedziami polityka.
 * Generowane przez model, cache'owane per tenant i spółka.
 */
export function getCompanyContext(krs: string, refresh = false) {
  return call<CompanyContext>('company_context', { krs, refresh });
}

export function linkOrg(params: {
  krs: string;
  subject_type: RegistrySubjectType;
  subject_id?: string | null;
  label?: string;
}) {
  return call<{ subject: RegistrySubject }>('link_org', params);
}

export function listEvents(params: { only_unseen?: boolean; limit?: number } = {}) {
  return call<{ events: RegistryEvent[] }>('list_events', params);
}

export function markEventSeen(eventId: string) {
  return call<{ ok: true }>('mark_event_seen', { event_id: eventId });
}

/**
 * Sygnały pokrycia tematu z powiązaniami kapitałowymi.
 * Wejście dla strażnika spójności i briefu, nie werdykt.
 */
export function checkConflicts(text: string) {
  return call<ConflictResult>('check_conflicts', { text });
}
