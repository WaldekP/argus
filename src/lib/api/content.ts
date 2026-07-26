/**
 * Klient Edge Function `argus-content` (TASK 7, generator przekazu).
 * Wiążący kontrakt: docs/kontrakt-task-7.md. Zmiany kontraktu wymagają
 * aktualizacji tamtego pliku.
 *
 * Konwencja: POST {SUPABASE_URL}/functions/v1/argus-content
 * z tokenem usera w Authorization i polem `operation` w body.
 * Odpowiedź: { ok: true, data } albo { ok: false, error }.
 */

import { edgeClient, GENERIC_ERROR } from '@/lib/api/client';
import type { SegmentPriority } from '@/lib/api/onboarding';

/** Kanały przekazu (kontrakt) i ich etykiety w UI. */
export type Channel = 'fb' | 'x' | 'tiktok' | 'prasa';

export const CHANNELS: Channel[] = ['fb', 'x', 'tiktok', 'prasa'];

export const CHANNEL_LABELS: Record<Channel, string> = {
  fb: 'Facebook',
  x: 'X',
  tiktok: 'TikTok (skrypt)',
  prasa: 'Prasa lokalna',
};

/** Etykieta kanału dla wariantu. Nieznany kanał pokazujemy bez tłumaczenia. */
export function channelLabel(channel: string): string {
  return (CHANNEL_LABELS as Record<string, string>)[channel] ?? channel;
}

/** Segment tenanta do wyboru w formularzu (operation: list_segments). */
export type ContentSegment = {
  id: string;
  name: string;
  priority: SegmentPriority;
};

export type DraftStatus = 'draft' | 'accepted' | 'rejected';

/** Jeden wariant treści (segment × kanał). */
export type ContentVariant = {
  segment_id: string | null;
  segment_name: string;
  channel: string;
  text: string;
};

/** Alert strażnika spójności zapisany w drafcie. */
export type ConsistencyAlert = {
  description: string;
  conflict_statement_id: string | null;
  suggested_response: string;
};

/** Pełny draft przekazu (operation: get). */
export type ContentDraft = {
  id: string;
  topic: string;
  /** Powiązanie z tematem: slug korpusu albo `dossier:<uuid>`. Null = brak. */
  topic_ref: string | null;
  core_message: string | null;
  status: DraftStatus;
  created_at: string;
  variants: ContentVariant[];
  consistency_check: { alerts: ConsistencyAlert[] };
};

/** Pozycja listy draftów (operation: list). */
export type DraftListItem = {
  id: string;
  topic: string;
  /** Powiązanie z tematem: slug korpusu albo `dossier:<uuid>`. Null = brak. */
  topic_ref: string | null;
  status: DraftStatus;
  created_at: string;
  variants_count: number;
  alerts_count: number;
};

/**
 * Segment do generacji w trybie "z tematu". `id` to UUID segmentu tenanta albo
 * id segmentu korpusu prefiksowane `corpus:` (patrz corpusSegmentId). Framing
 * per segment jedzie osobno w TopicFraming.segments (kluczowany tym samym id).
 */
export type SegmentInput = {
  id: string;
  name: string;
};

/** Prefiks id segmentu korpusu tematycznego (grupa wyborców z bazy wiedzy). */
export const CORPUS_SEGMENT_PREFIX = 'corpus:';

/** Buduje id segmentu korpusu do planu generacji z lokalnego id segmentu korpusu. */
export function corpusSegmentId(id: string): string {
  return `${CORPUS_SEGMENT_PREFIX}${id}`;
}

/** Wynik utworzenia draftu (operation: create). */
export type CreateDraftResult = {
  draft_id: string;
  total_variants: number;
};

/** Framing per segment tenanta (klucz mapy segments w TopicFraming). */
export type SegmentFraming = {
  kat?: string;
  coDziala?: string[];
  czegoUnikac?: string[];
  przyklad?: string;
};

/**
 * Framing z tematu bazy wiedzy przekazywany do generatora (most zakładka
 * Tematy → argus-content). Klient rozwiązuje mapowanie segmentów korpusu na
 * segmenty tenanta, więc `segments` jest kluczowane po ID segmentu tenanta.
 * Kontrakt: docs/kontrakt-task-7.md, projekt: docs/plan-wyborczy-petru/faza-2-generator.md.
 */
