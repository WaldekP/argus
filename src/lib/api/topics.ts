/**
 * Klient Edge Function `argus-topics` (Tematy — dossier tematyczny).
 * Wiążący spec: docs/superpowers/specs/2026-07-24-tematy-dossier-design.md.
 *
 * Konwencja: POST {SUPABASE_URL}/functions/v1/argus-topics
 * z tokenem usera w Authorization i polem `operation` w body.
 * Odpowiedź: { ok: true, data } albo { ok: false, error }.
 */

import { edgeClient, GENERIC_ERROR } from '@/lib/api/client';

/** Status tematu: generacja dossier, gotowe albo błąd. */
export type TopicStatus = 'generating' | 'ready' | 'error';

/** Kto zadaje przewidywane pytanie. */
export type QuestionAsker = 'dziennikarz' | 'rywal';

/** Status weryfikacji kluczowej liczby. */
export type NumberStatus = 'zweryfikowane' | 'do weryfikacji';

/** Kluczowa liczba wyciągnięta z materiału. */
export type KeyNumber = {
  label: string;
  value: string;
  status: NumberStatus;
  context: string;
};

/** Przewidywane pytanie z rekomendowaną odpowiedzią. */
export type TopicQuestion = {
  asker: QuestionAsker;
  asker_detail: string;
  question: string;
  answer: string;
  trap: string;
};

/** Linia ataku na konkurenta. */
export type AttackLine = {
  target: string;
  claim: string;
  evidence: string;
  message: string;
  caution: string;
};

/** Linia obrony przed zarzutem. */
export type DefenseLine = {
  attack: string;
  response: string;
  bridge: string;
};

/** Pełne dossier tematu. */
export type TopicDossier = {
  summary: string;
  key_numbers: KeyNumber[];
  questions: TopicQuestion[];
  attack_defense: { attack: AttackLine[]; defense: DefenseLine[] };
};

/** Dokument źródłowy tematu (w widoku tematu). */
export type TopicDocument = {
  id: string;
  filename: string;
  chars: number;
};

/** Pełny temat (operation: get). */
export type Topic = {
  id: string;
  title: string;
  status: TopicStatus;
  created_at: string;
  source_chars: number;
  dossier: TopicDossier;
  documents: TopicDocument[];
};

/** Pozycja listy tematów (operation: list). */
export type TopicListItem = {
  id: string;
  title: string;
  status: TopicStatus;
  created_at: string;
  questions_count: number;
  documents_count: number;
};

/** Wynik dodania dokumentu (operation: add_document). */
export type AddTopicDocumentResult = {
  document_id: string;
  chars: number;
  truncated: boolean;
};

/** Faza kroku generacji dossier (operation: generate_step). */
export type GeneratePhase = 'summary' | 'numbers' | 'questions' | 'attack_defense' | 'done';

/** Jeden krok porcjowanej generacji dossier. */
export type GenerateStepResult = {
  phase: GeneratePhase;
  processed: number;
  total: number;
  next: boolean;
};

type TopicOperation =
  | 'create'
  | 'add_document'
  | 'generate_step'
  | 'ask'
  | 'regenerate'
  | 'get'
  | 'list'
  | 'delete';

/** Krok generacji woła Sonneta, dajemy zapas czasu. */
const GENERATE_STEP_TIMEOUT_MS = 120_000;
/** Wysyłka dokumentu z ekstrakcją PDF po stronie serwera. */
const ADD_DOCUMENT_TIMEOUT_MS = 120_000;
/** Dopytanie AI to wywołanie modelu. */
const ASK_TIMEOUT_MS = 120_000;
/** Bezpiecznik pętli generacji: 5 kroków dossier, 40 to aż nadto z retry. */
const GENERATE_MAX_STEPS = 40;


/**
 * Bazowe wywołanie Edge Function. Zwraca `data` z odpowiedzi albo rzuca
 * Error z komunikatem po polsku (gotowym do pokazania w UI).
 */
/** Klient tej domeny: transport w @/lib/api/client, tu tylko lista operacji. */
const callTopics = edgeClient<TopicOperation>('argus-topics');

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

/** Normalizacja statusu tematu: nieznana wartość traktowana jak generacja. */
function normalizeStatus(raw: unknown): TopicStatus {
  return raw === 'ready' || raw === 'error' ? raw : 'generating';
}

function normalizeNumber(raw: unknown): KeyNumber {
  const source = (raw ?? {}) as Partial<Record<keyof KeyNumber, unknown>>;
  return {
    label: asText(source.label),
    value: asText(source.value),
    status: source.status === 'do weryfikacji' ? 'do weryfikacji' : 'zweryfikowane',
    context: asText(source.context),
  };
}

function normalizeQuestion(raw: unknown): TopicQuestion {
  const source = (raw ?? {}) as Partial<Record<keyof TopicQuestion, unknown>>;
  return {
    asker: source.asker === 'rywal' ? 'rywal' : 'dziennikarz',
    asker_detail: asText(source.asker_detail),
    question: asText(source.question),
    answer: asText(source.answer),
    trap: asText(source.trap),
  };
}

function normalizeAttack(raw: unknown): AttackLine {
  const source = (raw ?? {}) as Partial<Record<keyof AttackLine, unknown>>;
  return {
    target: asText(source.target),
    claim: asText(source.claim),
    evidence: asText(source.evidence),
    message: asText(source.message),
    caution: asText(source.caution),
  };
}

function normalizeDefense(raw: unknown): DefenseLine {
  const source = (raw ?? {}) as Partial<Record<keyof DefenseLine, unknown>>;
  return {
    attack: asText(source.attack),
    response: asText(source.response),
    bridge: asText(source.bridge),
  };
}

