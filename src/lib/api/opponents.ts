/**
 * Klient Edge Function `argus-opponents`: teczka oponenta.
 *
 * Teczka to wypowiedzi przeciwnika z ostatniego roku zebrane wyszukiwaniem
 * w sieci, każda z datą, źródłem i kategorią (kontrowersja, sprzeczność
 * z programem, zmiana zdania, podważona przez fakty), plus podsumowanie
 * z punktami ataku. Powstaje w porcjowanej pętli: `create`, potem `step`
 * aż do `next: false`, kilka minut łącznie.
 *
 * Kontrakt: docs/kontrakt-teczka-oponenta.md
 */

import { edgeClient, GENERIC_ERROR } from '@/lib/api/client';

type OpponentsOperation = 'create' | 'step' | 'get' | 'list' | 'refresh' | 'delete';

const callOpponents = edgeClient<OpponentsOperation>('argus-opponents');

/**
 * Jeden krok to jeden przebieg z kilkoma wyszukiwaniami: serwer daje mu do
 * 125 sekund, więc klient czeka dłużej niż zwykłe operacje długie.
 */
const STEP_TIMEOUT_MS = 170_000;
/** Ponowienie kroku przy błędzie sieci. Serwer sam przechodzi dalej po nieudanym przebiegu. */
const STEP_MAX_ATTEMPTS = 2;
const LOOP_MAX_STEPS = 12;

export type DossierCategory =
  | 'kontrowersja'
  | 'sprzecznosc-z-programem'
  | 'zmiana-zdania'
  | 'zweryfikowane-przez-fakty'
  | 'wypowiedz';

export const CATEGORY_LABELS: Record<DossierCategory, string> = {
  kontrowersja: 'Kontrowersja',
  'sprzecznosc-z-programem': 'Sprzeczne z programem',
  'zmiana-zdania': 'Zmiana zdania',
  'zweryfikowane-przez-fakty': 'Podważone przez fakty',
  wypowiedz: 'Wypowiedź',
};

/** Kolejność na ekranie: najpierw amunicja, na końcu tło. */
export const CATEGORY_ORDER: DossierCategory[] = [
  'kontrowersja',
  'sprzecznosc-z-programem',
  'zmiana-zdania',
  'zweryfikowane-przez-fakty',
  'wypowiedz',
];

export type DossierItem = {
  id: string;
  /** RRRR-MM-DD, RRRR-MM albo null, gdy źródło nie podaje daty. */
  date: string | null;
  /** Dosłowny cytat albo tekst zaczynający się od „[parafraza]". */
  quote: string;
  context: string;
  source_url: string;
  source_title: string;
  category: DossierCategory;
  why_it_matters: string;
  later_facts: string | null;
  later_facts_url: string | null;
  pass: string;
};

export type AttackPoint = {
  teza: string;
  item_ids: string[];
  jak_uzyc: string;
  obrona_przeciwnika: string;
};

export type DossierSummary = {
  linia?: string;
  punkty_ataku?: AttackPoint[];
  czego_unikac?: string[];
  luki?: string[];
  identity_notes?: string[];
  failed_passes?: string[];
};

export type DossierStatus = 'collecting' | 'done' | 'error';

export type OpponentDossier = {
  id: string;
  full_name: string;
  role_hint: string | null;
  party: string | null;
  mp_id: number | null;
  notes: string | null;
  status: DossierStatus;
  pass_index: number;
  items: DossierItem[];
  summary: DossierSummary | null;
  search_count: number;
  /** Powód zatrzymania przy statusie `error`, gotowy do pokazania. */
  error: string | null;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
  passes: { id: string; label: string }[];
};

export type OpponentDossierListItem = {
  id: string;
  full_name: string;
  role_hint: string | null;
  party: string | null;
  status: DossierStatus;
  pass_index: number;
  items_count: number;
  updated_at: string;
};

export type DossierStep = {
  phase: string;
  processed: number;
  total: number;
  next: boolean;
  items_count?: number;
};

export type NewDossierInput = {
  full_name: string;
  role_hint?: string;
  party?: string;
  mp_id?: number;
  notes?: string;
};

export function createDossier(input: NewDossierInput): Promise<{ id: string }> {
  return callOpponents<{ id: string }>('create', input);
}

export function getDossier(id: string): Promise<OpponentDossier> {
  return callOpponents<OpponentDossier>('get', { id });
}

export function listDossiers(): Promise<OpponentDossierListItem[]> {
  return callOpponents<OpponentDossierListItem[]>('list');
}

export function refreshDossier(id: string): Promise<{ id: string }> {
  return callOpponents<{ id: string }>('refresh', { id });
}

export function deleteDossier(id: string): Promise<{ deleted: boolean }> {
  return callOpponents<{ deleted: boolean }>('delete', { id });
}

/**
 * Pętla przebiegów aż do `next: false`, z postępem po każdym kroku.
 * Pojedynczy błąd sieci ponawiamy raz; przebieg, który wywrócił się po
 * stronie serwera, nie wraca jako błąd, tylko jako luka w teczce.
 */
export async function runDossier(
  id: string,
  onProgress: (step: DossierStep) => void
): Promise<void> {
  let attempts = 0;
  for (let i = 0; i < LOOP_MAX_STEPS; i += 1) {
    let step: DossierStep;
    try {
      step = await callOpponents<DossierStep>('step', { id }, STEP_TIMEOUT_MS);
      attempts = 0;
    } catch (error) {
      attempts += 1;
      if (attempts >= STEP_MAX_ATTEMPTS) throw error;
      continue;
    }
    onProgress(step);
    if (!step.next) return;
  }
  throw new Error(GENERIC_ERROR);
}
