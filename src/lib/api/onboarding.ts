/**
 * Klient Edge Function `argus-onboarding` (TASK 3).
 * Wiążący kontrakt: docs/kontrakt-task-2-3.md. Zmiany kontraktu wymagają
 * aktualizacji tamtego pliku.
 *
 * Konwencja: POST {SUPABASE_URL}/functions/v1/argus-onboarding
 * z tokenem usera w Authorization i polem `operation` w body.
 * Odpowiedź: { ok: true, data } albo { ok: false, error }.
 */

import { edgeClient, GENERIC_ERROR, LONG_TIMEOUT_MS } from '@/lib/api/client';

/** Stan onboardingu zwracany przez get_status. */
export type OnboardingStatus =
  | 'not_started'
  | 'importing'
  | 'interview'
  | 'style'
  | 'segments'
  | 'done';

/** Wynik wyszukiwania posła (operation: search_mp). */
export type MpSearchResult = {
  mp_id: number;
  full_name: string;
  club: string;
  district_name: string;
  active: boolean;
};

/** Profil polityka. Kontrakt nie precyzuje pełnego kształtu, stąd luźny typ. */
export type PoliticianProfile = Record<string, unknown> & {
  full_name?: string;
  style_profile?: StyleProfile | null;
  /** Ręcznie wpisany kontekst z ekranu Profil (operation: update_context). */
  bio?: string | null;
  party_profile?: string | null;
  topic_positions?: string | null;
};

/** Trzy pola kontekstu edytowane na ekranie Profil, wolny tekst. */
export type ProfileContext = {
  bio: string;
  party_profile: string;
  topic_positions: string;
};

/** Limit długości pojedynczego pola kontekstu (spójny z backendem). */
export const CONTEXT_FIELD_MAX_LENGTH = 4000;

/** Dane mandatu wyciągnięte z luźnego profilu, gotowe do pokazania w UI. */
export type MpIdentity = {
  /** Identyfikator w API Sejmu albo null dla polityka spoza Sejmu. */
  mp_id: number | null;
  full_name: string;
  club: string | null;
  district_name: string | null;
  district_num: number | null;
  voivodeship: string | null;
};

/**
 * Odczyt danych mandatu z profilu. Backend trzyma okręg w polu `district`
 * (jsonb), więc UI nie powinno sięgać po surowe klucze w wielu miejscach.
 * Zwraca null, gdy profilu nie ma albo nie zna nawet nazwiska.
 */
export function readMpIdentity(profile: PoliticianProfile | null): MpIdentity | null {
  if (!profile) {
    return null;
  }
  const fullName = typeof profile.full_name === 'string' ? profile.full_name.trim() : '';
  if (!fullName) {
    return null;
  }
  const district = (profile.district ?? {}) as Record<string, unknown>;
  const asText = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  const asNumber = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  return {
    mp_id: asNumber(profile.mp_id),
    full_name: fullName,
    club: asText(district.club),
    district_name: asText(district.name),
    district_num: asNumber(district.num),
    voivodeship: asText(district.voivodeship),
  };
}

/** Liczby zaimportowanych rekordów (operation: import_sejm_data). */
export type ImportCounts = {
  votings: number;
  votes: number;
  statements: number;
};

export type ImportPhase = 'votings' | 'statements' | 'embeddings' | 'done';

/**
 * Jeden krok porcjowanego importu (kontrakt: limit zasobów workera Edge
 * Functions wymusza pętlę małych wywołań aż do next: false).
 */
export type ImportStepResult = {
  phase: ImportPhase;
  processed: number;
  total: number;
  next: boolean;
  imported?: ImportCounts;
  profile?: PoliticianProfile;
};

/** Stan onboardingu i profil (operation: get_status). */
export type StatusResult = {
  has_profile: boolean;
  onboarding_status: OnboardingStatus;
  profile: PoliticianProfile | null;
  counts: { votes: number; statements: number };
};

/** Krok wywiadu założycielskiego (operation: interview_turn). */
export type InterviewTurnResult = {
  question: string | null;
  done: boolean;
  /** Postęp wywiadu w zakresie 0-1. */
  progress: number;
  transcript_length: number;
};

/** Profil stylu językowego polityka. Klucze po polsku zgodnie z kontraktem. */
export type StyleProfile = {
  ton: string;
  dlugosc_zdan: string;
  slownictwo: string[];
  zwroty_charakterystyczne: string[];
  czego_unika: string[];
  przyklad_wypowiedzi: string;
};

/**
 * Normalizacja profilu stylu: model potrafi pominąć pole, a UI renderuje
 * wszystkie sekcje, więc każde pole dostaje bezpieczny default.
 */
