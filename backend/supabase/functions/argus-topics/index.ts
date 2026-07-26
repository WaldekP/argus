// argus-topics — dossier tematyczny do self-briefingu (spec docs/superpowers/
// specs/2026-07-24-tematy-dossier-design.md).
//
// Operacje: create, add_document, generate_step, ask, regenerate, get, list,
// delete.
//
// Grounding: wyłącznie z wgranych dokumentów tematu (bez API Sejmu, bez korpusów
// docs/). Styl polityka (style_profile) wstrzykiwany do generacji. Twarde zasady
// w promptach: zakaz zmyślania cytatów i liczb, brak danych = "brak danych".
//
// Porcjowanie (ta sama lekcja co przy imporcie z Sejmu i generatorze przekazu):
// generate_step wykonuje JEDEN krok dossier na wywołanie i zapisuje wynik.
// Idempotencja przez flagi progress.done — błąd kroku ponawiamy tym samym
// wywołaniem, gotowe kroki nie liczą się drugi raz.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import { getGenerationModel, loadPrompt } from "../_shared/ai.ts";

const TITLE_MIN_LENGTH = 5;
const QUESTION_MIN_LENGTH = 3;
const TEXT_CAP = 60_000; // cap per dokument (znaki)
const CONTEXT_CAP = 120_000; // cap konkatenacji dokumentów w promptcie
const LIST_LIMIT = 50;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // limit PDF (kontrakt jak w analizach)

// Kolejność kroków dossier. Dwa przebiegi pytań (dziennikarz, rywal) liczą się
// jako osobne kroki, ale w UI raportujemy je jako jedną fazę "questions".
const STEPS = [
  "summary",
  "numbers",
  "questions_journalist",
  "questions_rival",
  "attack_defense",
] as const;
type Step = typeof STEPS[number];

// ---------------------------------------------------------------------------
// Schematy odpowiedzi AI (wszystkie pola wymagane, żeby model nie wywrócił
// operacji brakującym polem; puste sekcje = puste tablice / stringi).
// ---------------------------------------------------------------------------

const summarySchema = z.object({
  summary: z.string().min(1).describe(
    "Podsumowanie egzekutywne po polsku, 5-8 zdań",
  ),
});

const numbersSchema = z.object({
  key_numbers: z.array(z.object({
    label: z.string().describe("Czego dotyczy liczba"),
    value: z.string().describe("Wartość tak jak w materiale"),
    status: z.enum(["zweryfikowane", "do weryfikacji"]).describe(
      "do weryfikacji, gdy materiał sam oznacza liczbę jako niepewną",
    ),
    context: z.string().describe("Jedno zdanie kontekstu albo pusty string"),
  })).describe("Maksymalnie 12 kluczowych liczb; pusta lista gdy brak liczb"),
});

const questionsSchema = z.object({
  questions: z.array(z.object({
    asker_detail: z.string().describe("Kto konkretnie może pytać albo pusty string"),
    question: z.string().describe("Treść pytania"),
    answer: z.string().describe("Rekomendowana odpowiedź w stylu polityka"),
    trap: z.string().describe("Na co uważać albo pusty string"),
  })).describe("Od 5 do 8 pytań"),
});

const attackDefenseSchema = z.object({
  attack: z.array(z.object({
    target: z.string().describe("W kogo wymierzona albo pusty string"),
    claim: z.string(),
    evidence: z.string().describe("Dowód z materiału: cytat, liczba albo fakt z datą"),
    message: z.string().describe("Gotowy przekaz"),
    caution: z.string().describe("Uwaga na kontrę albo pusty string"),
  })).describe("Linie ataku; pusta lista gdy brak podstaw"),
  defense: z.array(z.object({
    attack: z.string().describe("Zarzut, który mogą postawić politykowi"),
    response: z.string().describe("Jak się bronić zgodnie z materiałem"),
    bridge: z.string().describe("Most z powrotem do własnego przekazu"),
  })).describe("Linie obrony; pusta lista gdy brak podstaw"),
});

