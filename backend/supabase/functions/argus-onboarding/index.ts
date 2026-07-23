// argus-onboarding — onboarding polityka (TASK 3, kontrakt docs/kontrakt-task-2-3.md).
// Operacje: search_mp, import_sejm_data, get_status, interview_turn,
// generate_style_profile, update_style_profile, finalize_style,
// suggest_segments, finalize, debug_search (weryfikacja wyszukiwania wektorowego).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/types.ts";
import { getGenerationModel, loadPrompt } from "../_shared/ai.ts";
import { embedText } from "../_shared/embeddings.ts";
import {
  getMp,
  getPastProceedingDays,
  importMpStatementsForDays,
  importMpVotingsForDays,
  searchMps,
} from "../_shared/sejm.ts";

const MAX_INTERVIEW_QUESTIONS = 8;
const MIN_INTERVIEW_QUESTIONS = 5;

// Porcjowanie importu (limit zasobow workera Edge Functions):
// kazde wywolanie import_sejm_data robi jeden maly krok.
const IMPORT_MAX_DAYS = 60; // ile dni posiedzen wstecz skanujemy
const VOTINGS_TARGET = 200;
const STATEMENTS_TARGET = 100;
const VOTING_DAYS_PER_CALL = 3;
const STATEMENT_SOFT_CAP_PER_CALL = 12;
const STATEMENT_MAX_DAYS_PER_CALL = 6;
const EMBED_BATCH_PER_CALL = 3;

// ---------------------------------------------------------------------------
// Schematy odpowiedzi AI (wymuszane przez withStructuredOutput)
// ---------------------------------------------------------------------------

const interviewTurnSchema = z.object({
  action: z.enum(["ask", "finish"]).describe(
    "ask = zadaj kolejne pytanie, finish = wywiad zakonczony",
  ),
  question: z.string().nullable().describe(
    "Tresc kolejnego pytania po polsku (tylko gdy action=ask)",
  ),
});

// Defaulty w schematach: model nie moze wywrocic operacji brakujacym polem;
// pelna strukture i tak gwarantuje normalizacja przed zapisem/odpowiedzia.
const interviewProfileSchema = z.object({
  values: z.object({
    osie_pogladow: z.array(z.string()).default([])
      .describe("Najwazniejsze wartosci i osie pogladow"),
    tematy_mocne: z.array(z.string()).default([])
      .describe("Tematy, w ktorych polityk czuje sie najmocniej"),
  }).default({ osie_pogladow: [], tematy_mocne: [] }),
  boundaries: z.object({
    tematy_tabu: z.array(z.string()).default([])
      .describe("Tematy, ktorych polityk unika"),
    granice: z.array(z.string()).default([])
      .describe("Rzeczy, ktorych nigdy publicznie nie powie"),
  }).default({ tematy_tabu: [], granice: [] }),
  bio: z.string().default("brak danych")
    .describe("Biografia polityczna, 3-6 zdan po polsku"),
  goals: z.object({
    cele_12m: z.array(z.string()).default([])
      .describe("Cele polityczne na 12 miesiecy"),
    cele_komunikacyjne: z.array(z.string()).default([])
      .describe("Cele komunikacyjne"),
  }).default({ cele_12m: [], cele_komunikacyjne: [] }),
});

const styleProfileSchema = z.object({
  ton: z.string().default("brak danych"),
  dlugosc_zdan: z.string().default("brak danych"),
  slownictwo: z.array(z.string()).default([]),
  zwroty_charakterystyczne: z.array(z.string()).default([]),
  czego_unika: z.array(z.string()).default([]),
  przyklad_wypowiedzi: z.string().default("brak danych"),
});