export function normalizeStyleProfile(raw: unknown): StyleProfile {
  const source = (raw ?? {}) as Partial<Record<keyof StyleProfile, unknown>>;
  const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
  const asList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  return {
    ton: asText(source.ton),
    dlugosc_zdan: asText(source.dlugosc_zdan),
    slownictwo: asList(source.slownictwo),
    zwroty_charakterystyczne: asList(source.zwroty_charakterystyczne),
    czego_unika: asList(source.czego_unika),
    przyklad_wypowiedzi: asText(source.przyklad_wypowiedzi),
  };
}

export type SegmentPriority = 'mobilize' | 'persuade' | 'ignore';

/** Segment wyborców (operation: suggest_segments / finalize). */
export type Segment = {
  name: string;
  size_estimate: number | null;
  priority: SegmentPriority;
  profile: {
    opis: string;
    tematy: string[];
    jezyk_dziala: string[];
    jezyk_odrzuca: string[];
    kanaly: string[];
  };
};

/** Pełna karta posła z API Sejmu (operation: mp_details). */
export type MpDetails = {
  mp_id: number;
  full_name: string;
  first_name: string | null;
  second_name: string | null;
  last_name: string | null;
  active: boolean;
  /** Powód wygaszenia mandatu, tylko gdy active jest false. */
  inactive_cause: string | null;
  waiver_desc: string | null;
  club: string | null;
  district_name: string | null;
  district_num: number | null;
  voivodeship: string | null;
  /** Liczba głosów oddanych na posła w wyborach. */
  number_of_votes: number | null;
  profession: string | null;
  education_level: string | null;
  birth_date: string | null;
  birth_location: string | null;
  email: string | null;
};

/** Poseł na pełnej liście posłów (operation: list_mps, ekran Dane → Politycy). */
export type MpListItem = {
  mp_id: number;
  full_name: string;
  club: string | null;
  district_name: string | null;
  voivodeship: string | null;
  active: boolean;
  number_of_votes: number | null;
};

/** Wystąpienie sejmowe na liście (operation: list_statements). */
export type StatementListItem = {
  id: string;
  date: string | null;
  /** Adres stenogramu w API Sejmu. */
  url: string | null;
  excerpt: string;
  truncated: boolean;
  char_count: number;
};

