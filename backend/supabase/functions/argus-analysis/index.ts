// argus-analysis — analizy niespójności (kontrakt docs/kontrakt-analizy.md).
// Operacje: targets_search, create, add_document, collect_step, analyze_step,
// reanalyze, get, list, delete.
//
// Stan porcjowania (jak w onboardingu i argus-content): w analyses.progress
// (jsonb). collect_step i analyze_step robią JEDEN mały krok na wywołanie
// (limit zasobów workera Edge Functions); frontend woła w pętli aż next=false.
// Kroki są idempotentne: retry tego samego wywołania nie psuje stanu
// (dedup w bazie: sejm_statements po (mp_id, date, hash), sejm_mp_votes po
// (mp_id, voting_id); fazy analizy znaczone w progress po zapisie wyniku).
//
// Dane zbierane do tabel GLOBALNYCH (sejm_statements, sejm_mp_votes, sejm_votings)
// — kolejne analizy tych samych posłów pomijają już zaimportowane dni.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/types.ts";
import {
  getClassificationModel,
  getGenerationModel,
  loadPrompt,
} from "../_shared/ai.ts";
import { embedText } from "../_shared/embeddings.ts";
import {
  getClubMps,
  getMp,
  getPastProceedingDays,
  importGlobalMpStatementsForDays,
  importGlobalMpVotesForDays,
  pickMostActiveMps,
  searchClubs,
  searchMps,
} from "../_shared/sejm.ts";

const TOPIC_MIN_LENGTH = 5;
const MAX_TARGET_MPS = 5;
const LIST_LIMIT = 50;

// Okno danych: ostatnie 30 dni posiedzeń Sejmu.
const WINDOW_DAYS = 30;

// Porcjowanie collect_step (limit zasobów workera).
const STMT_DAYS_PER_CALL = 5;
const STMT_SOFT_CAP_PER_CALL = 12;
const VOTE_DAYS_PER_CALL = 6;
const EMBED_BATCH_PER_CALL = 4;

// Retrieval (analyze_step).
const RETRIEVAL_STATEMENTS_PER_TARGET = 12;
const VOTE_RANK_CANDIDATES = 150;
const RETRIEVAL_VOTES_MAX = 12;

// Dokumenty.
const DOC_TEXT_CAP = 60_000;
const PDF_MAX_BYTES = 5 * 1024 * 1024;
const TEXT_MIMES = new Set(["text/plain", "text/markdown", "text/x-markdown"]);

const VOTE_LABEL: Record<string, string> = {
  for: "za",
  against: "przeciw",
  abstain: "wstrzymał_a się",
  absent: "nieobecny_a",
};

// ---------------------------------------------------------------------------
// Kształt stanu w analyses.progress
// ---------------------------------------------------------------------------

interface CollectState {
  days: [number, string][];
  phase: "statements" | "votes" | "embeddings" | "done";
  mi: number; // kursor posła (statements)
  sd: number; // kursor dnia w obrębie posła (statements)
  vi: number; // kursor posła (votes)
  vd: number; // kursor dnia w obrębie posła (votes)
  statements: number;
  votes: number;
  votings: number;
  et?: number; // total dla fazy embeddings (ustalany przy pierwszym kroku)
}

interface RetrievalEvidence {
  statements: { id: string; date: string }[];
  votes: {
    voting_id: string;
    date: string;
    title: string;
    vote: string;
    // numer posiedzenia/glosowania — rozroznia glosowania o tym samym tytule
    sitting?: number;
    voting_no?: number;
  }[];
}

interface AnalyzeState {
  retrieval: Record<string, RetrievalEvidence>;
  retrieval_done: number[];
  findings_done: number[];
  docs_done: string[];
}

interface AnalysisProgress {
  collect?: CollectState;
  mp_names?: Record<string, string>;
  analyze?: AnalyzeState;
}

interface FindingEvidence {
  type: "statement" | "vote";
  quote: string;
  date: string;
  ref: string;
}

interface FindingItem {
  kind: string;
  severity: number;
  mp_id: number;
  mp_name: string;
  title: string;
  description: string;
  evidence: FindingEvidence[];
  suggested_use: string;
}

interface Findings {
  items?: FindingItem[];
  document_review?: {
    document_id: string;
    filename: string;
    claims: { claim: string; verdict: string; explanation: string }[];
  }[];
  sources_summary?: { statements: number; votes: number; documents: number };
}

function emptyAnalyzeState(): AnalyzeState {
  return { retrieval: {}, retrieval_done: [], findings_done: [], docs_done: [] };
}

// ---------------------------------------------------------------------------
// Schematy odpowiedzi AI — pełne required (bez defaultów): model nie może
// wywrócić operacji brakującym polem, a braki wykrywamy zamiast maskować.
// ---------------------------------------------------------------------------