const segmentsSchema = z.object({
  segments: z.array(
    z.object({
      name: z.string().default("Segment"),
      size_estimate: z.number().nullable().default(null),
      priority: z.enum(["mobilize", "persuade", "ignore"]).default("persuade"),
      profile: z.object({
        opis: z.string().default("brak danych"),
        tematy: z.array(z.string()).default([]),
        jezyk_dziala: z.array(z.string()).default([]),
        jezyk_odrzuca: z.array(z.string()).default([]),
        kanaly: z.array(z.string()).default([]),
      }).default({
        opis: "brak danych",
        tematy: [],
        jezyk_dziala: [],
        jezyk_odrzuca: [],
        kanaly: [],
      }),
    }),
  ).min(1).max(8).describe("Dokladnie 5 segmentow"),
});

// ---------------------------------------------------------------------------
// Normalizacja odpowiedzi AI: model moze pominac pole mimo schematu,
// a kontrakt gwarantuje frontendowi pelna strukture. Braki = defaulty.
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback = "brak danych"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
    : [];
}

function normalizeStyleProfile(raw: unknown) {
  const sp = (raw ?? {}) as Record<string, unknown>;
  return {
    ton: asString(sp.ton),
    dlugosc_zdan: asString(sp.dlugosc_zdan),
    slownictwo: asStringArray(sp.slownictwo),
    zwroty_charakterystyczne: asStringArray(sp.zwroty_charakterystyczne),
    czego_unika: asStringArray(sp.czego_unika),
    przyklad_wypowiedzi: asString(sp.przyklad_wypowiedzi),
  };
}

const SEGMENT_PRIORITIES = ["mobilize", "persuade", "ignore"] as const;

function normalizeSegment(raw: unknown) {
  const s = (raw ?? {}) as Record<string, unknown>;
  const profile = (s.profile ?? {}) as Record<string, unknown>;
  const priority = SEGMENT_PRIORITIES.includes(
      s.priority as typeof SEGMENT_PRIORITIES[number],
    )
    ? s.priority as typeof SEGMENT_PRIORITIES[number]
    : "persuade";
  return {
    name: asString(s.name, "Segment"),
    size_estimate: typeof s.size_estimate === "number"
      ? Math.round(s.size_estimate)
      : null,
    priority,
    profile: {
      opis: asString(profile.opis),
      tematy: asStringArray(profile.tematy),
      jezyk_dziala: asStringArray(profile.jezyk_dziala),
      jezyk_odrzuca: asStringArray(profile.jezyk_odrzuca),
      kanaly: asStringArray(profile.kanaly),
    },
  };
}

type InterviewEntry = { role: "assistant" | "user"; text: string };
interface InterviewState {
  transcript: InterviewEntry[];
  done: boolean;
}

// ---------------------------------------------------------------------------
// Helpery danych
// ---------------------------------------------------------------------------

async function getProfile(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("politician_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt profilu: ${error.message}`);
  return data;
}

async function requireProfile(supabase: SupabaseClient, tenantId: string) {
  const profile = await getProfile(supabase, tenantId);
  if (!profile) {
    throw new HttpError(400, "Najpierw zaimportuj dane posla (import_sejm_data)");
  }
  return profile;
}

async function updateProfile(
  supabase: SupabaseClient,
  tenantId: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("politician_profiles")
    .update(patch)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) throw new Error(`Zapis profilu: ${error.message}`);
  return data;
}

async function loadTenantSettings(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  if (error) throw new Error(`Odczyt ustawien tenanta: ${error.message}`);
  return (data?.settings ?? {}) as Record<string, unknown>;
}

async function saveTenantSettings(
  supabase: SupabaseClient,
  tenantId: string,
  settings: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("tenants")
    .update({ settings })
    .eq("id", tenantId);
  if (error) throw new Error(`Zapis ustawien tenanta: ${error.message}`);
}

async function getInterviewState(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ state: InterviewState; settings: Record<string, unknown> }> {
  const settings = await loadTenantSettings(supabase, tenantId);
  const raw = settings.onboarding_interview as InterviewState | undefined;
  return {
    state: raw && Array.isArray(raw.transcript)
      ? raw
      : { transcript: [], done: false },
    settings,
  };
}

