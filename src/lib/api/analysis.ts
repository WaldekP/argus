/**
 * Klient Edge Function `argus-analysis` (analizy niespójności).
 * Wiążący kontrakt: docs/kontrakt-analizy.md. Zmiany kontraktu wymagają
 * aktualizacji tamtego pliku.
 *
 * Konwencja: POST {SUPABASE_URL}/functions/v1/argus-analysis
 * z tokenem usera w Authorization i polem `operation` w body.
 * Odpowiedź: { ok: true, data } albo { ok: false, error }.
 */

import { edgeClient, GENERIC_ERROR } from '@/lib/api/client';

/** Status analizy w cyklu życia: zbieranie, analiza, wynik albo błąd. */
export type AnalysisStatus = 'collecting' | 'analyzing' | 'ready' | 'error';

/** Rodzaj celu analizy: konkretni posłowie albo klub. */
export type AnalysisTargetType = 'mps' | 'club';

/** Poseł z wyszukiwarki celów (operation: targets_search). */
export type TargetMp = {
  mp_id: number;
  full_name: string;
  club: string;
  active: boolean;
};

/** Klub z wyszukiwarki celów (operation: targets_search). */
export type TargetClub = {
  id: string;
  name: string;
  mp_count: number;
};

/** Wynik wyszukiwania celów. */
export type TargetsSearchResult = {
  mps: TargetMp[];
  clubs: TargetClub[];
};

/** Cel analizy przekazywany do create. */
export type AnalysisTarget =
  | { type: 'mps'; mp_ids: number[] }
  | { type: 'club'; club: string };

/** Wynik utworzenia analizy (operation: create). */
export type CreateAnalysisResult = {
  analysis_id: string;
  target_mp_ids: number[];
  target_name: string;
};

/** Wynik dodania dokumentu (operation: add_document). */
export type AddDocumentResult = {
  document_id: string;
  chars: number;
  truncated: boolean;
};

export type CollectPhase = 'statements' | 'votes' | 'embeddings' | 'done';
export type AnalyzePhase = 'retrieval' | 'findings' | 'documents' | 'done';

/** Jeden krok porcjowanej pętli (collect_step / analyze_step). */
export type AnalysisStepResult<TPhase extends string> = {
  phase: TPhase;
  processed: number;
  total: number;
  next: boolean;
};

export type CollectStepResult = AnalysisStepResult<CollectPhase>;
export type AnalyzeStepResult = AnalysisStepResult<AnalyzePhase>;

/** Rodzaj niespójności w ustaleniu. */
export type FindingKind =
  | 'wypowiedz-wypowiedz'
  | 'wypowiedz-glosowanie'
  | 'glosowanie-glosowanie';

/** Waga ustalenia: 3 poważna, 2 istotna, 1 drobna. */
export type FindingSeverity = 1 | 2 | 3;

/** Dowód ustalenia: cytat z wypowiedzi albo opis głosowania. */
export type FindingEvidence = {
  type: 'statement' | 'vote';
  quote: string;
  date: string;
  ref: string;
};

/** Jedno ustalenie analizy (para niespójności z dowodami). */
export type FindingItem = {
  kind: FindingKind;
  severity: FindingSeverity;
  mp_id: number | null;
  mp_name: string;
  title: string;
  description: string;
  evidence: FindingEvidence[];
  suggested_use: string;
};

/** Werdykt weryfikacji twierdzenia z dokumentu. */
export type ClaimVerdict = 'potwierdzone' | 'sprzeczne' | 'brak danych';

/** Zweryfikowane twierdzenie z dokumentu usera. */
export type DocumentClaim = {
  claim: string;
  verdict: ClaimVerdict;
  explanation: string;
};

/** Wynik weryfikacji jednego dokumentu. */
export type DocumentReview = {
  document_id: string;
  filename: string;
  claims: DocumentClaim[];
};

/** Podsumowanie źródeł analizy. */
export type SourcesSummary = {
  statements: number;
  votes: number;
  documents: number;
};

/** Pełny wynik analizy (pole findings w get). */
export type AnalysisFindings = {
  items: FindingItem[];
  document_review: DocumentReview[];
  sources_summary: SourcesSummary;
};

/** Dokument podpięty do analizy (lista w get). */
export type AnalysisDocument = {
  id: string;
  filename: string;
  chars: number;
};