const findingsSchema = z.object({
  items: z.array(
    z.object({
      kind: z.enum([
        "wypowiedz-wypowiedz",
        "wypowiedz-glosowanie",
        "glosowanie-glosowanie",
      ]).describe("Rodzaj niespojnosci"),
      severity: z.number().int().min(1).max(3).describe(
        "Waga: 3 = powazna (wprost sprzeczne stanowiska), 2 = istotna, 1 = drobna",
      ),
      title: z.string().min(1).describe(
        "Krotki opis niespojnosci po polsku, jedno zdanie",
      ),
      description: z.string().min(1).describe(
        "Wyjasnienie, na czym polega sprzecznosc, 2-4 zdania po polsku",
      ),
      evidence: z.array(
        z.object({
          type: z.enum(["statement", "vote"]).describe(
            "statement = wypowiedz z listy, vote = glosowanie z listy",
          ),
          index: z.number().int().min(1).describe(
            "Numer pozycji z odpowiedniej listy (od 1)",
          ),
          quote: z.string().min(1).describe(
            "Dla statement: DOSLOWNY, ciagly cytat z tej wypowiedzi. " +
              "Dla vote: rzeczowy opis glosowania i oddanego glosu",
          ),
          date: z.string().min(1).describe("Data z listy, format RRRR-MM-DD"),
        }),
      ).min(2).describe("Co najmniej dwa dowody (niespojnosc to para)"),
      suggested_use: z.string().min(1).describe(
        "Jak rzeczowo wykorzystac to w debacie, 1-3 zdania po polsku",
      ),
    }),
  ).describe("Lista realnych niespojnosci; PUSTA lista gdy brak"),
});

const voteRankSchema = z.object({
  relevant: z.array(z.number().int().min(1)).describe(
    "Numery glosowan (od 1) merytorycznie zwiazanych z tematem; " +
      "pusta lista gdy zadne nie pasuje",
  ),
});

const documentReviewSchema = z.object({
  claims: z.array(
    z.object({
      claim: z.string().min(1).describe(
        "Sprawdzalne twierdzenie z dokumentu, krotko po polsku",
      ),
      verdict: z.enum(["potwierdzone", "sprzeczne", "brak danych"]).describe(
        "Werdykt WYLACZNIE na podstawie dostarczonych danych",
      ),
      explanation: z.string().min(1).describe(
        "Uzasadnienie werdyktu z data zrodla albo stwierdzenie braku danych",
      ),
    }),
  ).describe("Twierdzenia z dokumentu z werdyktami; pusta lista gdy brak"),
});

// ---------------------------------------------------------------------------
// Helpery danych
// ---------------------------------------------------------------------------

async function getAnalysis(
  supabase: SupabaseClient,
  tenantId: string,
  analysisId: unknown,
) {
  if (typeof analysisId !== "string" || !analysisId) {
    throw new HttpError(400, "Podaj identyfikator analizy (analysis_id)");
  }
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", analysisId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt analizy: ${error.message}`);
  if (!data) throw new HttpError(404, "Nie znaleziono analizy");
  return data;
}

async function updateAnalysis(
  supabase: SupabaseClient,
  tenantId: string,
  analysisId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("analyses")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", analysisId);
  if (error) throw new Error(`Zapis analizy: ${error.message}`);
}