export type StatementsPage = {
  statements: StatementListItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

/** Pełna treść wystąpienia (operation: get_statement). */
export type StatementFull = {
  id: string;
  date: string | null;
  url: string | null;
  text: string;
};

type OnboardingOperation =
  | 'search_mp'
  | 'list_mps'
  | 'import_sejm_data'
  | 'get_status'
  | 'update_context'
  | 'mp_details'
  | 'list_statements'
  | 'get_statement'
  | 'interview_turn'
  | 'generate_style_profile'
  | 'update_style_profile'
  | 'finalize_style'
  | 'suggest_segments'
  | 'finalize';

/** Pojedynczy krok importu jest mały, ale dajemy zapas na wolne API Sejmu. */
const IMPORT_STEP_TIMEOUT_MS = 120_000;
/** Bezpiecznik pętli importu: krok liczy porcję, więcej niż 400 = coś nie tak. */
const IMPORT_MAX_STEPS = 400;


/**
 * Bazowe wywołanie Edge Function. Zwraca `data` z odpowiedzi albo rzuca
 * Error z komunikatem po polsku (gotowym do pokazania w UI).
 */
/** Klient tej domeny: transport w @/lib/api/client, tu tylko lista operacji. */
const callOnboarding = edgeClient<OnboardingOperation>('argus-onboarding');

/** Wyszukiwanie posła po fragmencie nazwiska (min 2 znaki, max 10 wyników). */
export async function searchMp(query: string): Promise<MpSearchResult[]> {
  const data = await callOnboarding<{ mps: MpSearchResult[] }>('search_mp', { query });
  return data.mps;
}

/**
 * Pełna lista posłów kadencji z API Sejmu (ekran Dane → Politycy).
 * Lista jest mała (ok. 460 pozycji), więc filtrowanie robimy na kliencie.
 */
export async function listMps(): Promise<MpListItem[]> {
  const data = await callOnboarding<{ mps: MpListItem[] }>('list_mps', {}, LONG_TIMEOUT_MS);
  return data.mps;
}

/** Jeden krok porcjowanego importu danych posła. */
export function importSejmStep(mpId: number): Promise<ImportStepResult> {
  return callOnboarding<ImportStepResult>(
    'import_sejm_data',
    { mp_id: mpId },
    IMPORT_STEP_TIMEOUT_MS
  );
}

/**
 * Pełny import: woła import_sejm_data w pętli aż do next: false,
 * raportując postęp po każdym kroku. Pojedynczy błąd kroku jest ponawiany
 * raz (kroki są idempotentne), dopiero drugi z rzędu przerywa import.
 */
export async function runSejmImport(
  mpId: number,
  onProgress: (step: ImportStepResult) => void
): Promise<ImportStepResult> {
  // API Sejmu bywa bardzo wolne: pojedynczy krok ponawiamy do 3 razy.
  let attempts = 0;
  for (let i = 0; i < IMPORT_MAX_STEPS; i += 1) {
    let step: ImportStepResult;
    try {
      step = await importSejmStep(mpId);
      attempts = 0;
    } catch (error) {
      attempts += 1;
      if (attempts >= 3) {
        throw error;
      }
      continue;
    }
    onProgress(step);
    if (!step.next) {
      return step;
    }
  }
  throw new Error(GENERIC_ERROR);
}

/** Stan onboardingu, profil i liczniki danych. */
export function getStatus(): Promise<StatusResult> {
  return callOnboarding<StatusResult>('get_status');
}

/**
 * Zapis ręcznie wpisanego kontekstu (o kandydacie, o partii, stanowiska).
 * Przekazuj tylko pola, które chcesz zmienić; puste stringi backend zapisuje
 * jako brak danych. Zwraca zaktualizowany profil.
 */
export async function updateContext(
  patch: Partial<ProfileContext>
): Promise<PoliticianProfile> {
  const data = await callOnboarding<{ profile: PoliticianProfile }>('update_context', patch);
  return data.profile;
}

/**
 * Pełna karta posła prosto z API Sejmu. Danych nie trzymamy w bazie, bo klub
 * i status mandatu zmieniają się w trakcie kadencji.
 */
export async function getMpDetails(): Promise<MpDetails> {
  const data = await callOnboarding<{ mp: MpDetails }>('mp_details');
  return data.mp;
}

/** Strona listy wystąpień sejmowych, od najnowszych. */
export function listStatements(params?: {
  limit?: number;
  offset?: number;
}): Promise<StatementsPage> {
  return callOnboarding<StatementsPage>('list_statements', {
    limit: params?.limit,
    offset: params?.offset,
  });
}

/** Pełna treść jednego wystąpienia. */
export async function getStatement(id: string): Promise<StatementFull> {
  const data = await callOnboarding<{ statement: StatementFull }>('get_statement', { id });
  return data.statement;
}

/** Krok wywiadu. Bez `answer` zwraca pierwsze pytanie lub wznawia wywiad. */
export function interviewTurn(answer?: string): Promise<InterviewTurnResult> {
  return callOnboarding<InterviewTurnResult>(
    'interview_turn',
    answer === undefined ? undefined : { answer }
  );
}

/** Generuje profil stylu językowego z próbki wystąpień posła. */
export async function generateStyleProfile(): Promise<StyleProfile> {
  const data = await callOnboarding<{ style_profile: unknown }>('generate_style_profile');
  return normalizeStyleProfile(data.style_profile);
}

/** Kalibracja profilu stylu na podstawie uwag usera. */
export async function updateStyleProfile(feedback: string): Promise<StyleProfile> {
  const data = await callOnboarding<{ style_profile: unknown }>('update_style_profile', {
    feedback,
  });
  return normalizeStyleProfile(data.style_profile);
}

/** Akceptacja profilu stylu. Backend przechodzi do kroku segmentów. */
export async function finalizeStyle(): Promise<void> {
  await callOnboarding<{ ok: true }>('finalize_style');
}

/**
 * Normalizacja segmentu: jak przy stylu, model może pominąć pole,
 * a UI renderuje wszystkie sekcje karty.
 */
export function normalizeSegment(raw: unknown): Segment {
  const source = (raw ?? {}) as Partial<Record<keyof Segment, unknown>>;
  const profile = (source.profile ?? {}) as Partial<Record<string, unknown>>;
  const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
  const asList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const priority: SegmentPriority =
    source.priority === 'mobilize' || source.priority === 'ignore' ? source.priority : 'persuade';
  return {
    name: asText(source.name) || 'Segment bez nazwy',
    size_estimate: typeof source.size_estimate === 'number' ? source.size_estimate : null,
    priority,
    profile: {
      opis: asText(profile.opis),
      tematy: asList(profile.tematy),
      jezyk_dziala: asList(profile.jezyk_dziala),
      jezyk_odrzuca: asList(profile.jezyk_odrzuca),
      kanaly: asList(profile.kanaly),
    },
  };
}

/** Propozycja 5 segmentów wyborców na bazie okręgu i profilu. */
export async function suggestSegments(): Promise<Segment[]> {
  const data = await callOnboarding<{ segments: unknown[] }>('suggest_segments');
  const list = Array.isArray(data.segments) ? data.segments : [];
  return list.map(normalizeSegment);
}

/** Zapis segmentów po edycji usera i zakończenie onboardingu. */
export async function finalizeSegments(segments: Segment[]): Promise<void> {
  await callOnboarding<{ ok: true }>('finalize', { segments });
}