async function saveInterviewState(
  supabase: SupabaseClient,
  tenantId: string,
  settings: Record<string, unknown>,
  state: InterviewState,
) {
  await saveTenantSettings(supabase, tenantId, {
    ...settings,
    onboarding_interview: state,
  });
}

function questionsAsked(state: InterviewState): number {
  return state.transcript.filter((e) => e.role === "assistant").length;
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
  values?: unknown;
  bio?: unknown;
  goals?: unknown;
} | null): string {
  if (!profile) return "Brak danych o polityku.";
  const district = profile.district as
    | { name?: string; num?: number; voivodeship?: string; club?: string }
    | undefined;
  return [
    `Polityk: ${profile.full_name ?? "brak danych"}`,
    `Okreg: ${district?.name ?? "brak danych"}${district?.num ? ` (nr ${district.num})` : ""}`,
    `Wojewodztwo: ${district?.voivodeship ?? "brak danych"}`,
    `Klub: ${district?.club ?? "brak danych"}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Operacje
// ---------------------------------------------------------------------------

async function opSearchMp(body: { query?: unknown }) {
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2) {
    throw new HttpError(400, "Podaj co najmniej 2 znaki nazwiska");
  }
  const mps = await searchMps(query);
  return { mps };
}

// Stan porcjowanego importu, trzymany w tenants.settings.sejm_import.
// days: dni posiedzen (desc) jako [sitting, "YYYY-MM-DD"].
interface SejmImportState {
  mp_id: number;
  phase: "votings" | "statements" | "embeddings" | "done";
  days: [number, string][];
  vd: number; // kursor dni dla fazy votings
  sd: number; // kursor dni dla fazy statements
  votings: number;
  votes: number;
  statements: number;
}

function importResponse(
  state: SejmImportState,
  extra: Record<string, unknown> = {},
) {
  const phase = state.phase;
  const processed = phase === "votings"
    ? state.votes
    : phase === "statements"
    ? state.statements
    : 0; // embeddings: dokladny postep liczony w kroku embeddingow
  const total = phase === "votings"
    ? VOTINGS_TARGET
    : phase === "statements"
    ? STATEMENTS_TARGET
    : Math.max(state.statements, 1);
  return {
    phase,
    processed,
    total,
    next: phase !== "done",
    ...extra,
  };
}

// Import danych posla — JEDEN maly krok na wywolanie (limit zasobow workera).
// Frontend wola w petli z tym samym mp_id az do next=false.
async function opImportSejmData(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: { mp_id?: unknown },
) {
  const mpId = Number(body.mp_id);
  if (!Number.isInteger(mpId) || mpId <= 0) {
    throw new HttpError(400, "Nieprawidlowy identyfikator posla (mp_id)");
  }

  const settings = await loadTenantSettings(supabase, tenantId);
  let state = settings.sejm_import as SejmImportState | undefined;

  // Inicjalizacja nowego importu (brak stanu, inny posel albo poprzedni done).
  if (!state || state.mp_id !== mpId || state.phase === "done") {
    const mp = await getMp(mpId);
    if (!mp) {
      throw new HttpError(404, "Nie znaleziono posla o podanym identyfikatorze");
    }
    const { error: upsertError } = await supabase
      .from("politician_profiles")
      .upsert(
        {
          tenant_id: tenantId,
          full_name: mp.firstLastName,
          mp_id: mpId,
          district: {
            name: mp.districtName ?? null,
            num: mp.districtNum ?? null,
            voivodeship: mp.voivodeship ?? null,
            club: mp.club ?? null,
          },
          onboarding_status: "importing",
        },
        { onConflict: "tenant_id" },
      );
    if (upsertError) throw new Error(`Zapis profilu: ${upsertError.message}`);

    // Re-import od zera: czyscimy poprzednie wypowiedzi sejmowe tenanta.
    const { error: deleteError } = await supabase
      .from("statements")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("source", "sejm");
    if (deleteError) {
      throw new Error(`Czyszczenie statements: ${deleteError.message}`);
    }

    const days = await getPastProceedingDays();
    state = {
      mp_id: mpId,
      phase: "votings",
      days: days.slice(0, IMPORT_MAX_DAYS).map((d) => [d.sitting, d.date]),
      vd: 0,
      sd: 0,
      votings: 0,
      votes: 0,
      statements: 0,
    };
    await saveTenantSettings(supabase, tenantId, {
      ...settings,
      sejm_import: state,
    });
    return importResponse(state);
  }

  const allDays = state.days.map(([sitting, date]) => ({ sitting, date }));

  if (state.phase === "votings") {
    const slice = allDays.slice(state.vd, state.vd + VOTING_DAYS_PER_CALL);
    if (slice.length > 0) {
      const res = await importMpVotingsForDays(
        supabase,
        tenantId,
        mpId,
        slice,
        VOTINGS_TARGET - state.votes,
      );
      state.vd += slice.length;
      state.votings += res.votings;
      state.votes += res.votes;
    }
    if (state.votes >= VOTINGS_TARGET || state.vd >= allDays.length) {
      state.phase = "statements";
    }
    await saveTenantSettings(supabase, tenantId, {
      ...settings,
      sejm_import: state,
    });
    return importResponse(state);
  }

  if (state.phase === "statements") {
    const slice = allDays.slice(
      state.sd,
      state.sd + STATEMENT_MAX_DAYS_PER_CALL,
    );
    if (slice.length > 0) {
      const res = await importMpStatementsForDays(
        supabase,
        tenantId,
        mpId,
        slice,
        STATEMENT_SOFT_CAP_PER_CALL,
      );
      state.sd += res.daysProcessed;
      state.statements += res.inserted;
    }
    if (
      state.statements >= STATEMENTS_TARGET || state.sd >= allDays.length ||
      slice.length === 0
    ) {
      state.phase = "embeddings";
    }
    await saveTenantSettings(supabase, tenantId, {
      ...settings,
      sejm_import: state,
    });
    return importResponse(state);
  }

  // phase === "embeddings": porcja embeddingow (teksty z embedding IS NULL).
  const { data: pending, error: pendingError } = await supabase
    .from("statements")
    .select("id, text")
    .eq("tenant_id", tenantId)
    .eq("source", "sejm")
    .is("embedding", null)
    .limit(EMBED_BATCH_PER_CALL);
  if (pendingError) {
    throw new Error(`Odczyt statements: ${pendingError.message}`);
  }

  if (pending && pending.length > 0) {
    for (const row of pending) {
      const embedding = await embedText(row.text as string);
      const { error } = await supabase
        .from("statements")
        .update({ embedding })
        .eq("id", row.id);
      if (error) throw new Error(`Zapis embeddingu: ${error.message}`);
    }
    const { count } = await supabase
      .from("statements")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("source", "sejm")
      .is("embedding", null);
    const remaining = count ?? 0;
    if (remaining > 0) {
      await saveTenantSettings(supabase, tenantId, {
        ...settings,
        sejm_import: state,
      });
      return {
        phase: "embeddings",
        processed: state.statements - remaining,
        total: state.statements,
        next: true,
      };
    }
  }

  // Koniec importu.
  state.phase = "done";
  await saveTenantSettings(supabase, tenantId, {
    ...settings,
    sejm_import: state,
  });
  const profile = await updateProfile(supabase, tenantId, {
    onboarding_status: "interview",
  });
  await logAccess(supabase, tenantId, userId, "import_sejm_data", `mp:${mpId}`);

  return {
    phase: "done",
    processed: state.statements,
    total: state.statements,
    next: false,
    imported: {
      votings: state.votings,
      votes: state.votes,
      statements: state.statements,
    },
    profile,
  };
}

async function opGetStatus(supabase: SupabaseClient, tenantId: string) {
  const profile = await getProfile(supabase, tenantId);

  const [votesRes, statementsRes] = await Promise.all([
    supabase
      .from("politician_votes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("statements")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  return {
    has_profile: Boolean(profile),
    onboarding_status: profile?.onboarding_status ?? "not_started",
    profile,
    counts: {
      votes: votesRes.count ?? 0,
      statements: statementsRes.count ?? 0,
    },
  };
}

async function opInterviewTurn(
  supabase: SupabaseClient,
  tenantId: string,
  body: { answer?: unknown },
) {
  const profile = await requireProfile(supabase, tenantId);
  const { state, settings } = await getInterviewState(supabase, tenantId);

  if (state.done) {
    return {
      question: null,
      done: true,
      progress: 1,
      transcript_length: state.transcript.length,
    };
  }

  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const lastEntry = state.transcript[state.transcript.length - 1];

  if (answer && lastEntry?.role === "assistant") {
    state.transcript.push({ role: "user", text: answer });
  } else if (!answer && lastEntry?.role === "assistant") {
    // Wznowienie: powtorz ostatnie, nieodpowiedziane pytanie.
    return {
      question: lastEntry.text,
      done: false,
      progress: Math.min(questionsAsked(state) / MAX_INTERVIEW_QUESTIONS, 1),
      transcript_length: state.transcript.length,
    };
  }

  const asked = questionsAsked(state);
  const systemPrompt = loadPrompt("onboarding-interview");
  const context = [
    systemPrompt,
    "",
    "Dane z importu z Sejmu:",
    profileContext(profile),
    "",
    `Zadano dotad ${asked} z maksymalnie ${MAX_INTERVIEW_QUESTIONS} pytan. ` +
    `Minimum pytan: ${MIN_INTERVIEW_QUESTIONS}.`,
  ].join("\n");

  const history = state.transcript.map((e) =>
    [e.role === "assistant" ? "ai" : "human", e.text] as [string, string]
  );

  let finish = asked >= MAX_INTERVIEW_QUESTIONS;
  let nextQuestion: string | null = null;

  if (!finish) {
    const model = (await getGenerationModel()).withStructuredOutput(
      interviewTurnSchema,
      { name: "interview_turn" },
    );
    const result = await model.invoke([
      ["system", context],
      ...history,
      [
        "human",
        asked === 0
          ? "Rozpocznij wywiad pierwszym pytaniem."
          : "Zdecyduj: kolejne pytanie czy koniec wywiadu.",
      ],
    ]);
    if (result.action === "finish" && asked >= MIN_INTERVIEW_QUESTIONS) {
      finish = true;
    } else {
      nextQuestion = (result.question ?? "").trim();
      if (!nextQuestion) {
        finish = asked >= MIN_INTERVIEW_QUESTIONS;
      }
    }
  }

  if (!finish && nextQuestion) {
    state.transcript.push({ role: "assistant", text: nextQuestion });
    await saveInterviewState(supabase, tenantId, settings, state);
    return {
      question: nextQuestion,
      done: false,
      progress: Math.min(questionsAsked(state) / MAX_INTERVIEW_QUESTIONS, 1),
      transcript_length: state.transcript.length,
    };
  }

  // Koniec wywiadu: generujemy profil z transkryptu.
  const profileModel = (await getGenerationModel()).withStructuredOutput(
    interviewProfileSchema,
    { name: "interview_profile" },
  );
  const generated = await profileModel.invoke([
    ["system", context],
    ...history,
    [
      "human",
      "Wywiad zakonczony. Na podstawie calej rozmowy i danych z Sejmu " +
      "wygeneruj profil polityka. Pamietaj: zadnych zmyslonych faktow, " +
      "brak informacji = \"brak danych\".",
    ],
  ]);

  await updateProfile(supabase, tenantId, {
    values: generated.values,
    boundaries: generated.boundaries,
    bio: generated.bio,
    goals: generated.goals,
    onboarding_status: "style",
  });

  state.done = true;
  await saveInterviewState(supabase, tenantId, settings, state);

  return {
    question: null,
    done: true,
    progress: 1,
    transcript_length: state.transcript.length,
  };
}

async function fetchStyleSample(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 30,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("statements")
    .select("text")
    .eq("tenant_id", tenantId)
    .eq("source", "sejm")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Odczyt wypowiedzi: ${error.message}`);
  return (data ?? [])
    .map((row) => row.text as string)
    .sort((a, b) => b.length - a.length)
    .slice(0, limit)
    .map((text) => text.slice(0, 1200));
}