async function listDocuments(
  supabase: SupabaseClient,
  tenantId: string,
  analysisId: string,
) {
  const { data, error } = await supabase
    .from("analysis_documents")
    .select("id, filename, mime, chars, created_at")
    .eq("tenant_id", tenantId)
    .eq("analysis_id", analysisId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Odczyt dokumentow: ${error.message}`);
  return data ?? [];
}

async function logAccess(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  action: string,
  resource: string | null,
) {
  await supabase.from("access_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    action,
    resource,
  });
}

function normalizeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Linia glosowania do promptu. Numer posiedzenia/glosowania rozroznia
// ODREBNE glosowania o identycznym tytule (poprawki, wnioski, calosc ustawy).
function voteLine(
  v: RetrievalEvidence["votes"][number],
  index: number,
): string {
  const no = v.sitting !== undefined && v.voting_no !== undefined
    ? ` (glosowanie ${v.sitting}/${v.voting_no})`
    : "";
  return `${index + 1}. [${v.date}]${no} ${v.title.slice(0, 260)} — glos: ${
    VOTE_LABEL[v.vote] ?? v.vote
  }`;
}

const VOTES_BLOCK_NOTE =
  "Uwaga: kazda pozycja to ODREBNE glosowanie, w ktorym ta osoba oddala " +
  "wskazany glos. Ta sama ustawa moze miec wiele glosowan tego samego dnia " +
  "(poprawki, wnioski mniejszosci, calosc projektu).";

// ---------------------------------------------------------------------------
// targets_search
// ---------------------------------------------------------------------------

async function opTargetsSearch(body: { query?: unknown }) {
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2) {
    throw new HttpError(400, "Podaj co najmniej 2 znaki zapytania");
  }
  const [mps, clubs] = await Promise.all([searchMps(query), searchClubs(query)]);
  return { mps, clubs };
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

async function opCreate(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: { topic?: unknown; target?: unknown },
) {
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (topic.length < TOPIC_MIN_LENGTH) {
    throw new HttpError(400, "Temat musi miec co najmniej 5 znakow");
  }

  const target = (body.target ?? {}) as Record<string, unknown>;
  const targetType = target.type;
  if (targetType !== "mps" && targetType !== "club") {
    throw new HttpError(400, "Cel analizy: podaj type 'mps' albo 'club'");
  }

  const days = (await getPastProceedingDays()).slice(0, WINDOW_DAYS);
  if (days.length === 0) {
    throw new HttpError(500, "API Sejmu nie zwrocilo dni posiedzen. Sprobuj pozniej.");
  }

  let mpIds: number[] = [];
  let targetName = "";
  const mpNames: Record<string, string> = {};

  if (targetType === "mps") {
    const raw = Array.isArray(target.mp_ids) ? target.mp_ids : [];
    const ids = [...new Set(raw.map((v) => Number(v)))];
    if (ids.length === 0 || ids.some((v) => !Number.isInteger(v) || v <= 0)) {
      throw new HttpError(400, "Wybierz co najmniej jednego posla (mp_ids)");
    }
    if (ids.length > MAX_TARGET_MPS) {
      throw new HttpError(400, "Maksymalnie 5 poslow w jednej analizie");
    }
    const found = await Promise.all(ids.map((id) => getMp(id)));
    const names: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const mp = found[i];
      if (!mp) {
        throw new HttpError(404, `Nie znaleziono posla o identyfikatorze ${ids[i]}`);
      }
      mpNames[String(ids[i])] = mp.firstLastName;
      names.push(mp.firstLastName);
    }
    mpIds = ids;
    targetName = names.join(", ");
  } else {
    const club = typeof target.club === "string" ? target.club.trim() : "";
    if (club.length < 2) {
      throw new HttpError(400, "Podaj nazwe klubu (club)");
    }
    const clubMps = await getClubMps(club);
    if (clubMps.length === 0) {
      throw new HttpError(404, "Nie znaleziono klubu o podanej nazwie");
    }
    const picked = await pickMostActiveMps(clubMps, days, MAX_TARGET_MPS);
    mpIds = picked.map((mp) => mp.id);
    for (const mp of picked) mpNames[String(mp.id)] = mp.firstLastName;
    const matched = await searchClubs(club);
    targetName = matched[0]?.name ?? club;
  }

  const progress: AnalysisProgress = {
    collect: {
      days: days.map((d) => [d.sitting, d.date]),
      phase: "statements",
      mi: 0,
      sd: 0,
      vi: 0,
      vd: 0,
      statements: 0,
      votes: 0,
      votings: 0,
    },
    mp_names: mpNames,
  };

  const { data, error } = await supabase
    .from("analyses")
    .insert({
      tenant_id: tenantId,
      topic,
      target_type: targetType,
      target_name: targetName,
      target_mp_ids: mpIds,
      status: "collecting",
      progress,
      findings: {},
    })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis analizy: ${error.message}`);

  await logAccess(supabase, tenantId, userId, "analysis_create", `analysis:${data.id}`);
  return { analysis_id: data.id, target_mp_ids: mpIds, target_name: targetName };
}

// ---------------------------------------------------------------------------
// add_document
// ---------------------------------------------------------------------------

async function extractPdfText(base64: string): Promise<string> {
  let bytes: Uint8Array;
  try {
    const binary = atob(base64.replace(/^data:[^;]+;base64,/, ""));
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    throw new HttpError(400, "Nieprawidlowa zawartosc pliku (content_base64)");
  }
  if (bytes.length > PDF_MAX_BYTES) {
    throw new HttpError(400, "Plik PDF jest za duzy (limit 5 MB)");
  }
  if (bytes.length === 0) {
    throw new HttpError(400, "Plik PDF jest pusty");
  }
  // Ekstrakcja tekstu: npm:unpdf (serverless build pdf.js, dziala w Deno).
  const { extractText, getDocumentProxy } = await import("npm:unpdf");
  let text = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    text = typeof result.text === "string" ? result.text : "";
  } catch (err) {
    console.error("unpdf error:", err);
    throw new HttpError(
      400,
      "Nie udalo sie odczytac pliku PDF. Upewnij sie, ze plik nie jest uszkodzony ani zaszyfrowany.",
    );
  }
  if (normalizeForMatch(text).length < 50) {
    throw new HttpError(
      400,
      "Plik PDF nie zawiera warstwy tekstowej (wyglada na skan). " +
        "Wgraj PDF z tekstem albo wklej tresc jako plik TXT lub MD.",
    );
  }
  return text;
}