/** Pełna analiza (operation: get). */
export type Analysis = {
  id: string;
  topic: string;
  target_type: AnalysisTargetType;
  target_name: string;
  target_mp_ids: number[];
  status: AnalysisStatus;
  created_at: string;
  findings: AnalysisFindings;
  documents: AnalysisDocument[];
};

/** Pozycja listy analiz (operation: list). */
export type AnalysisListItem = {
  id: string;
  topic: string;
  target_name: string;
  status: AnalysisStatus;
  created_at: string;
  findings_count: number;
  documents_count: number;
};

type AnalysisOperation =
  | 'targets_search'
  | 'create'
  | 'add_document'
  | 'collect_step'
  | 'analyze_step'
  | 'reanalyze'
  | 'get'
  | 'list'
  | 'delete';

/** Kroki pętli wołają API Sejmu albo model, dajemy zapas czasu. */
const STEP_TIMEOUT_MS = 120_000;
/** Ekstrakcja tekstu z PDF po stronie backendu bywa wolna. */
const ADD_DOCUMENT_TIMEOUT_MS = 180_000;
/** Bezpiecznik pętli: kroki są małe, 400 to aż nadto. */
const LOOP_MAX_STEPS = 400;
/** Pojedynczy krok pętli próbujemy maksymalnie 3 razy (kroki idempotentne). */
const STEP_MAX_ATTEMPTS = 3;


/**
 * Bazowe wywołanie Edge Function. Zwraca `data` z odpowiedzi albo rzuca
 * Error z komunikatem po polsku (gotowym do pokazania w UI).
 */
/** Klient tej domeny: transport w @/lib/api/client, tu tylko lista operacji. */
const callAnalysis = edgeClient<AnalysisOperation>('argus-analysis');

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const asNumberList = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : [];

/** Normalizacja statusu: nieznana wartość traktowana jak błąd (bez udawania wyniku). */
function normalizeStatus(raw: unknown): AnalysisStatus {
  return raw === 'collecting' || raw === 'analyzing' || raw === 'ready' ? raw : 'error';
}

/** Normalizacja dowodu ustalenia (defaulty na brakujące pola). */
export function normalizeEvidence(raw: unknown): FindingEvidence {
  const source = (raw ?? {}) as Partial<Record<keyof FindingEvidence, unknown>>;
  return {
    type: source.type === 'vote' ? 'vote' : 'statement',
    quote: asText(source.quote),
    date: asText(source.date),
    ref: asText(source.ref),
  };
}

/** Normalizacja ustalenia: model może pominąć pole, UI renderuje wszystko. */
export function normalizeFindingItem(raw: unknown): FindingItem {
  const source = (raw ?? {}) as Partial<Record<keyof FindingItem, unknown>>;
  const kind: FindingKind =
    source.kind === 'wypowiedz-glosowanie' || source.kind === 'glosowanie-glosowanie'
      ? source.kind
      : 'wypowiedz-wypowiedz';
  const severity: FindingSeverity =
    source.severity === 3 || source.severity === 2 ? source.severity : 1;
  const evidence = Array.isArray(source.evidence) ? source.evidence : [];
  return {
    kind,
    severity,
    mp_id: typeof source.mp_id === 'number' ? source.mp_id : null,
    mp_name: asText(source.mp_name),
    title: asText(source.title),
    description: asText(source.description),
    evidence: evidence.map(normalizeEvidence),
    suggested_use: asText(source.suggested_use),
  };
}

/** Normalizacja twierdzenia z dokumentu. */
export function normalizeClaim(raw: unknown): DocumentClaim {
  const source = (raw ?? {}) as Partial<Record<keyof DocumentClaim, unknown>>;
  const verdict: ClaimVerdict =
    source.verdict === 'potwierdzone' || source.verdict === 'sprzeczne'
      ? source.verdict
      : 'brak danych';
  return {
    claim: asText(source.claim),
    verdict,
    explanation: asText(source.explanation),
  };
}

/** Normalizacja weryfikacji jednego dokumentu. */
export function normalizeDocumentReview(raw: unknown): DocumentReview {
  const source = (raw ?? {}) as Partial<Record<keyof DocumentReview, unknown>>;
  const claims = Array.isArray(source.claims) ? source.claims : [];
  return {
    document_id: asText(source.document_id),
    filename: asText(source.filename),
    claims: claims.map(normalizeClaim),
  };
}