function sampleBlock(sample: string[]): string {
  return sample
    .map((text, i) => `--- Wypowiedz ${i + 1} ---\n${text}`)
    .join("\n\n");
}

async function opGenerateStyleProfile(
  supabase: SupabaseClient,
  tenantId: string,
) {
  const profile = await requireProfile(supabase, tenantId);
  const sample = await fetchStyleSample(supabase, tenantId);
  if (sample.length === 0) {
    throw new HttpError(
      400,
      "Brak zaimportowanych wypowiedzi. Najpierw wykonaj import danych z Sejmu.",
    );
  }

  const systemPrompt = loadPrompt("style-profile");
  const model = (await getGenerationModel()).withStructuredOutput(styleProfileSchema, {
    name: "style_profile",
  });
  const styleProfile = await model.invoke([
    ["system", systemPrompt],
    [
      "human",
      `${profileContext(profile)}\n\nProbka wypowiedzi sejmowych:\n\n${sampleBlock(sample)}`,
    ],
  ]);

  const normalized = normalizeStyleProfile(styleProfile);
  await updateProfile(supabase, tenantId, { style_profile: normalized });
  return { style_profile: normalized };
}

async function opUpdateStyleProfile(
  supabase: SupabaseClient,
  tenantId: string,
  body: { feedback?: unknown },
) {
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (!feedback) {
    throw new HttpError(400, "Podaj uwagi do profilu stylu (feedback)");
  }
  const profile = await requireProfile(supabase, tenantId);
  const current = profile.style_profile ?? {};
  const sample = await fetchStyleSample(supabase, tenantId, 10);

  const systemPrompt = loadPrompt("style-profile");
  const model = (await getGenerationModel()).withStructuredOutput(styleProfileSchema, {
    name: "style_profile",
  });
  const styleProfile = await model.invoke([
    ["system", systemPrompt],
    [
      "human",
      [
        profileContext(profile),
        "",
        "Aktualny profil stylu:",
        JSON.stringify(current, null, 2),
        "",
        "Uwagi kalibracyjne uzytkownika (uwzglednij je):",
        feedback,
        "",
        "Probka wypowiedzi (dla kontekstu):",
        sampleBlock(sample),
      ].join("\n"),
    ],
  ]);

  const normalized = normalizeStyleProfile(styleProfile);
  await updateProfile(supabase, tenantId, { style_profile: normalized });
  return { style_profile: normalized };
}