async function opAddDocument(
  supabase: SupabaseClient,
  tenantId: string,
  body: {
    analysis_id?: unknown;
    filename?: unknown;
    mime?: unknown;
    content_base64?: unknown;
    text?: unknown;
  },
) {
  const analysis = await getAnalysis(supabase, tenantId, body.analysis_id);
  const filename = typeof body.filename === "string" && body.filename.trim()
    ? body.filename.trim()
    : "";
  if (!filename) throw new HttpError(400, "Podaj nazwe pliku (filename)");
  const mime = typeof body.mime === "string" ? body.mime.trim().toLowerCase() : "";
  const lower = filename.toLowerCase();

  const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");
  const isText = TEXT_MIMES.has(mime) || lower.endsWith(".txt") ||
    lower.endsWith(".md") || lower.endsWith(".markdown");

  let text: string;
  if (isPdf) {
    if (typeof body.content_base64 !== "string" || !body.content_base64) {
      throw new HttpError(400, "Dla pliku PDF wyslij zawartosc w content_base64");
    }
    text = await extractPdfText(body.content_base64);
  } else if (isText) {
    text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      throw new HttpError(400, "Dla pliku tekstowego wyslij tresc w polu text");
    }
  } else {
    throw new HttpError(
      400,
      "Nieobslugiwany typ pliku. Obslugiwane formaty: PDF, TXT, MD.",
    );
  }

  const trimmed = text.trim();
  const truncated = trimmed.length > DOC_TEXT_CAP;
  const finalText = truncated ? trimmed.slice(0, DOC_TEXT_CAP) : trimmed;

  const { data, error } = await supabase
    .from("analysis_documents")
    .insert({
      tenant_id: tenantId,
      analysis_id: analysis.id,
      filename,
      mime: mime || (isPdf ? "application/pdf" : "text/plain"),
      text: finalText,
      chars: finalText.length,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis dokumentu: ${error.message}`);

  return { document_id: data.id, chars: finalText.length, truncated };
}

// ---------------------------------------------------------------------------
// collect_step
// ---------------------------------------------------------------------------

async function opCollectStep(
  supabase: SupabaseClient,
  tenantId: string,
  body: { analysis_id?: unknown },
) {
  const analysis = await getAnalysis(supabase, tenantId, body.analysis_id);

  // Idempotencja: zbieranie juz zakonczone.
  if (analysis.status !== "collecting") {
    return { phase: "done", processed: 1, total: 1, next: false };
  }

  const progress = (analysis.progress ?? {}) as AnalysisProgress;
  const state = progress.collect;
  if (!state || !Array.isArray(state.days) || state.days.length === 0) {
    throw new HttpError(400, "Analiza nie ma stanu zbierania. Utworz ja ponownie.");
  }
  const mps: number[] = Array.isArray(analysis.target_mp_ids)
    ? analysis.target_mp_ids
    : [];
  const allDays = state.days.map(([sitting, date]) => ({ sitting, date }));
  const D = allDays.length;
  const M = Math.max(mps.length, 1);

  async function save() {
    await updateAnalysis(supabase, tenantId, analysis.id as string, {
      progress: { ...progress, collect: state },
    });
  }

  if (state.phase === "statements") {
    const mpId = mps[state.mi];
    const slice = allDays.slice(state.sd, state.sd + STMT_DAYS_PER_CALL);
    if (mpId !== undefined && slice.length > 0) {
      const res = await importGlobalMpStatementsForDays(
        supabase,
        mpId,
        slice,
        STMT_SOFT_CAP_PER_CALL,
      );
      state.sd += Math.max(res.daysProcessed, 1);
      state.statements += res.inserted;
    }
    if (mpId === undefined || state.sd >= D) {
      state.mi += 1;
      state.sd = 0;
    }
    if (state.mi >= mps.length) state.phase = "votes";
    await save();
    return {
      phase: "statements",
      processed: Math.min(state.mi * D + state.sd, M * D),
      total: M * D,
      next: true,
    };
  }

  if (state.phase === "votes") {
    const mpId = mps[state.vi];
    const slice = allDays.slice(state.vd, state.vd + VOTE_DAYS_PER_CALL);
    if (mpId !== undefined && slice.length > 0) {
      const res = await importGlobalMpVotesForDays(supabase, mpId, slice);
      state.vd += Math.max(res.daysProcessed, 1);
      state.votes += res.votes;
      state.votings += res.votings;
    }
    if (mpId === undefined || state.vd >= D) {
      state.vi += 1;
      state.vd = 0;
    }
    if (state.vi >= mps.length) state.phase = "embeddings";
    await save();
    return {
      phase: "votes",
      processed: Math.min(state.vi * D + state.vd, M * D),
      total: M * D,
      next: true,
    };
  }

  // phase === "embeddings": brakujace embeddingi wypowiedzi targetow, porcjami.
  const { data: pending, error: pendingError } = await supabase
    .from("sejm_statements")
    .select("id, text")
    .in("mp_id", mps)
    .is("embedding", null)
    .limit(EMBED_BATCH_PER_CALL);
  if (pendingError) {
    throw new Error(`Odczyt sejm_statements: ${pendingError.message}`);
  }

  for (const row of pending ?? []) {
    const embedding = await embedText(row.text as string);
    const { error } = await supabase
      .from("sejm_statements")
      .update({ embedding })
      .eq("id", row.id);
    if (error) throw new Error(`Zapis embeddingu: ${error.message}`);
  }

  const { count } = await supabase
    .from("sejm_statements")
    .select("id", { count: "exact", head: true })
    .in("mp_id", mps)
    .is("embedding", null);
  const remaining = count ?? 0;

  if (state.et === undefined) {
    state.et = remaining + (pending?.length ?? 0);
  }
  const total = Math.max(state.et, 1);

  if (remaining > 0) {
    await save();
    return {
      phase: "embeddings",
      processed: Math.max(total - remaining, 0),
      total,
      next: true,
    };
  }

  // Koniec zbierania: status analyzing, swiezy stan analizy.
  state.phase = "done";
  await updateAnalysis(supabase, tenantId, analysis.id as string, {
    status: "analyzing",
    progress: { ...progress, collect: state, analyze: emptyAnalyzeState() },
  });
  return { phase: "done", processed: total, total, next: false };
}

// ---------------------------------------------------------------------------
// analyze_step — retrieval / findings / documents / done
// ---------------------------------------------------------------------------

async function fetchStatementsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { id: string; date: string; text: string }>> {
  const map = new Map<string, { id: string; date: string; text: string }>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("sejm_statements")
    .select("id, date, text")
    .in("id", ids);
  if (error) throw new Error(`Odczyt sejm_statements: ${error.message}`);
  for (const row of data ?? []) {
    map.set(row.id as string, {
      id: row.id as string,
      date: String(row.date),
      text: row.text as string,
    });
  }
  return map;
}

// Retrieval dla JEDNEGO posla: top wypowiedzi (wektorowo) + glosowania
// w temacie (ranking Haiku po tytulach).
async function runRetrievalForMp(
  supabase: SupabaseClient,
  topic: string,
  mpId: number,
): Promise<RetrievalEvidence> {
  const embedding = await embedText(topic);
  const { data: matches, error } = await supabase.rpc("match_sejm_statements", {
    p_query_embedding: embedding,
    p_mp_id: mpId,
    p_limit: RETRIEVAL_STATEMENTS_PER_TARGET,
  });
  if (error) throw new Error(`match_sejm_statements: ${error.message}`);
  const statements = ((matches ?? []) as { id: string; date: string }[])
    .map((m) => ({ id: m.id, date: String(m.date) }));

  // Glosy posla + tytuly glosowan (najnowsze kandydaty do rankingu).
  const { data: voteRows, error: votesError } = await supabase
    .from("sejm_mp_votes")
    .select("voting_id, vote, sejm_votings (id, date, title, sitting, voting_no)")
    .eq("mp_id", mpId)
    .limit(600);
  if (votesError) throw new Error(`Odczyt sejm_mp_votes: ${votesError.message}`);

  const candidates = (voteRows ?? [])
    .map((row) => {
      const v = row.sejm_votings as unknown as
        | {
          id: string;
          date: string;
          title: string;
          sitting: number;
          voting_no: number;
        }
        | null;
      if (!v) return null;
      return {
        voting_id: v.id,
        date: String(v.date),
        title: String(v.title ?? ""),
        vote: String(row.vote),
        sitting: v.sitting,
        voting_no: v.voting_no,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, VOTE_RANK_CANDIDATES);

  let votes: RetrievalEvidence["votes"] = [];
  if (candidates.length > 0) {
    const model = (await getClassificationModel()).withStructuredOutput(
      voteRankSchema,
      { name: "vote_rank" },
    );
    const listBlock = candidates
      .map((c, i) => `${i + 1}. [${c.date}] ${c.title.slice(0, 260)}`)
      .join("\n");
    const result = await model.invoke([
      [
        "system",
        "Jestes asystentem analityka politycznego. Dostajesz temat analizy i " +
          "ponumerowana liste glosowan sejmowych. Wskaz numery glosowan, ktore " +
          "MERYTORYCZNIE dotycza tematu (takze posrednio, np. poprawki i ustawy " +
          "w tej sprawie). Nie zgaduj: gdy zadne nie pasuje, zwroc pusta liste. " +
          `Maksymalnie ${RETRIEVAL_VOTES_MAX} numerow, tylko z listy.`,
      ],
      ["human", `Temat analizy: ${topic}\n\nGlosowania:\n${listBlock}`],
    ]);
    const relevant = Array.isArray(result.relevant) ? result.relevant : [];
    const seen = new Set<number>();
    for (const idx of relevant) {
      if (!Number.isInteger(idx) || idx < 1 || idx > candidates.length) continue;
      if (seen.has(idx)) continue;
      seen.add(idx);
      votes.push(candidates[idx - 1]);
      if (votes.length >= RETRIEVAL_VOTES_MAX) break;
    }
  }

  return { statements, votes };
}

// Findings dla JEDNEGO posla (Sonnet). Zwraca pozycje do dopisania.
async function runFindingsForMp(
  supabase: SupabaseClient,
  topic: string,
  mpId: number,
  mpName: string,
  evidence: RetrievalEvidence,
): Promise<FindingItem[]> {
  const stmtMap = await fetchStatementsByIds(
    supabase,
    evidence.statements.map((s) => s.id),
  );
  const stmtList = evidence.statements
    .map((s) => stmtMap.get(s.id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  if (stmtList.length === 0 && evidence.votes.length === 0) return [];

  const stmtBlock = stmtList.length > 0
    ? stmtList
      .map((s, i) => `${i + 1}. [${s.date}]\n${s.text.slice(0, 4000)}`)
      .join("\n\n")
    : "(brak wypowiedzi w temacie)";
  const voteBlock = evidence.votes.length > 0
    ? [VOTES_BLOCK_NOTE, ...evidence.votes.map((v, i) => voteLine(v, i))]
      .join("\n")
    : "(brak glosowan w temacie)";

  const model = (await getGenerationModel()).withStructuredOutput(
    findingsSchema,
    { name: "analysis_findings" },
  );
  const result = await model.invoke([
    ["system", loadPrompt("analysis-findings")],
    [
      "human",
      [
        `Temat analizy: ${topic}`,
        `Osoba: ${mpName}`,
        "",
        "Wypowiedzi sejmowe (ponumerowane):",
        stmtBlock,
        "",
        "Glosowania (ponumerowane):",
        voteBlock,
        "",
        "Znajdz realne niespojnosci tej osoby w temacie. Pamietaj: cytaty " +
        "wylacznie doslowne z powyzszych wypowiedzi; brak niespojnosci = pusta lista.",
      ].join("\n"),
    ],
  ]);

  const items: FindingItem[] = [];
  for (const raw of Array.isArray(result.items) ? result.items : []) {
    const evidenceOut: FindingEvidence[] = [];
    let valid = true;
    for (const ev of raw.evidence ?? []) {
      if (ev.type === "statement") {
        const src = stmtList[ev.index - 1];
        if (!src) {
          valid = false;
          break;
        }
        // Twarda walidacja: cytat musi byc doslownym fragmentem zrodla.
        const haystack = normalizeForMatch(src.text);
        const needle = normalizeForMatch(ev.quote);
        if (!needle || !haystack.includes(needle)) {
          valid = false;
          break;
        }
        evidenceOut.push({
          type: "statement",
          quote: ev.quote.trim(),
          date: src.date,
          ref: src.id,
        });
      } else {
        const src = evidence.votes[ev.index - 1];
        if (!src) {
          valid = false;
          break;
        }
        evidenceOut.push({
          type: "vote",
          quote: ev.quote.trim(),
          date: src.date,
          ref: src.voting_id,
        });
      }
    }
    if (!valid || evidenceOut.length < 2) {
      console.warn(
        `Odrzucono ustalenie (cytat niedoslowny albo zly indeks): ${raw.title}`,
      );
      continue;
    }
    items.push({
      kind: raw.kind,
      severity: raw.severity,
      mp_id: mpId,
      mp_name: mpName,
      title: raw.title.trim(),
      description: raw.description.trim(),
      evidence: evidenceOut,
      suggested_use: raw.suggested_use.trim(),
    });
  }
  return items;
}

// Weryfikacja JEDNEGO dokumentu wzgledem zebranych danych (Sonnet).
async function runDocumentReview(
  supabase: SupabaseClient,
  topic: string,
  mpNames: Record<string, string>,
  az: AnalyzeState,
  doc: { id: string; filename: string; text: string },
) {
  // Korpus dowodowy: wybrane wypowiedzi i glosowania wszystkich targetow.
  const blocks: string[] = [];
  for (const [mpIdStr, ev] of Object.entries(az.retrieval)) {
    const name = mpNames[mpIdStr] ?? `posel ${mpIdStr}`;
    const stmtMap = await fetchStatementsByIds(
      supabase,
      ev.statements.map((s) => s.id),
    );
    const stmts = ev.statements
      .map((s) => stmtMap.get(s.id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => `- [${s.date}] ${s.text.slice(0, 1500)}`)
      .join("\n");
    const votes = ev.votes.map((v, i) => voteLine(v, i)).join("\n");
    blocks.push(
      [
        `### ${name}`,
        `Wypowiedzi sejmowe (wypowiedzi osoby: ${name}):`,
        stmts || "(brak wypowiedzi w temacie)",
        `Glosowania w temacie (glosy oddane przez: ${name}). ${VOTES_BLOCK_NOTE}`,
        votes || "(brak glosowan w temacie)",
      ].join("\n"),
    );
  }

  const model = (await getGenerationModel()).withStructuredOutput(
    documentReviewSchema,
    { name: "document_review" },
  );
  const result = await model.invoke([
    ["system", loadPrompt("analysis-document-review")],
    [
      "human",
      [
        `Temat analizy: ${topic}`,
        `Osoby: ${Object.values(mpNames).join(", ")}`,
        "",
        "ZEBRANE DANE (jedyne zrodlo prawdy):",
        blocks.join("\n\n"),
        "",
        `DOKUMENT UZYTKOWNIKA (${doc.filename}):`,
        doc.text,
        "",
        "Wydobadz twierdzenia z dokumentu i zweryfikuj kazde wylacznie na " +
        "podstawie zebranych danych powyzej.",
      ].join("\n"),
    ],
  ]);

  return {
    document_id: doc.id,
    filename: doc.filename,
    claims: (Array.isArray(result.claims) ? result.claims : []).map((c) => ({
      claim: c.claim.trim(),
      verdict: c.verdict,
      explanation: c.explanation.trim(),
    })),
  };
}