/** Normalizacja pola findings (defaulty na brakujące sekcje). */
export function normalizeFindings(raw: unknown): AnalysisFindings {
  const source = (raw ?? {}) as {
    items?: unknown;
    document_review?: unknown;
    sources_summary?: unknown;
  };
  const items = Array.isArray(source.items) ? source.items : [];
  const reviews = Array.isArray(source.document_review) ? source.document_review : [];
  const summary = (source.sources_summary ?? {}) as Partial<
    Record<keyof SourcesSummary, unknown>
  >;
  return {
    items: items.map(normalizeFindingItem),
    document_review: reviews.map(normalizeDocumentReview),
    sources_summary: {
      statements: asCount(summary.statements),
      votes: asCount(summary.votes),
      documents: asCount(summary.documents),
    },
  };
}

/** Normalizacja dokumentu z listy w get. */
export function normalizeAnalysisDocument(raw: unknown): AnalysisDocument {
  const source = (raw ?? {}) as Partial<Record<keyof AnalysisDocument, unknown>>;
  return {
    id: asText(source.id),
    filename: asText(source.filename),
    chars: asCount(source.chars),
  };
}

/** Normalizacja pełnej analizy z operation: get. */
export function normalizeAnalysis(raw: unknown): Analysis {
  const source = (raw ?? {}) as Partial<Record<keyof Analysis, unknown>>;
  const documents = Array.isArray(source.documents) ? source.documents : [];
  return {
    id: asText(source.id),
    topic: asText(source.topic),
    target_type: source.target_type === 'club' ? 'club' : 'mps',
    target_name: asText(source.target_name),
    target_mp_ids: asNumberList(source.target_mp_ids),
    status: normalizeStatus(source.status),
    created_at: asText(source.created_at),
    findings: normalizeFindings(source.findings),
    documents: documents.map(normalizeAnalysisDocument),
  };
}

/** Normalizacja pozycji listy analiz. */
export function normalizeAnalysisListItem(raw: unknown): AnalysisListItem {
  const source = (raw ?? {}) as Partial<Record<keyof AnalysisListItem, unknown>>;
  return {
    id: asText(source.id),
    topic: asText(source.topic),
    target_name: asText(source.target_name),
    status: normalizeStatus(source.status),
    created_at: asText(source.created_at),
    findings_count: asCount(source.findings_count),
    documents_count: asCount(source.documents_count),
  };
}

/** Wyszukiwanie celu analizy: posłowie i kluby jednym zapytaniem. */
export async function searchTargets(query: string): Promise<TargetsSearchResult> {
  const data = await callAnalysis<{ mps?: unknown; clubs?: unknown }>('targets_search', {
    query,
  });
  const mps = Array.isArray(data.mps) ? data.mps : [];
  const clubs = Array.isArray(data.clubs) ? data.clubs : [];
  return {
    mps: mps
      .map((raw) => {
        const source = (raw ?? {}) as Partial<Record<keyof TargetMp, unknown>>;
        return {
          mp_id: typeof source.mp_id === 'number' ? source.mp_id : 0,
          full_name: asText(source.full_name),
          club: asText(source.club),
          active: source.active !== false,
        };
      })
      .filter((mp) => mp.mp_id > 0),
    clubs: clubs
      .map((raw) => {
        const source = (raw ?? {}) as Partial<Record<keyof TargetClub, unknown>>;
        return {
          id: asText(source.id),
          name: asText(source.name),
          mp_count: asCount(source.mp_count),
        };
      })
      .filter((club) => club.id.length > 0),
  };
}

/** Utworzenie analizy. Status po utworzeniu: collecting. */
export async function createAnalysis(input: {
  topic: string;
  target: AnalysisTarget;
}): Promise<CreateAnalysisResult> {
  const data = await callAnalysis<Partial<CreateAnalysisResult>>('create', input);
  return {
    analysis_id: asText(data.analysis_id),
    target_mp_ids: asNumberList(data.target_mp_ids),
    target_name: asText(data.target_name),
  };
}