const askSchema = z.object({
  answer: z.string().min(1).describe("Odpowiedź po polsku, oparta o materiał"),
});

// ---------------------------------------------------------------------------
// Helpery danych
// ---------------------------------------------------------------------------

async function getTopic(
  supabase: SupabaseClient,
  tenantId: string,
  topicId: unknown,
) {
  if (typeof topicId !== "string" || !topicId) {
    throw new HttpError(400, "Podaj identyfikator tematu (topic_id)");
  }
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", topicId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt tematu: ${error.message}`);
  if (!data) throw new HttpError(404, "Nie znaleziono tematu");
  return data;
}

async function getProfile(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("politician_profiles")
    .select("full_name, district, values, boundaries, style_profile")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt profilu: ${error.message}`);
  return data;
}

/** Konkatenacja tekstów dokumentów tematu (jedyne źródło prawdy dla generacji). */
async function getDocumentsText(
  supabase: SupabaseClient,
  tenantId: string,
  topicId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("topic_documents")
    .select("text")
    .eq("tenant_id", tenantId)
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Odczyt dokumentów: ${error.message}`);
  let joined = (data ?? [])
    .map((d) => String(d.text ?? ""))
    .filter((t) => t.trim().length > 0)
    .join("\n\n---\n\n");
  if (joined.length > CONTEXT_CAP) joined = joined.slice(0, CONTEXT_CAP);
  return joined;
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

function profileContext(profile: {
  full_name?: string;
  district?: Record<string, unknown>;
} | null): string {
  if (!profile) return "Brak danych o polityku (onboarding pominięty).";
  const district = profile.district as
    | { name?: string; num?: number; voivodeship?: string; club?: string }
    | undefined;
  return [
    `Polityk: ${profile.full_name ?? "brak danych"}`,
    `Okręg: ${district?.name ?? "brak danych"}`,
    `Klub: ${district?.club ?? "brak danych"}`,
  ].join("\n");
}