async function opFinalizeStyle(supabase: SupabaseClient, tenantId: string) {
  await requireProfile(supabase, tenantId);
  await updateProfile(supabase, tenantId, { onboarding_status: "segments" });
  return { ok: true };
}

async function opSuggestSegments(supabase: SupabaseClient, tenantId: string) {
  const profile = await requireProfile(supabase, tenantId);
  const systemPrompt = loadPrompt("segments-suggest");
  const model = (await getGenerationModel()).withStructuredOutput(segmentsSchema, {
    name: "segments",
  });
  const result = await model.invoke([
    ["system", systemPrompt],
    [
      "human",
      [
        profileContext(profile),
        "",
        "Wartosci i osie pogladow:",
        JSON.stringify(profile.values ?? {}, null, 2),
        "",
        "Granice:",
        JSON.stringify(profile.boundaries ?? {}, null, 2),
        "",
        "Bio:",
        String(profile.bio ?? "brak danych"),
        "",
        "Cele:",
        JSON.stringify(profile.goals ?? {}, null, 2),
        "",
        "Profil stylu:",
        JSON.stringify(profile.style_profile ?? {}, null, 2),
      ].join("\n"),
    ],
  ]);
  const segments = (Array.isArray(result.segments) ? result.segments : [])
    .slice(0, 5)
    .map(normalizeSegment);
  return { segments };
}