/** Dodanie dokumentu: txt/md jako text, pdf jako content_base64 (limit 5 MB). */
export async function addDocument(input: {
  analysis_id: string;
  filename: string;
  mime: string;
  content_base64?: string;
  text?: string;
}): Promise<AddDocumentResult> {
  const data = await callAnalysis<Partial<AddDocumentResult>>(
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

/** Reset fazy analizy po dodaniu dokumentu; potem pętla analyze_step. */
export async function reanalyze(analysisId: string): Promise<void> {
  await callAnalysis<unknown>('reanalyze', { analysis_id: analysisId });
}

/** Pełna analiza z ustaleniami i dokumentami. */
export async function getAnalysis(analysisId: string): Promise<Analysis> {
  const data = await callAnalysis<{ analysis?: unknown }>('get', { analysis_id: analysisId });
  // Kontrakt nie precyzuje opakowania: przyjmujemy { analysis } albo obiekt wprost.
  return normalizeAnalysis(data.analysis ?? data);
}

/** Lista analiz tenanta (sort: created_at desc, max 50). */
export async function listAnalyses(): Promise<AnalysisListItem[]> {
  const data = await callAnalysis<{ analyses?: unknown }>('list');
  const list = Array.isArray(data.analyses) ? data.analyses : [];
  return list.map(normalizeAnalysisListItem);
}

/** Usunięcie analizy razem z dokumentami (dane globalne zostają). */
export async function deleteAnalysis(analysisId: string): Promise<void> {
  await callAnalysis<unknown>('delete', { analysis_id: analysisId });
}

function normalizeStep<TPhase extends string>(
  raw: Partial<AnalysisStepResult<string>>,
  fallbackPhase: TPhase,
  isPhase: (value: unknown) => value is TPhase
): AnalysisStepResult<TPhase> {
  return {
    phase: isPhase(raw.phase) ? raw.phase : fallbackPhase,
    processed: asCount(raw.processed),
    total: asCount(raw.total),
    next: raw.next === true,
  };
}

const isCollectPhase = (value: unknown): value is CollectPhase =>
  value === 'statements' || value === 'votes' || value === 'embeddings' || value === 'done';

const isAnalyzePhase = (value: unknown): value is AnalyzePhase =>
  value === 'retrieval' || value === 'findings' || value === 'documents' || value === 'done';

/** Jeden krok porcjowanego zbierania danych. */
export async function collectStep(analysisId: string): Promise<CollectStepResult> {
  const data = await callAnalysis<Partial<CollectStepResult>>(
    'collect_step',
    { analysis_id: analysisId },
    STEP_TIMEOUT_MS
  );
  return normalizeStep(data, 'statements', isCollectPhase);
}

/** Jeden krok porcjowanej analizy. */
export async function analyzeStep(analysisId: string): Promise<AnalyzeStepResult> {
  const data = await callAnalysis<Partial<AnalyzeStepResult>>(
    'analyze_step',
    { analysis_id: analysisId },
    STEP_TIMEOUT_MS
  );
  return normalizeStep(data, 'retrieval', isAnalyzePhase);
}

/**
 * Pętla kroków aż do next: false, z postępem po każdym kroku.
 * Kroki są idempotentne: pojedynczy błąd ponawiamy do 3 prób,
 * dopiero trzeci błąd z rzędu przerywa pętlę.
 */
async function runStepLoop<TPhase extends string>(
  step: () => Promise<AnalysisStepResult<TPhase>>,
  onProgress: (step: AnalysisStepResult<TPhase>) => void
): Promise<AnalysisStepResult<TPhase>> {
  let attempts = 0;
  for (let i = 0; i < LOOP_MAX_STEPS; i += 1) {
    let result: AnalysisStepResult<TPhase>;
    try {
      result = await step();
      attempts = 0;
    } catch (error) {
      attempts += 1;
      if (attempts >= STEP_MAX_ATTEMPTS) {
        throw error;
      }
      continue;
    }
    onProgress(result);
    if (!result.next) {
      return result;
    }
  }
  throw new Error(GENERIC_ERROR);
}

/** Pełne zbieranie danych: pętla collect_step aż do next: false. */
export function runCollect(
  analysisId: string,
  onProgress: (step: CollectStepResult) => void
): Promise<CollectStepResult> {
  return runStepLoop(() => collectStep(analysisId), onProgress);
}

/** Pełna analiza: pętla analyze_step aż do next: false. */
export function runAnalyze(
  analysisId: string,
  onProgress: (step: AnalyzeStepResult) => void
): Promise<AnalyzeStepResult> {
  return runStepLoop(() => analyzeStep(analysisId), onProgress);
}