/** Blok kontekstu polityka + dokumenty źródłowe do promptu generacyjnego. */
function buildHuman(
  profile: Awaited<ReturnType<typeof getProfile>>,
  docsText: string,
  extraLines: string[] = [],
): string {
  return [
    "Kontekst polityka:",
    profileContext(profile),
    "",
    "Profil stylu polityka:",
    JSON.stringify(profile?.style_profile ?? {}, null, 2),
    "",
    "Wartości i osie poglądów:",
    JSON.stringify(profile?.values ?? {}, null, 2),
    "",
    "Granice (czego polityk publicznie nie mówi):",
    JSON.stringify(profile?.boundaries ?? {}, null, 2),
    "",
    ...extraLines,
    extraLines.length > 0 ? "" : "",
    "Dokumenty źródłowe (JEDYNE źródło prawdy, nie wychodź poza nie):",
    docsText,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Generacja pojedynczych kroków dossier
// ---------------------------------------------------------------------------

async function genSummary(
  profile: Awaited<ReturnType<typeof getProfile>>,
  docsText: string,
): Promise<string> {
  const model = (await getGenerationModel()).withStructuredOutput(
    summarySchema,
    { name: "topic_summary" },
  );
  const res = await model.invoke([
    ["system", loadPrompt("topics-summary")],
    ["human", buildHuman(profile, docsText)],
  ]);
  return typeof res.summary === "string" ? res.summary.trim() : "";
}

async function genNumbers(docsText: string) {
  const model = (await getGenerationModel()).withStructuredOutput(
    numbersSchema,
    { name: "topic_numbers" },
  );
  const res = await model.invoke([
    ["system", loadPrompt("topics-numbers")],
    [
      "human",
      [
        "Dokumenty źródłowe (JEDYNE źródło prawdy):",
        docsText,
      ].join("\n"),
    ],
  ]);
  return Array.isArray(res.key_numbers) ? res.key_numbers : [];
}

async function genQuestions(
  profile: Awaited<ReturnType<typeof getProfile>>,
  docsText: string,
  asker: "dziennikarz" | "rywal",
) {
  const model = (await getGenerationModel()).withStructuredOutput(
    questionsSchema,
    { name: "topic_questions" },
  );
  const askerLine = asker === "dziennikarz"
    ? "Rodzaj pytającego: dziennikarz (pytania rozliczające i weryfikujące)."
    : "Rodzaj pytającego: rywal (zaczepki konkurencyjnego polityka w debacie).";
  const res = await model.invoke([
    ["system", loadPrompt("topics-questions")],
    ["human", buildHuman(profile, docsText, [askerLine])],
  ]);
  const list = Array.isArray(res.questions) ? res.questions : [];
  return list.map((q) => ({
    asker,
    asker_detail: typeof q.asker_detail === "string" ? q.asker_detail : "",
    question: typeof q.question === "string" ? q.question : "",
    answer: typeof q.answer === "string" ? q.answer : "",
    trap: typeof q.trap === "string" ? q.trap : "",
  })).filter((q) => q.question.trim().length > 0);
}

async function genAttackDefense(
  profile: Awaited<ReturnType<typeof getProfile>>,
  docsText: string,
) {
  const model = (await getGenerationModel()).withStructuredOutput(
    attackDefenseSchema,
    { name: "topic_attack_defense" },
  );
  const res = await model.invoke([
    ["system", loadPrompt("topics-attack-defense")],
    ["human", buildHuman(profile, docsText)],
  ]);
  return {
    attack: Array.isArray(res.attack) ? res.attack : [],
    defense: Array.isArray(res.defense) ? res.defense : [],
  };
}

// ---------------------------------------------------------------------------
// Ekstrakcja PDF (npm:unpdf, jak w kontrakcie analiz)
// ---------------------------------------------------------------------------

async function extractPdfText(base64: string): Promise<string> {
  let bytes: Uint8Array;
  try {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  } catch {
    throw new HttpError(400, "Nie udało się odczytać pliku PDF.");
  }
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new HttpError(400, "Plik PDF jest za duży. Limit to 5 MB.");
  }
  const { extractText, getDocumentProxy } = await import("npm:unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : String(text ?? "");
}

// ---------------------------------------------------------------------------
// Operacje
// ---------------------------------------------------------------------------

async function opCreate(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: { title?: unknown },
) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < TITLE_MIN_LENGTH) {
    throw new HttpError(400, "Tytuł tematu musi mieć co najmniej 5 znaków");
  }
  const { data, error } = await supabase
    .from("topics")
    .insert({
      tenant_id: tenantId,
      title,
      status: "generating",
      progress: {},
      dossier: {},
      source_chars: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis tematu: ${error.message}`);
  await logAccess(supabase, tenantId, userId, "topic_create", `topic:${data.id}`);
  return { topic_id: data.id };
}

async function opAddDocument(
  supabase: SupabaseClient,
  tenantId: string,
  body: {
    topic_id?: unknown;
    filename?: unknown;
    mime?: unknown;
    text?: unknown;
    content_base64?: unknown;
  },
) {
  const topic = await getTopic(supabase, tenantId, body.topic_id);
  const filename = typeof body.filename === "string" && body.filename
    ? body.filename
    : "dokument";
  const mime = typeof body.mime === "string" ? body.mime : "";

  let raw = "";
  if (typeof body.text === "string" && body.text.trim().length > 0) {
    raw = body.text;
  } else if (typeof body.content_base64 === "string" && body.content_base64) {
    raw = await extractPdfText(body.content_base64);
    if (raw.trim().length === 0) {
      throw new HttpError(
        400,
        "PDF nie zawiera warstwy tekstowej (prawdopodobnie skan). Wgraj plik z tekstem albo wersję MD.",
      );
    }
  } else {
    throw new HttpError(400, "Brak treści dokumentu.");
  }

  const truncated = raw.length > TEXT_CAP;
  const finalText = truncated ? raw.slice(0, TEXT_CAP) : raw;

  const { data, error } = await supabase
    .from("topic_documents")
    .insert({
      tenant_id: tenantId,
      topic_id: topic.id,
      filename,
      mime,
      text: finalText,
      chars: finalText.length,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis dokumentu: ${error.message}`);

  // Przelicz sumę znaków źródeł tematu (meta do UI).
  const { data: docs } = await supabase
    .from("topic_documents")
    .select("chars")
    .eq("tenant_id", tenantId)
    .eq("topic_id", topic.id);
  const sourceChars = (docs ?? []).reduce(
    (acc, d) => acc + (typeof d.chars === "number" ? d.chars : 0),
    0,
  );
  await supabase
    .from("topics")
    .update({ source_chars: sourceChars })
    .eq("tenant_id", tenantId)
    .eq("id", topic.id);

  return { document_id: data.id, chars: finalText.length, truncated };
}

async function opGenerateStep(
  supabase: SupabaseClient,
  tenantId: string,
  body: { topic_id?: unknown },
) {
  const topic = await getTopic(supabase, tenantId, body.topic_id);
  const dossier = (topic.dossier ?? {}) as Record<string, unknown>;
  const progress = (topic.progress ?? {}) as Record<string, unknown>;
  const done = (progress.done ?? {}) as Record<string, boolean>;

  const nextStep = STEPS.find((s) => !done[s]) as Step | undefined;

  // Wszystko zrobione: wywołanie idempotentne, dociągamy status ready.
  if (!nextStep) {
    if (topic.status !== "ready") {
      await supabase
        .from("topics")
        .update({ status: "ready" })
        .eq("tenant_id", tenantId)
        .eq("id", topic.id);
    }
    return {
      phase: "done",
      processed: STEPS.length,
      total: STEPS.length,
      next: false,
    };
  }

  const docsText = await getDocumentsText(supabase, tenantId, topic.id as string);
  if (docsText.trim().length === 0) {
    throw new HttpError(400, "Najpierw dodaj dokument do tematu.");
  }
  const profile = await getProfile(supabase, tenantId);

  const nextDossier: Record<string, unknown> = { ...dossier };
  switch (nextStep) {
    case "summary":
      nextDossier.summary = await genSummary(profile, docsText);
      break;
    case "numbers":
      nextDossier.key_numbers = await genNumbers(docsText);
      break;
    case "questions_journalist": {
      const qs = await genQuestions(profile, docsText, "dziennikarz");
      const existing = Array.isArray(dossier.questions) ? dossier.questions : [];
      nextDossier.questions = [...existing, ...qs];
      break;
    }
    case "questions_rival": {
      const qs = await genQuestions(profile, docsText, "rywal");
      const existing = Array.isArray(nextDossier.questions)
        ? nextDossier.questions as unknown[]
        : [];
      nextDossier.questions = [...existing, ...qs];
      break;
    }
    case "attack_defense":
      nextDossier.attack_defense = await genAttackDefense(profile, docsText);
      break;
  }

  done[nextStep] = true;
  const allDone = STEPS.every((s) => done[s]);

  const { error } = await supabase
    .from("topics")
    .update({
      dossier: nextDossier,
      progress: { ...progress, done },
      status: allDone ? "ready" : "generating",
    })
    .eq("tenant_id", tenantId)
    .eq("id", topic.id);
  if (error) throw new Error(`Zapis dossier: ${error.message}`);

  const processed = STEPS.filter((s) => done[s]).length;
  const phase = nextStep.startsWith("questions") ? "questions" : nextStep;
  return { phase, processed, total: STEPS.length, next: !allDone };
}

async function opAsk(
  supabase: SupabaseClient,
  tenantId: string,
  body: { topic_id?: unknown; question?: unknown },
) {
  const topic = await getTopic(supabase, tenantId, body.topic_id);
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < QUESTION_MIN_LENGTH) {
    throw new HttpError(400, "Podaj pytanie (co najmniej 3 znaki)");
  }
  const docsText = await getDocumentsText(supabase, tenantId, topic.id as string);
  if (docsText.trim().length === 0) {
    throw new HttpError(400, "Ten temat nie ma jeszcze żadnego dokumentu.");
  }
  const profile = await getProfile(supabase, tenantId);
  const model = (await getGenerationModel()).withStructuredOutput(
    askSchema,
    { name: "topic_ask" },
  );
  const res = await model.invoke([
    ["system", loadPrompt("topics-ask")],
    ["human", buildHuman(profile, docsText, [`Pytanie użytkownika: ${question}`])],
  ]);
  return { answer: typeof res.answer === "string" ? res.answer.trim() : "" };
}