async function opAnalyzeStep(
  supabase: SupabaseClient,
  tenantId: string,
  body: { analysis_id?: unknown },
) {
  const analysis = await getAnalysis(supabase, tenantId, body.analysis_id);

  if (analysis.status === "ready") {
    return { phase: "done", processed: 1, total: 1, next: false };
  }
  if (analysis.status === "collecting") {
    throw new HttpError(
      400,
      "Zbieranie danych nie jest zakonczone. Najpierw wykonaj petle collect_step.",
    );
  }

  const progress = (analysis.progress ?? {}) as AnalysisProgress;
  const az = progress.analyze ?? emptyAnalyzeState();
  const mps: number[] = Array.isArray(analysis.target_mp_ids)
    ? analysis.target_mp_ids
    : [];
  const mpNames = progress.mp_names ?? {};
  const topic = analysis.topic as string;
  const findings = (analysis.findings ?? {}) as Findings;

  async function saveProgress() {
    await updateAnalysis(supabase, tenantId, analysis.id as string, {
      progress: { ...progress, analyze: az },
    });
  }

  // Faza 1: retrieval — jeden target na wywolanie.
  const retrievalPending = mps.filter((id) => !az.retrieval_done.includes(id));
  if (retrievalPending.length > 0) {
    const mpId = retrievalPending[0];
    const evidence = await runRetrievalForMp(supabase, topic, mpId);
    az.retrieval[String(mpId)] = evidence;
    az.retrieval_done.push(mpId);
    await saveProgress();
    return {
      phase: "retrieval",
      processed: az.retrieval_done.length,
      total: mps.length,
      next: true,
    };
  }

  // Faza 2: findings — jeden target na wywolanie.
  const findingsPending = mps.filter((id) => !az.findings_done.includes(id));
  if (findingsPending.length > 0) {
    const mpId = findingsPending[0];
    const evidence = az.retrieval[String(mpId)] ??
      { statements: [], votes: [] };
    const items = await runFindingsForMp(
      supabase,
      topic,
      mpId,
      mpNames[String(mpId)] ?? `posel ${mpId}`,
      evidence,
    );
    const updatedFindings: Findings = {
      ...findings,
      items: [
        ...(findings.items ?? []).filter((i) => i.mp_id !== mpId),
        ...items,
      ],
    };
    az.findings_done.push(mpId);
    await updateAnalysis(supabase, tenantId, analysis.id as string, {
      findings: updatedFindings,
      progress: { ...progress, analyze: az },
    });
    return {
      phase: "findings",
      processed: az.findings_done.length,
      total: mps.length,
      next: true,
    };
  }

  // Faza 3: documents — jeden dokument na wywolanie.
  const { data: docs, error: docsError } = await supabase
    .from("analysis_documents")
    .select("id, filename, text")
    .eq("tenant_id", tenantId)
    .eq("analysis_id", analysis.id)
    .order("created_at", { ascending: true });
  if (docsError) throw new Error(`Odczyt dokumentow: ${docsError.message}`);
  const docsPending = (docs ?? []).filter(
    (d) => !az.docs_done.includes(d.id as string),
  );
  if (docsPending.length > 0) {
    const doc = docsPending[0];
    const review = await runDocumentReview(supabase, topic, mpNames, az, {
      id: doc.id as string,
      filename: doc.filename as string,
      text: doc.text as string,
    });
    const updatedFindings: Findings = {
      ...findings,
      document_review: [
        ...(findings.document_review ?? []).filter(
          (r) => r.document_id !== doc.id,
        ),
        review,
      ],
    };
    az.docs_done.push(doc.id as string);
    await updateAnalysis(supabase, tenantId, analysis.id as string, {
      findings: updatedFindings,
      progress: { ...progress, analyze: az },
    });
    return {
      phase: "documents",
      processed: az.docs_done.length,
      total: (docs ?? []).length,
      next: true,
    };
  }

  // Faza 4: done — podsumowanie zrodel i status ready.
  const [stmtCount, voteCount] = await Promise.all([
    supabase
      .from("sejm_statements")
      .select("id", { count: "exact", head: true })
      .in("mp_id", mps),
    supabase
      .from("sejm_mp_votes")
      .select("id", { count: "exact", head: true })
      .in("mp_id", mps),
  ]);
  const updatedFindings: Findings = {
    items: findings.items ?? [],
    document_review: findings.document_review ?? [],
    sources_summary: {
      statements: stmtCount.count ?? 0,
      votes: voteCount.count ?? 0,
      documents: (docs ?? []).length,
    },
  };
  await updateAnalysis(supabase, tenantId, analysis.id as string, {
    status: "ready",
    findings: updatedFindings,
    progress: { ...progress, analyze: az },
  });
  return { phase: "done", processed: 1, total: 1, next: false };
}

