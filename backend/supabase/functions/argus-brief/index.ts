// argus-brief — brief przedwywiadowy (TASK 5, serce MVP).
// Operacje: create, get, list, rate, question_feedback.
//
// Wejscie to formularz "gdzie / kto / temat". Wyjscie: profil rozmowcy,
// publicznosc, 10 przewidywanych pytan z prawdopodobienstwem i rekomendowana
// odpowiedzia, pulapki z mostami oraz 3 przekazy dnia.
//
// Skad bierzemy kontekst (retrieve):
//   - profil polityka: wartosci, granice, profil stylu (tenant),
//   - dziennikarz i redakcja z bazy globalnej + jego ostatnie materialy,
//   - wlasne wypowiedzi sejmowe dopasowane do tematu (embedding + match_statements),
//   - badania opinii CBOS dopasowane do tematu (knowledge-search, fail-soft),
//   - dzisiejszy przeglad dnia, zeby brief znal biezace wydarzenia.
//
// Schemat bazy istnieje od migracji 001 (interview_briefs + brief_questions),
// wiec ta funkcja NIE wymaga migracji.
//
// Zasoby workera: generacja to jedno wywolanie Sonneta ze strukturalnym
// wyjsciem. Gdyby zaczelo przekraczac limit, dzielimy tak jak w argus-content
// (osobny krok na pytania), na razie miesci sie w jednym przebiegu.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import { getGenerationModel, loadPrompt } from "../_shared/ai.ts";
import { embedText } from "../_shared/embeddings.ts";
import { searchOpinionContext } from "../_shared/knowledge-search.ts";

const TOPIC_MIN_LENGTH = 5;
const QUESTIONS_COUNT = 10;
const STATEMENTS_LIMIT = 8;
const MATERIALS_LIMIT = 12;
const LIST_LIMIT = 50;

// ---------------------------------------------------------------------------
// Ksztalt odpowiedzi modelu
// ---------------------------------------------------------------------------

const briefSchema = z.object({
  profil_rozmowcy: z.string(),
  publicznosc: z.string(),
  pytania: z.array(
    z.object({
      pytanie: z.string(),
      prawdopodobienstwo: z.number().min(0).max(1),
      teza: z.string(),
      punkty: z.array(z.string()),
      ryzyko: z.string(),
    }),
  ),
  pulapki: z.array(
    z.object({
      pulapka: z.string(),
      most: z.string(),
    }),
  ),
  przekazy_dnia: z.array(z.string()),
});

type BriefContent = z.infer<typeof briefSchema>;

// ---------------------------------------------------------------------------
// Retrieve
// ---------------------------------------------------------------------------

async function getProfile(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("politician_profiles")
    .select("full_name, district, goals, values, boundaries, style_profile, topic_positions")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt profilu: ${error.message}`);
  return data;
}

async function getJournalist(supabase: SupabaseClient, journalistId: string) {
  // UWAGA: lista kolumn musi byc JEDNYM literalem (patrz argus-media) — string
  // sklejany plusem traci typ literalny i parser supabase-js sie poddaje.
  const { data, error } = await supabase
    .from("journalists")
    .select(
      "id, full_name, role, bio, topics, style_profile, playbook, takedown_requested, outlet_id, outlets ( name, type, editorial_line, audience_profile )",
    )
    .eq("id", journalistId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt dziennikarza: ${error.message}`);
  if (data?.takedown_requested) {
    throw new HttpError(404, "Ten profil dziennikarza został wycofany z bazy.");
  }
  return data;
}