async function opRegenerate(
  supabase: SupabaseClient,
  tenantId: string,
  body: { topic_id?: unknown },
) {
  const topic = await getTopic(supabase, tenantId, body.topic_id);
  const { error } = await supabase
    .from("topics")
    .update({ dossier: {}, progress: {}, status: "generating" })
    .eq("tenant_id", tenantId)
    .eq("id", topic.id);
  if (error) throw new Error(`Reset dossier: ${error.message}`);
  return { ok: true };
}

async function opGet(
  supabase: SupabaseClient,
  tenantId: string,
  body: { topic_id?: unknown },
) {
  const topic = await getTopic(supabase, tenantId, body.topic_id);
  const { data: docs, error } = await supabase
    .from("topic_documents")
    .select("id, filename, chars")
    .eq("tenant_id", tenantId)
    .eq("topic_id", topic.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Odczyt dokumentów: ${error.message}`);
  return {
    topic: {
      id: topic.id,
      title: topic.title,
      status: topic.status,
      created_at: topic.created_at,
      source_chars: topic.source_chars,
      dossier: topic.dossier ?? {},
      documents: docs ?? [],
    },
  };
}

async function opList(supabase: SupabaseClient, tenantId: string) {
  const { data: topics, error } = await supabase
    .from("topics")
    .select("id, title, status, created_at, dossier")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Odczyt tematów: ${error.message}`);

  const ids = (topics ?? []).map((t) => t.id as string);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: docs } = await supabase
      .from("topic_documents")
      .select("topic_id")
      .eq("tenant_id", tenantId)
      .in("topic_id", ids);
    for (const d of docs ?? []) {
      const key = d.topic_id as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return {
    topics: (topics ?? []).map((t) => {
      const dossier = (t.dossier ?? {}) as { questions?: unknown };
      const questionsCount = Array.isArray(dossier.questions)
        ? dossier.questions.length
        : 0;
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        created_at: t.created_at,
        questions_count: questionsCount,
        documents_count: counts.get(t.id as string) ?? 0,
      };
    }),
  };
}

async function opDelete(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: { topic_id?: unknown },
) {
  const topic = await getTopic(supabase, tenantId, body.topic_id);
  const { error } = await supabase
    .from("topics")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", topic.id);
  if (error) throw new Error(`Usunięcie tematu: ${error.message}`);
  await logAccess(supabase, tenantId, userId, "topic_delete", `topic:${topic.id}`);
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
      case "generate_step":
        return jsonResponse({
          ok: true,
          data: await opGenerateStep(supabase, tenantId, body),
        });
      case "ask":
        return jsonResponse({
          ok: true,
          data: await opAsk(supabase, tenantId, body),
        });
      case "regenerate":
        return jsonResponse({
          ok: true,
          data: await opRegenerate(supabase, tenantId, body),
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
    return serverErrorResponse("argus-topics", err);
  }
});