export type TopicFraming = {
  slug?: string;
  stanowisko?: string;
  podchwycic?: string[];
  zaatakowac?: string[];
  segments?: Record<string, SegmentFraming>;
};

/** Jeden krok porcjowanej generacji wariantów (operation: generate_step). */
export type GenerateStepResult = {
  processed: number;
  total: number;
  next: boolean;
  consistency_done: boolean;
};

type ContentOperation =
  | 'list_segments'
  | 'create'
  | 'generate_step'
  | 'get'
  | 'list'
  | 'regenerate_variant'
  | 'set_status';

/** Krok generacji woła Sonneta (do 2 wariantów), dajemy zapas czasu. */
const GENERATE_STEP_TIMEOUT_MS = 120_000;
/** Regeneracja wariantu to też wywołanie modelu. */
const REGENERATE_TIMEOUT_MS = 120_000;
/** Bezpiecznik pętli generacji: krok robi do 2 wariantów, 200 kroków to aż nadto. */
const GENERATE_MAX_STEPS = 200;


/**
 * Bazowe wywołanie Edge Function. Zwraca `data` z odpowiedzi albo rzuca
 * Error z komunikatem po polsku (gotowym do pokazania w UI).
 */
/** Klient tej domeny: transport w @/lib/api/client, tu tylko lista operacji. */
const callContent = edgeClient<ContentOperation>('argus-content');

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

/** Normalizacja statusu: nieznana wartość traktowana jak szkic. */
function normalizeStatus(raw: unknown): DraftStatus {
  return raw === 'accepted' || raw === 'rejected' ? raw : 'draft';
}

/**
 * Normalizacja wariantu: model lub backend może pominąć pole,
 * a UI renderuje wszystkie części karty, więc każde pole ma default.
 */
export function normalizeVariant(raw: unknown): ContentVariant {
  const source = (raw ?? {}) as Partial<Record<keyof ContentVariant, unknown>>;
  return {
    segment_id: typeof source.segment_id === 'string' ? source.segment_id : null,
    segment_name: asText(source.segment_name) || 'Ogólny',
    channel: asText(source.channel),
    text: asText(source.text),
  };
}

/** Normalizacja alertu spójności (defaulty na brakujące pola). */
export function normalizeAlert(raw: unknown): ConsistencyAlert {
  const source = (raw ?? {}) as Partial<Record<keyof ConsistencyAlert, unknown>>;
  return {
    description: asText(source.description),
    conflict_statement_id:
      typeof source.conflict_statement_id === 'string' ? source.conflict_statement_id : null,
    suggested_response: asText(source.suggested_response),
  };
}

/** Normalizacja pełnego draftu z operation: get. */
export function normalizeDraft(raw: unknown): ContentDraft {
  const source = (raw ?? {}) as Partial<Record<keyof ContentDraft, unknown>>;
  const check = (source.consistency_check ?? {}) as { alerts?: unknown };
  const variants = Array.isArray(source.variants) ? source.variants : [];
  const alerts = Array.isArray(check.alerts) ? check.alerts : [];
  return {
    id: asText(source.id),
    topic: asText(source.topic),
    topic_ref: typeof source.topic_ref === 'string' ? source.topic_ref : null,
    core_message: typeof source.core_message === 'string' ? source.core_message : null,
    status: normalizeStatus(source.status),
    created_at: asText(source.created_at),
    variants: variants.map(normalizeVariant),
    consistency_check: { alerts: alerts.map(normalizeAlert) },
  };
}

/** Normalizacja pozycji listy draftów. */
export function normalizeDraftListItem(raw: unknown): DraftListItem {
  const source = (raw ?? {}) as Partial<Record<keyof DraftListItem, unknown>>;
  return {
    id: asText(source.id),
    topic: asText(source.topic),
    topic_ref: typeof source.topic_ref === 'string' ? source.topic_ref : null,
    status: normalizeStatus(source.status),
    created_at: asText(source.created_at),
    variants_count: asCount(source.variants_count),
    alerts_count: asCount(source.alerts_count),
  };
}