// ---------------------------------------------------------------------------
// reanalyze / get / list / delete
// ---------------------------------------------------------------------------

async function opReanalyze(
  supabase: SupabaseClient,
  tenantId: string,
  body: { analysis_id?: unknown },
) {
  const analysis = await getAnalysis(supabase, tenantId, body.analysis_id);
  if (analysis.status === "collecting") {
    throw new HttpError(
      400,
      "Analiza jeszcze zbiera dane. Dokoncz petle collect_step.",
    );
  }
  const progress = (analysis.progress ?? {}) as AnalysisProgress;
  await updateAnalysis(supabase, tenantId, analysis.id as string, {
    status: "analyzing",
    findings: {},
    progress: { ...progress, analyze: emptyAnalyzeState() },
  });
  return { analysis_id: analysis.id, status: "analyzing" };
}

async function opGet(
  supabase: SupabaseClient,
  tenantId: string,
  body: { analysis_id?: unknown },
) {
  const analysis = await getAnalysis(supabase, tenantId, body.analysis_id);
  const documents = await listDocuments(
    supabase,
    tenantId,
    analysis.id as string,
  );
  return {
    analysis: {
      id: analysis.id,
      topic: analysis.topic,
      target_type: analysis.target_type,
      target_name: analysis.target_name,
      target_mp_ids: analysis.target_mp_ids,
      status: analysis.status,
      findings: analysis.findings ?? {},
      created_at: analysis.created_at,
      updated_at: analysis.updated_at,
      documents,
    },
  };
}