async function getMaterials(supabase: SupabaseClient, journalistId: string) {
  const { data } = await supabase
    .from("journalist_materials")
    .select("title, url, published_at, summary")
    .eq("journalist_id", journalistId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(MATERIALS_LIMIT);
  return data ?? [];
}

/** Wlasne wypowiedzi dopasowane do tematu. Fail-soft: brak to nie awaria. */
async function getOwnStatements(
  supabase: SupabaseClient,
  tenantId: string,
  topic: string,
): Promise<{ text: string; date: string | null }[]> {
  try {
    const embedding = await embedText(topic);
    const { data } = await supabase.rpc("match_statements", {
      p_tenant_id: tenantId,
      p_query_embedding: embedding,
      p_limit: STATEMENTS_LIMIT,
    });
    return (data ?? []) as { text: string; date: string | null }[];
  } catch {
    return [];
  }
}

/** Dzisiejszy przeglad dnia, zeby brief nie byl oderwany od biezacych wydarzen. */
async function getTodayBrief(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const { data } = await supabase
    .from("daily_briefs")
    .select("items, status")
    .eq("tenant_id", tenantId)
    .eq("brief_date", new Date().toISOString().slice(0, 10))
    .maybeSingle();
  if (!data || data.status !== "ready" || !Array.isArray(data.items)) return "";
  const items = data.items as { naglowek?: string; streszczenie?: string }[];
  return items
    .slice(0, 6)
    .map((i) => `- ${i.naglowek ?? ""}: ${i.streszczenie ?? ""}`.trim())
    .join("\n");
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

function opis(wartosc: unknown): string {
  if (wartosc === null || wartosc === undefined) return "brak danych";
  if (typeof wartosc === "string") return wartosc.trim() || "brak danych";
  return JSON.stringify(wartosc);
}

interface GenerateInput {
  topic: string;
  scheduledAt: string | null;
  profile: Record<string, unknown> | null;
  journalist: Record<string, unknown> | null;
  journalistName: string | null;
  materials: { title: string; published_at: string | null }[];
  statements: { text: string; date: string | null }[];
  opinion: string;
  dayBrief: string;
}

function buildHuman(input: GenerateInput): string {
  const outlet = (input.journalist?.outlets ?? null) as Record<string, unknown> | null;
  const dziennikarz = input.journalist
    ? [
      `Imie i nazwisko: ${opis(input.journalist.full_name)}`,
      `Rola: ${opis(input.journalist.role)}`,
      `Bio: ${opis(input.journalist.bio)}`,
      `Tematy: ${Array.isArray(input.journalist.topics) ? input.journalist.topics.join(", ") : "brak danych"}`,
      `Profil stylu: ${opis(input.journalist.style_profile)}`,
      `Playbook: ${opis(input.journalist.playbook)}`,
    ].join("\n")
    : `Imie i nazwisko: ${opis(input.journalistName)}\n(Brak profilu w bazie. Nie zmyslaj stylu ani playbooku, napisz wprost, czego nie wiadomo.)`;

  const redakcja = outlet
    ? [
      `Nazwa: ${opis(outlet.name)}`,
      `Typ: ${opis(outlet.type)}`,
      `Linia redakcyjna: ${opis(outlet.editorial_line)}`,
      `Publicznosc: ${opis(outlet.audience_profile)}`,
    ].join("\n")
    : "brak danych";

  const materialy = input.materials.length > 0
    ? input.materials
      .map((m) => `- ${m.published_at?.slice(0, 10) ?? "bez daty"}: ${m.title}`)
      .join("\n")
    : "brak danych";

  const wypowiedzi = input.statements.length > 0
    ? input.statements
      .map((s) => `- ${s.date?.slice(0, 10) ?? "bez daty"}: ${s.text.slice(0, 500)}`)
      .join("\n")
    : "brak danych";

  return [
    `# Temat rozmowy\n${input.topic}`,
    input.scheduledAt ? `# Termin\n${input.scheduledAt}` : "",
    `# Polityk\nImie i nazwisko: ${opis(input.profile?.full_name)}\nOkreg: ${opis(input.profile?.district)}\nCele: ${opis(input.profile?.goals)}\nWartosci: ${opis(input.profile?.values)}\nGranice (nienaruszalne): ${opis(input.profile?.boundaries)}
Stanowiska wobec tematow: ${opis(input.profile?.topic_positions)}\nProfil stylu jezykowego: ${opis(input.profile?.style_profile)}`,
    `# Dziennikarz\n${dziennikarz}`,
    `# Redakcja\n${redakcja}`,
    `# Ostatnie materialy dziennikarza\n${materialy}`,
    `# Wlasne wypowiedzi polityka dopasowane do tematu\n${wypowiedzi}`,
    input.opinion ? `# Badania opinii publicznej\n${input.opinion}` : "",
    input.dayBrief ? `# Dzisiejszy przeglad dnia\n${input.dayBrief}` : "",
    `# Zadanie\nPrzygotuj brief przedwywiadowy. Dokladnie ${QUESTIONS_COUNT} pytan, 3 przekazy dnia.`,
  ].filter((s) => s !== "").join("\n\n");
}

async function generateBrief(input: GenerateInput): Promise<BriefContent> {
  const model = (await getGenerationModel()).withStructuredOutput(briefSchema, {
    name: "brief_przedwywiadowy",
  });
  const result = await model.invoke([
    ["system", loadPrompt("interview-brief")],
    ["human", buildHuman(input)],
  ]);
  return result as BriefContent;
}

// ---------------------------------------------------------------------------
// Operacje
// ---------------------------------------------------------------------------

async function opCreate(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (topic.length < TOPIC_MIN_LENGTH) {
    throw new HttpError(400, `Temat jest za krotki (min ${TOPIC_MIN_LENGTH} znakow).`);
  }
  const journalistId = typeof body.journalist_id === "string" ? body.journalist_id : null;
  const journalistName = typeof body.journalist_name === "string"
    ? body.journalist_name.trim() || null
    : null;
  const scheduledAt = typeof body.scheduled_at === "string" ? body.scheduled_at : null;

  const journalist = journalistId ? await getJournalist(supabase, journalistId) : null;
  const outletId = (journalist?.outlet_id as string | null) ??
    (typeof body.outlet_id === "string" ? body.outlet_id : null);

  const { data: created, error: insertError } = await supabase
    .from("interview_briefs")
    .insert({
      tenant_id: tenantId,
      topic,
      journalist_id: journalistId,
      outlet_id: outletId,
      scheduled_at: scheduledAt,
      status: "generating",
    })
    .select("id")
    .single();
  if (insertError) throw new Error(`Zapis briefu: ${insertError.message}`);
  const briefId = created.id as string;

  try {
    const [profile, materials, statements, opinion, dayBrief] = await Promise.all([
      getProfile(supabase, tenantId),
      journalistId ? getMaterials(supabase, journalistId) : Promise.resolve([]),
      getOwnStatements(supabase, tenantId, topic),
      searchOpinionContext(supabase, topic),
      getTodayBrief(supabase, tenantId),
    ]);

    const content = await generateBrief({
      topic,
      scheduledAt,
      profile: profile as Record<string, unknown> | null,
      journalist: journalist as Record<string, unknown> | null,
      journalistName,
      materials: materials as { title: string; published_at: string | null }[],
      statements,
      opinion,
      dayBrief,
    });

    await supabase
      .from("interview_briefs")
      .update({ status: "ready", content })
      .eq("tenant_id", tenantId)
      .eq("id", briefId);

    // Pytania ida takze do osobnej tabeli: to na nich wisi feedback po wywiadzie
    // (was_asked) i to one, a nie caly jsonb, sa jednostka oceny.
    const rows = content.pytania.map((p) => ({
      tenant_id: tenantId,
      brief_id: briefId,
      question: p.pytanie,
      probability: p.prawdopodobienstwo,
      recommended_answer: { teza: p.teza, punkty: p.punkty, ryzyko: p.ryzyko },
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from("brief_questions").insert(rows);
      if (error) throw new Error(`Zapis pytan: ${error.message}`);
    }

    return await readBrief(supabase, tenantId, briefId);
  } catch (err) {
    await supabase
      .from("interview_briefs")
      .update({ status: "error" })
      .eq("tenant_id", tenantId)
      .eq("id", briefId);
    throw err;
  }
}

async function readBrief(supabase: SupabaseClient, tenantId: string, briefId: string) {
  const { data, error } = await supabase
    .from("interview_briefs")
    .select(
      "id, topic, status, content, rating, feedback, scheduled_at, created_at, journalist_id, journalists ( full_name, role, outlets ( name ) )",
    )
    .eq("tenant_id", tenantId)
    .eq("id", briefId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt briefu: ${error.message}`);
  if (!data) throw new HttpError(404, "Nie znaleziono briefu.");

  const { data: questions } = await supabase
    .from("brief_questions")
    .select("id, question, probability, recommended_answer, was_asked")
    .eq("tenant_id", tenantId)
    .eq("brief_id", briefId)
    .order("probability", { ascending: false, nullsFirst: false });

  return { brief: data, questions: questions ?? [] };
}

async function opList(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("interview_briefs")
    .select(
      "id, topic, status, rating, scheduled_at, created_at, journalists ( full_name, outlets ( name ) )",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Lista briefow: ${error.message}`);
  return { briefs: data ?? [] };
}

async function opRate(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const briefId = typeof body.brief_id === "string" ? body.brief_id : "";
  const rating = typeof body.rating === "number" ? Math.trunc(body.rating) : 0;
  if (!briefId) throw new HttpError(400, "Brak brief_id.");
  if (rating < 1 || rating > 5) throw new HttpError(400, "Ocena musi byc od 1 do 5.");
  const feedback = typeof body.feedback === "string" ? body.feedback : null;

  const { error } = await supabase
    .from("interview_briefs")
    .update({ rating, feedback })
    .eq("tenant_id", tenantId)
    .eq("id", briefId);
  if (error) throw new Error(`Zapis oceny: ${error.message}`);
  return { rated: true };
}

async function opQuestionFeedback(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const questionId = typeof body.question_id === "string" ? body.question_id : "";
  if (!questionId) throw new HttpError(400, "Brak question_id.");
  const wasAsked = body.was_asked === true;

  const { error } = await supabase
    .from("brief_questions")
    .update({ was_asked: wasAsked })
    .eq("tenant_id", tenantId)
    .eq("id", questionId);
  if (error) throw new Error(`Zapis oznaczenia pytania: ${error.message}`);
  return { saved: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await authenticateRequest(req);
    const tenantId = await getTenantId(supabase, user.id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    switch (body?.operation) {
      case "create":
        return jsonResponse({ ok: true, data: await opCreate(supabase, tenantId, body) });
      case "get": {
        const briefId = typeof body.brief_id === "string" ? body.brief_id : "";
        if (!briefId) throw new HttpError(400, "Brak brief_id.");
        return jsonResponse({ ok: true, data: await readBrief(supabase, tenantId, briefId) });
      }
      case "list":
        return jsonResponse({ ok: true, data: await opList(supabase, tenantId) });
      case "rate":
        return jsonResponse({ ok: true, data: await opRate(supabase, tenantId, body) });
      case "question_feedback":
        return jsonResponse({
          ok: true,
          data: await opQuestionFeedback(supabase, tenantId, body),
        });
      default:
        return jsonResponse(
          { ok: false, error: `Nieznana operacja: ${body?.operation}` },
          400,
        );
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ ok: false, error: err.message }, err.status);
    }
    return serverErrorResponse("argus-brief", err);
  }
});