/** Segmenty tenanta do formularza. Pusta lista, gdy onboarding pominięty. */
export async function listSegments(): Promise<ContentSegment[]> {
  const data = await callContent<{ segments: unknown[] }>('list_segments');
  const list = Array.isArray(data.segments) ? data.segments : [];
  return list
    .map((raw) => {
      const source = (raw ?? {}) as Partial<Record<keyof ContentSegment, unknown>>;
      const priority: SegmentPriority =
        source.priority === 'mobilize' || source.priority === 'ignore'
          ? source.priority
          : 'persuade';
      return {
        id: asText(source.id),
        name: asText(source.name) || 'Segment bez nazwy',
        priority,
      };
    })
    .filter((segment) => segment.id.length > 0);
}

/**
 * Utworzenie draftu. Segmenty przez `segments` (tryb "z tematu", miesza segmenty
 * tenanta z segmentami korpusu) albo legacy `segment_ids` (wyłącznie tenant).
 * Puste w obu = warianty ogólne. `topic_ref` wiąże draft z tematem (slug korpusu
 * albo `dossier:<uuid>`) dla listy per temat.
 */
export async function createDraft(input: {
  topic: string;
  core_message?: string;
  segment_ids?: string[];
  segments?: SegmentInput[];
  channels: Channel[];
  /** Opcjonalny slug tematu bazy wiedzy, z którego pochodzi framing. */
  topic_slug?: string;
  /** Opcjonalny framing (stanowisko, podchwycić, zaatakować, per segment). */
  topic_framing?: TopicFraming;
  /** Powiązanie z tematem: slug korpusu albo `dossier:<uuid>`. */
  topic_ref?: string;
}): Promise<CreateDraftResult> {
  const data = await callContent<Partial<CreateDraftResult>>('create', input);
  return {
    draft_id: asText(data.draft_id),
    total_variants: asCount(data.total_variants),
  };
}

/** Jeden krok porcjowanej generacji wariantów. */
export async function generateStep(draftId: string): Promise<GenerateStepResult> {
  const data = await callContent<Partial<GenerateStepResult>>(
    'generate_step',
    { draft_id: draftId },
    GENERATE_STEP_TIMEOUT_MS
  );
  return {
    processed: asCount(data.processed),
    total: asCount(data.total),
    next: data.next === true,
    consistency_done: data.consistency_done === true,
  };
}

/**
 * Pełna generacja: woła generate_step w pętli aż do next: false,
 * raportując postęp po każdym kroku. Pojedynczy błąd kroku jest ponawiany
 * raz (kroki są idempotentne), dopiero drugi z rzędu przerywa generację.
 */
export async function runGeneration(
  draftId: string,
  onProgress: (step: GenerateStepResult) => void
): Promise<GenerateStepResult> {
  let retried = false;
  for (let i = 0; i < GENERATE_MAX_STEPS; i += 1) {
    let step: GenerateStepResult;
    try {
      step = await generateStep(draftId);
      retried = false;
    } catch (error) {
      if (retried) {
        throw error;
      }
      retried = true;
      continue;
    }
    onProgress(step);
    if (!step.next) {
      return step;
    }
  }
  throw new Error(GENERIC_ERROR);
}

/** Pełny draft z wariantami i wynikiem kontroli spójności. */
export async function getDraft(draftId: string): Promise<ContentDraft> {
  const data = await callContent<{ draft: unknown }>('get', { draft_id: draftId });
  return normalizeDraft(data.draft);
}

/**
 * Lista draftów tenanta (sort: created_at desc, max 50). Z `topicRef` zwraca
 * tylko przekazy powiązane z danym tematem (korpus albo dossier).
 */
export async function listDrafts(topicRef?: string): Promise<DraftListItem[]> {
  const data = await callContent<{ drafts: unknown[] }>(
    'list',
    topicRef ? { topic_ref: topicRef } : undefined
  );
  const list = Array.isArray(data.drafts) ? data.drafts : [];
  return list.map(normalizeDraftListItem);
}

/** Nowa wersja jednego wariantu, opcjonalnie z uwagami usera. */
export async function regenerateVariant(input: {
  draft_id: string;
  segment_id: string | null;
  channel: string;
  feedback?: string;
}): Promise<ContentVariant> {
  const data = await callContent<{ variant: unknown }>(
    'regenerate_variant',
    input,
    REGENERATE_TIMEOUT_MS
  );
  return normalizeVariant(data.variant);
}

/** Akceptacja albo odrzucenie draftu. */
export async function setDraftStatus(
  draftId: string,
  status: 'accepted' | 'rejected'
): Promise<void> {
  await callContent<{ ok: true }>('set_status', { draft_id: draftId, status });
}
