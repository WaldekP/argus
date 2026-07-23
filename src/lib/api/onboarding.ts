/**
 * Klient Edge Function `argus-onboarding` (TASK 3).
 * Wiążący kontrakt: docs/kontrakt-task-2-3.md. Zmiany kontraktu wymagają
 * aktualizacji tamtego pliku.
 *
 * Konwencja: POST {SUPABASE_URL}/functions/v1/argus-onboarding
 * z tokenem usera w Authorization i polem `operation` w body.
 * Odpowiedź: { ok: true, data } albo { ok: false, error }.
 */

import { supabase } from '@/lib/supabase';

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
};

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

type OnboardingOperation =
  | 'search_mp'
  | 'import_sejm_data'
  | 'get_status'
  | 'interview_turn'
  | 'generate_style_profile'
  | 'update_style_profile'
  | 'finalize_style'
  | 'suggest_segments'
  | 'finalize';

const DEFAULT_TIMEOUT_MS = 60_000;
/** Pojedynczy krok importu jest mały, ale dajemy zapas na wolne API Sejmu. */
const IMPORT_STEP_TIMEOUT_MS = 120_000;
/** Bezpiecznik pętli importu: krok liczy porcję, więcej niż 400 = coś nie tak. */
const IMPORT_MAX_STEPS = 400;

const GENERIC_ERROR = 'Coś poszło nie tak. Spróbuj ponownie za chwilę.';
const NETWORK_ERROR = 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
const TIMEOUT_ERROR = 'Operacja trwała zbyt długo. Spróbuj ponownie.';
const SESSION_ERROR = 'Sesja wygasła. Zaloguj się ponownie.';

/**
 * Bazowe wywołanie Edge Function. Zwraca `data` z odpowiedzi albo rzuca
 * Error z komunikatem po polsku (gotowym do pokazania w UI).
 */
async function callOnboarding<T>(
  operation: OnboardingOperation,
  payload?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error(GENERIC_ERROR);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error(SESSION_ERROR);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/argus-onboarding`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operation, ...payload }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR);
    }
    throw new Error(NETWORK_ERROR);
  } finally {
    clearTimeout(timer);
  }

  let body: { ok?: boolean; data?: T; error?: string } | null = null;
  try {
    body = (await response.json()) as { ok?: boolean; data?: T; error?: string };
  } catch {
    body = null;
  }

  if (!body || body.ok !== true) {
    if (body?.error && typeof body.error === 'string') {
      throw new Error(body.error);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(SESSION_ERROR);
    }
    throw new Error(GENERIC_ERROR);
  }

  return body.data as T;
}

/** Wyszukiwanie posła po fragmencie nazwiska (min 2 znaki, max 10 wyników). */
export async function searchMp(query: string): Promise<MpSearchResult[]> {
  const data = await callOnboarding<{ mps: MpSearchResult[] }>('search_mp', { query });
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