async function opList(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("analyses")
    .select("id, topic, target_name, status, created_at, findings")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Odczyt analiz: ${error.message}`);

  const { data: docRows, error: docsError } = await supabase
    .from("analysis_documents")
    .select("analysis_id")
    .eq("tenant_id", tenantId);
  if (docsError) throw new Error(`Odczyt dokumentow: ${docsError.message}`);
  const docCounts = new Map<string, number>();
  for (const row of docRows ?? []) {
    const key = row.analysis_id as string;
    docCounts.set(key, (docCounts.get(key) ?? 0) + 1);
  }

  return {
    analyses: (data ?? []).map((a) => {
      const findings = (a.findings ?? {}) as Findings;
      return {
        id: a.id,
        topic: a.topic,
        target_name: a.target_name,
        status: a.status,
        created_at: a.created_at,
        findings_count: Array.isArray(findings.items) ? findings.items.length : 0,
        documents_count: docCounts.get(a.id as string) ?? 0,
      };
    }),
  };
}

async function opDelete(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: { analysis_id?: unknown },
) {
  const analysis = await getAnalysis(supabase, tenantId, body.analysis_id);
  const { error } = await supabase
    .from("analyses")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", analysis.id);
  if (error) throw new Error(`Usuwanie analizy: ${error.message}`);
  await logAccess(
    supabase,
    tenantId,
    userId,
    "analysis_delete",
    `analysis:${analysis.id}`,
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await authenticateRequest(req);
    const tenantId = await getTenantId(supabase, user.id);
    const body = await req.json().catch(() => ({}));
    const operation = body?.operation;

    switch (operation) {
      case "targets_search":
        return jsonResponse({ ok: true, data: await opTargetsSearch(body) });
      case "create":
        return jsonResponse({
          ok: true,
          data: await opCreate(supabase, tenantId, user.id, body),
        });
      case "add_document":
        return jsonResponse({
          ok: true,
          data: await opAddDocument(supabase, tenantId, body),
        });
      case "collect_step":
        return jsonResponse({
          ok: true,
          data: await opCollectStep(supabase, tenantId, body),
        });
      case "analyze_step":
        return jsonResponse({
          ok: true,
          data: await opAnalyzeStep(supabase, tenantId, body),
        });
      case "reanalyze":
        return jsonResponse({
          ok: true,
          data: await opReanalyze(supabase, tenantId, body),
        });
      case "get":
        return jsonResponse({
          ok: true,
          data: await opGet(supabase, tenantId, body),
        });
      case "list":
        return jsonResponse({
          ok: true,
          data: await opList(supabase, tenantId),
        });
      case "delete":
        return jsonResponse({
          ok: true,
          data: await opDelete(supabase, tenantId, user.id, body),
        });
      default:
        return jsonResponse(
          { ok: false, error: `Nieznana operacja: ${operation}` },
          400,
        );
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ ok: false, error: err.message }, err.status);
    }
    console.error("argus-analysis error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { ok: false, error: `Wystapil blad. Sprobuj ponownie pozniej. (${detail})` },
      500,
    );
  }
});