/** Normalizacja dossier: każde pole ma default, bo UI renderuje wszystkie sekcje. */
export function normalizeDossier(raw: unknown): TopicDossier {
  const source = (raw ?? {}) as Partial<Record<keyof TopicDossier, unknown>>;
  const ad = (source.attack_defense ?? {}) as { attack?: unknown; defense?: unknown };
  return {
    summary: asText(source.summary),
    key_numbers: Array.isArray(source.key_numbers)
      ? source.key_numbers.map(normalizeNumber)
      : [],
    questions: Array.isArray(source.questions) ? source.questions.map(normalizeQuestion) : [],
    attack_defense: {
      attack: Array.isArray(ad.attack) ? ad.attack.map(normalizeAttack) : [],
      defense: Array.isArray(ad.defense) ? ad.defense.map(normalizeDefense) : [],
    },
  };
}

function normalizeDocument(raw: unknown): TopicDocument {
  const source = (raw ?? {}) as Partial<Record<keyof TopicDocument, unknown>>;
  return {
    id: asText(source.id),
    filename: asText(source.filename) || 'dokument',
    chars: asCount(source.chars),
  };
}

/** Normalizacja pełnego tematu z operation: get. */
export function normalizeTopic(raw: unknown): Topic {
  const source = (raw ?? {}) as Partial<Record<keyof Topic, unknown>>;
  return {
    id: asText(source.id),
    title: asText(source.title),
    status: normalizeStatus(source.status),
    created_at: asText(source.created_at),
    source_chars: asCount(source.source_chars),
    dossier: normalizeDossier(source.dossier),
    documents: Array.isArray(source.documents) ? source.documents.map(normalizeDocument) : [],
  };
}

/** Normalizacja pozycji listy tematów. */
export function normalizeTopicListItem(raw: unknown): TopicListItem {
  const source = (raw ?? {}) as Partial<Record<keyof TopicListItem, unknown>>;
  return {
    id: asText(source.id),
    title: asText(source.title),
    status: normalizeStatus(source.status),
    created_at: asText(source.created_at),
    questions_count: asCount(source.questions_count),
    documents_count: asCount(source.documents_count),
  };
}

/** Utworzenie tematu. */
export async function createTopic(title: string): Promise<string> {
  const data = await callTopics<{ topic_id: string }>('create', { title });
  return asText(data.topic_id);
}

/** Wgranie dokumentu do tematu (txt/md jako text, pdf jako content_base64). */
export async function addTopicDocument(input: {
  topic_id: string;
  filename: string;
  mime: string;
  text?: string;
  content_base64?: string;
}): Promise<AddTopicDocumentResult> {
  const data = await callTopics<Partial<AddTopicDocumentResult>>(
    'add_document',
    input,
    ADD_DOCUMENT_TIMEOUT_MS
  );
  return {
    document_id: asText(data.document_id),
    chars: asCount(data.chars),
    truncated: data.truncated === true,
  };
}

/** Jeden krok porcjowanej generacji dossier. */
export async function generateTopicStep(topicId: string): Promise<GenerateStepResult> {
  const data = await callTopics<Partial<GenerateStepResult>>(
    'generate_step',
    { topic_id: topicId },
    GENERATE_STEP_TIMEOUT_MS
  );
  const phase = data.phase;
  const validPhase: GeneratePhase =
    phase === 'summary' ||
    phase === 'numbers' ||
    phase === 'questions' ||
    phase === 'attack_defense' ||
    phase === 'done'
      ? phase
      : 'summary';
  return {
    phase: validPhase,
    processed: asCount(data.processed),
    total: asCount(data.total),
    next: data.next === true,
  };
}

/**
 * Pełna generacja dossier: woła generate_step w pętli aż do next: false,
 * raportując postęp po każdym kroku. Pojedynczy błąd kroku jest ponawiany
 * raz (kroki są idempotentne), dopiero drugi z rzędu przerywa generację.
 */
export async function runTopicGeneration(
  topicId: string,
  onProgress: (step: GenerateStepResult) => void
): Promise<GenerateStepResult> {
  let retried = false;
  for (let i = 0; i < GENERATE_MAX_STEPS; i += 1) {
    let step: GenerateStepResult;
    try {
      step = await generateTopicStep(topicId);
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

/** Reset dossier po dodaniu dokumentu (dokumenty zostają). */
export async function regenerateTopic(topicId: string): Promise<void> {
  await callTopics<{ ok: true }>('regenerate', { topic_id: topicId });
}

/** Jednorazowe dopytanie AI o temat, ugruntowane w dokumentach. */
export async function askTopic(topicId: string, question: string): Promise<string> {
  const data = await callTopics<{ answer: string }>(
    'ask',
    { topic_id: topicId, question },
    ASK_TIMEOUT_MS
  );
  return asText(data.answer);
}

/** Pełny temat z dossier i listą dokumentów. */
export async function getTopic(topicId: string): Promise<Topic> {
  const data = await callTopics<{ topic: unknown }>('get', { topic_id: topicId });
  return normalizeTopic(data.topic);
}

/** Lista tematów tenanta (sort: created_at desc, max 50). */
export async function listTopics(): Promise<TopicListItem[]> {
  const data = await callTopics<{ topics: unknown[] }>('list');
  const list = Array.isArray(data.topics) ? data.topics : [];
  return list.map(normalizeTopicListItem);
}

/** Usunięcie tematu z dokumentami. */
export async function deleteTopic(topicId: string): Promise<void> {
  await callTopics<{ ok: true }>('delete', { topic_id: topicId });
}