const finalizeSegmentSchema = z.object({
  name: z.string().min(1),
  size_estimate: z.number().nullable().optional(),
  priority: z.enum(["mobilize", "persuade", "ignore"]),
  profile: z.record(z.unknown()),
});

async function opFinalize(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: { segments?: unknown },
) {
  const parsed = z.array(finalizeSegmentSchema).min(1).max(10)
    .safeParse(body.segments);
  if (!parsed.success) {
    throw new HttpError(400, "Nieprawidlowa lista segmentow");
  }
  await requireProfile(supabase, tenantId);

  const rows = parsed.data.map((s) => ({
    tenant_id: tenantId,
    name: s.name,
    size_estimate: s.size_estimate ?? null,
    priority: s.priority,
    profile: s.profile,
  }));
  const { error } = await supabase.from("segments").insert(rows);
  if (error) throw new Error(`Zapis segmentow: ${error.message}`);

  await updateProfile(supabase, tenantId, { onboarding_status: "done" });
  await logAccess(supabase, tenantId, userId, "onboarding_finalize", null);
  return { ok: true };
}

// Pomocnicza operacja weryfikacyjna: wyszukiwanie wektorowe po wypowiedziach.
async function opDebugSearch(
  supabase: SupabaseClient,
  tenantId: string,
  body: { query?: unknown; limit?: unknown },
) {
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) throw new HttpError(400, "Podaj zapytanie (query)");
  const limit = Number(body.limit) || 5;

  const embedding = await embedText(query);
  const { data, error } = await supabase.rpc("match_statements", {
    p_tenant_id: tenantId,
    p_query_embedding: embedding,
    p_limit: limit,
  });
  if (error) throw new Error(`match_statements: ${error.message}`);
  const results = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    date: row.date,
    similarity: row.similarity,
    excerpt: String(row.text ?? "").slice(0, 300),
  }));
  return { query, results };
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
      case "search_mp":
        return jsonResponse({ ok: true, data: await opSearchMp(body) });
      case "import_sejm_data":
        return jsonResponse({
          ok: true,
          data: await opImportSejmData(supabase, tenantId, user.id, body),
        });
      case "get_status":
        return jsonResponse({
          ok: true,
          data: await opGetStatus(supabase, tenantId),
        });
      case "interview_turn":
        return jsonResponse({
          ok: true,
          data: await opInterviewTurn(supabase, tenantId, body),
        });
      case "generate_style_profile":
        return jsonResponse({
          ok: true,
          data: await opGenerateStyleProfile(supabase, tenantId),
        });
      case "update_style_profile":
        return jsonResponse({
          ok: true,
          data: await opUpdateStyleProfile(supabase, tenantId, body),
        });
      case "finalize_style":
        return jsonResponse({
          ok: true,
          data: await opFinalizeStyle(supabase, tenantId),
        });
      case "suggest_segments":
        return jsonResponse({
          ok: true,
          data: await opSuggestSegments(supabase, tenantId),
        });
      case "finalize":
        return jsonResponse({
          ok: true,
          data: await opFinalize(supabase, tenantId, user.id, body),
        });
      case "debug_search":
        return jsonResponse({
          ok: true,
          data: await opDebugSearch(supabase, tenantId, body),
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
    console.error("argus-onboarding error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { ok: false, error: `Wystapil blad. Sprobuj ponownie pozniej. (${detail})` },
      500,
    );
  }
});
