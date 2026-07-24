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

import { supabase } from '@/lib/supabase';

/** Do czego przypinamy tożsamość z rejestru. */
export type RegistrySubjectType = 'politician' | 'journalist' | 'outlet' | 'other';

/** Status dopasowania osoby. Potwierdza wyłącznie człowiek. */
export type RegistryMatchStatus = 'candidate' | 'confirmed' | 'rejected';

/** Kandydat z wyszukiwania po imieniu i nazwisku (operation: search_person). */
export type PersonCandidate = {
  person_id: number;
  full_name: string;
  middle_names: string | null;
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

/** Powiązanie osoby ze spółką (operation: get_connections). */
export type RegistryConnection = {
  org_krs: string;
  role_type: string;
  role_label: string;
  date_start: string | null;
  name: string;
  legal_form: string | null;
  branch: string | null;
  status: Record<string, unknown>;
};

export type ConnectionsResult = {
  subject_id: string;
  refreshed: boolean;
  synced_at: string | null;
  connections: RegistryConnection[];
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

async function call<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('argus-registry', {
    body: { operation, ...payload },
  });

  if (error) {
    // Supabase pakuje treść błędu funkcji w kontekst odpowiedzi.
    const context = (error as { context?: Response }).context;
    if (context) {
      const body = await context.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw new Error(error.message);
  }
  if (!data?.ok) throw new Error(data?.error ?? 'Nieznany błąd rejestru.');
  return data.data as T;
}

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
