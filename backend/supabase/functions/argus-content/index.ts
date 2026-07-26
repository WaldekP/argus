// argus-content — generator przekazu (TASK 7, kontrakt docs/kontrakt-task-7.md).
// Operacje: list_segments, create, generate_step, get, list,
// regenerate_variant, set_status.
//
// Stan generacji (decyzja, patrz kontrakt): plan wariantow (segment x kanal)
// zapisywany przy `create` w content_drafts.consistency_check._plan.
// Postep wyprowadzany wylacznie z porownania planu z content_drafts.variants
// (klucz segment_id + channel), a stan kontroli spojnosci z obecnosci klucza
// consistency_check.alerts. Dzieki temu kroki sa idempotentne: blad kroku
// mozna ponowic tym samym wywolaniem generate_step.
//
// Limit zasobow workera (ta sama lekcja co przy imporcie z Sejmu):
// jedno wywolanie generate_step tworzy maksymalnie 2 warianty (Sonnet);
// kontrola spojnosci lite (embedding + match_statements + Haiku) to osobny,
// ostatni krok petli.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import {
  getClassificationModel,
  getGenerationModel,
  loadPrompt,
} from "../_shared/ai.ts";
import { embedText } from "../_shared/embeddings.ts";

const VARIANTS_PER_CALL = 2; // limit zasobow workera Edge Functions
const CONSISTENCY_MATCH_LIMIT = 8;
const X_HARD_LIMIT = 280;
const LIST_LIMIT = 50;
const TOPIC_MIN_LENGTH = 5;

// Kanaly wg kontraktu + wymogi wstrzykiwane do promptu.
const CHANNELS: Record<string, { label: string; spec: string }> = {
  fb: {
    label: "Facebook",
    spec: "Post na Facebooka, 400-700 znakow, krotkie akapity, maksymalnie 2 hashtagi.",
  },
  x: {
    label: "X",
    spec:
      "Wpis na X (dawny Twitter). TWARDY limit 280 znakow lacznie, celuj w 200-270 znakow.",
  },
  tiktok: {
    label: "TikTok (skrypt)",
    spec:
      "Skrypt wideo na 30-45 sekund, okolo 90-120 slow, jezyk mowiony, didaskalia w nawiasach okraglych.",
  },
  prasa: {
    label: "Prasa lokalna",
    spec:
      "Wypowiedz do prasy lokalnej, 800-1200 znakow, pelne zdania, ton powazny, ale przystepny.",
  },
};

interface PlanItem {
  segment_id: string | null;
  segment_name: string;
  channel: string;
}

interface Variant extends PlanItem {
  text: string;
}

interface ConsistencyAlert {
  description: string;
  conflict_statement_id: string | null;
  suggested_response: string;
}

// Framing z tematu bazy wiedzy (opcjonalny most z zakladki Tematy do generatora).
// Klient rozwiazuje mapowanie: segments jest kluczowane po ID segmentu tenanta,
// bo to klient laczy segment korpusu z segmentem tenanta. Patrz
// docs/faza-2-generator.md oraz docs/kontrakt-task-7.md.
interface SegmentFraming {
  kat?: string;
  coDziala?: string[];
  czegoUnikac?: string[];
  przyklad?: string;
}

interface TopicFraming {
  slug?: string;
  stanowisko?: string;
  podchwycic?: string[];
  zaatakowac?: string[];
  segments?: Record<string, SegmentFraming>;
}

// Sanityzacja framingu z body (dane od zalogowanego klienta, ale ksztalt
// walidujemy, zeby model nie dostal smieci i zeby nie wywrocic promptu).
function parseFraming(raw: unknown): TopicFraming | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;
  const arr = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
      : undefined;

  const segments: Record<string, SegmentFraming> = {};
  if (r.segments && typeof r.segments === "object") {
    for (const [id, val] of Object.entries(r.segments as Record<string, unknown>)) {
      if (!val || typeof val !== "object") continue;
      const s = val as Record<string, unknown>;
      segments[id] = {
        kat: str(s.kat),
        coDziala: arr(s.coDziala),
        czegoUnikac: arr(s.czegoUnikac),
        przyklad: str(s.przyklad),
      };
    }
  }

  const framing: TopicFraming = {
    slug: str(r.slug),
    stanowisko: str(r.stanowisko),
    podchwycic: arr(r.podchwycic),
    zaatakowac: arr(r.zaatakowac),
    segments: Object.keys(segments).length > 0 ? segments : undefined,
  };
  // Pusty framing traktujemy jak brak.
  const hasContent = framing.stanowisko || framing.podchwycic ||
    framing.zaatakowac || framing.segments;
  return hasContent ? framing : null;
}

function getFraming(cc: unknown): TopicFraming | null {
  const raw = (cc as Record<string, unknown> | null)?._framing;
  return raw ? parseFraming(raw) : null;
}

// ---------------------------------------------------------------------------
// Schematy odpowiedzi AI — pelne, wszystkie pola wymagane (bez defaultow,
// zeby model nie mogl wywrocic operacji brakujacym polem).
// ---------------------------------------------------------------------------

const variantSchema = z.object({
  text: z.string().min(1).describe(
    "Pelna tresc wariantu po polsku, zgodna z wymogami i limitem znakow kanalu",
  ),
});

const consistencySchema = z.object({
  alerts: z.array(
    z.object({
      description: z.string().min(1).describe(
        "Opis sprzecznosci po polsku, 1 do 2 zdan",
      ),
      conflict_statement_index: z.number().int().nullable().describe(
        "Numer wypowiedzi z listy (od 1), z ktora przekaz jest sprzeczny; null gdy sprzecznosc ogolna",
      ),
      suggested_response: z.string().min(1).describe(
        "Sugerowana odpowiedz lub korekta przekazu po polsku",
      ),
    }),
  ).describe("Lista realnych sprzecznosci; pusta tablica gdy brak"),
});

// ---------------------------------------------------------------------------
// Helpery danych
// ---------------------------------------------------------------------------

function variantKey(item: { segment_id: string | null; channel: string }) {
  return `${item.segment_id ?? "null"}|${item.channel}`;
}

function charLength(text: string): number {
  return [...text].length;
}

async function getDraft(
  supabase: SupabaseClient,
  tenantId: string,
  draftId: unknown,
) {
  if (typeof draftId !== "string" || !draftId) {
    throw new HttpError(400, "Podaj identyfikator draftu (draft_id)");
  }
  const { data, error } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", draftId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt draftu: ${error.message}`);
  if (!data) throw new HttpError(404, "Nie znaleziono draftu");
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

async function fetchSegmentsById(
  supabase: SupabaseClient,
  tenantId: string,
  ids: string[],
): Promise<Map<string, { name: string; profile: unknown }>> {
  const map = new Map<string, { name: string; profile: unknown }>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("segments")
    .select("id, name, profile")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (error) throw new Error(`Odczyt segmentow: ${error.message}`);
  for (const row of data ?? []) {
    map.set(row.id as string, {
      name: row.name as string,
      profile: row.profile,
    });
  }
  return map;
}

async function saveVariants(
  supabase: SupabaseClient,
  tenantId: string,
  draftId: string,
  variants: Variant[],
) {
  const { error } = await supabase
    .from("content_drafts")
    .update({ variants })
    .eq("tenant_id", tenantId)
    .eq("id", draftId);
  if (error) throw new Error(`Zapis wariantow: ${error.message}`);
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
  if (!profile) return "Brak danych o polityku (onboarding pominiety).";
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
// Generacja jednego wariantu
// ---------------------------------------------------------------------------

interface GenerateVariantInput {
  profile: Awaited<ReturnType<typeof getProfile>>;
  item: PlanItem;
  segmentProfile: unknown | null;
  topic: string;
  coreMessage: string | null;
  existingVariants: Variant[];
  framing?: TopicFraming | null;
  feedback?: string;
}

function buildVariantHuman(input: GenerateVariantInput): string {
  const { profile, item, segmentProfile, topic, coreMessage, framing, feedback } =
    input;
  const spec = CHANNELS[item.channel];

  // Kontekst spojnosci: najpierw warianty tego samego segmentu, potem inne.
  const sameSegment = input.existingVariants.filter(
    (v) => v.segment_id === item.segment_id,
  );
  const others = input.existingVariants.filter(
    (v) => v.segment_id !== item.segment_id,
  );
  const context = [...sameSegment, ...others].slice(0, 3);

  const lines = [
    "Kontekst polityka:",
    profileContext(profile),
    "",
    "Profil stylu polityka:",
    JSON.stringify(profile?.style_profile ?? {}, null, 2),
    "",
    "Wartosci i osie pogladow:",
    JSON.stringify(profile?.values ?? {}, null, 2),
    "",
    "Granice (czego polityk publicznie nie mowi):",
    JSON.stringify(profile?.boundaries ?? {}, null, 2),
    "",
    `Segment wyborcow: ${item.segment_name}`,
    segmentProfile
      ? `Opis segmentu:\n${JSON.stringify(segmentProfile, null, 2)}`
      : "Tryb ogolny: przekaz uniwersalny, bez konkretnego segmentu.",
    "",
    `Kanal: ${spec.label} (${item.channel})`,
    `Wymogi kanalu: ${spec.spec}`,
    "",
    `Temat przekazu: ${topic}`,
    coreMessage
      ? `Kluczowy komunikat (ma wybrzmiec): ${coreMessage}`
      : "Kluczowy komunikat: brak, sformuluj naturalnie na podstawie tematu.",
  ];

  if (framing) {
    const segF = item.segment_id ? framing.segments?.[item.segment_id] : undefined;
    lines.push("", "Stanowisko z bazy wiedzy (temat programowy):");
    if (framing.stanowisko) {
      lines.push(
        `Przyjete stanowisko polityka (wariant NIE moze byc z nim sprzeczny): ${framing.stanowisko}`,
      );
    }
    if (framing.podchwycic?.length) {
      lines.push(
        "Katy do wykorzystania (podchwycic):",
        ...framing.podchwycic.map((p) => `- ${p}`),
      );
    }
    if (framing.zaatakowac?.length) {
      lines.push(
        "Kontry wobec przeciwnikow (uzyj, jesli pasuja do kanalu i tonu):",
        ...framing.zaatakowac.map((z) => `- ${z}`),
      );
    }
    if (segF) {
      if (segF.kat) lines.push(`Kat przekazu dla tego segmentu: ${segF.kat}`);
      if (segF.coDziala?.length) {
        lines.push("Co dziala w tym segmencie:", ...segF.coDziala.map((c) => `- ${c}`));
      }
      if (segF.czegoUnikac?.length) {
        lines.push(
          "Czego unikac w tym segmencie:",
          ...segF.czegoUnikac.map((c) => `- ${c}`),
        );
      }
      if (segF.przyklad) {
        lines.push(
          `Wzorcowe sformulowanie (wzoruj sie na tonie, nie kopiuj doslownie): ${segF.przyklad}`,
        );
      }
    }
  }

  if (context.length > 0) {
    lines.push(
      "",
      "Wczesniej wygenerowane warianty tego przekazu (zachowaj spojnosc merytoryczna, nie kopiuj formy):",
      ...context.map((v) =>
        `- [${CHANNELS[v.channel]?.label ?? v.channel}, segment: ${v.segment_name}] ${v.text.slice(0, 400)}`
      ),
    );
  }

  if (feedback) {
    lines.push(
      "",
      "Uwagi uzytkownika do poprzedniej wersji tego wariantu (uwzglednij je):",
      feedback,
    );
  }

  lines.push(
    "",
    "Napisz jeden wariant dla wskazanego segmentu i kanalu.",
  );
  return lines.join("\n");
}

// Twardy limit X: jedna proba skrotu przez model, ostatecznie przyciecie
// na granicy slowa (udokumentowane ograniczenie).
function hardTrimX(text: string): string {
  const chars = [...text];
  if (chars.length <= X_HARD_LIMIT) return text;
  let cut = chars.slice(0, X_HARD_LIMIT - 3).join("");
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > X_HARD_LIMIT / 2) cut = cut.slice(0, lastSpace);
  return `${cut}...`;
}

async function generateVariantText(input: GenerateVariantInput): Promise<string> {
  const system = loadPrompt("content-variant");
  const human = buildVariantHuman(input);
  const model = (await getGenerationModel()).withStructuredOutput(
    variantSchema,
    { name: "content_variant" },
  );

  const result = await model.invoke([["system", system], ["human", human]]);
  let text = result.text.trim();

  if (input.item.channel === "x" && charLength(text) > X_HARD_LIMIT) {
    const retry = await model.invoke([
      ["system", system],
      [
        "human",
        `${human}\n\nPoprzednia wersja miala ${charLength(text)} znakow i przekroczyla twardy limit ${X_HARD_LIMIT} znakow kanalu X. Skroc ja do maksymalnie 270 znakow, zachowujac sens:\n${text}`,
      ],
    ]);
    text = retry.text.trim();
    if (charLength(text) > X_HARD_LIMIT) text = hardTrimX(text);
  }
  return text;
}

// ---------------------------------------------------------------------------
// Kontrola spojnosci lite (ostatni krok petli generate_step)
// ---------------------------------------------------------------------------

async function runConsistencyCheck(
  supabase: SupabaseClient,
  tenantId: string,
  draft: { id: string; topic: string; core_message: string | null },
  variants: Variant[],
  stanowisko?: string | null,
): Promise<ConsistencyAlert[]> {
  const queryText = [draft.topic, draft.core_message ?? ""].join(". ").trim();
  const embedding = await embedText(queryText);
  const { data: matches, error } = await supabase.rpc("match_statements", {
    p_tenant_id: tenantId,
    p_query_embedding: embedding,
    p_limit: CONSISTENCY_MATCH_LIMIT,
  });
  if (error) throw new Error(`match_statements: ${error.message}`);

  const statements = (matches ?? []) as {
    id: string;
    text: string;
    date: string | null;
  }[];
  // Brak wypowiedzi i brak przyjetego stanowiska = brak alertow, bez modelu.
  // Gdy jest stanowisko z tematu, sprawdzamy nawet bez historii wypowiedzi.
  if (statements.length === 0 && !stanowisko) return [];

  const statementsBlock = statements
    .map((s, i) =>
      `${i + 1}. [${s.date ?? "brak daty"}] ${String(s.text).slice(0, 800)}`
    )
    .join("\n\n");
  const variantsBlock = variants
    .map((v) =>
      `- [${CHANNELS[v.channel]?.label ?? v.channel}, segment: ${v.segment_name}] ${v.text.slice(0, 500)}`
    )
    .join("\n");

  const model = (await getClassificationModel()).withStructuredOutput(
    consistencySchema,
    { name: "consistency_check" },
  );
  const result = await model.invoke([
    ["system", loadPrompt("content-consistency")],
    [
      "human",
      [
        `Temat przekazu: ${draft.topic}`,
        `Kluczowy komunikat: ${draft.core_message ?? "brak"}`,
        stanowisko
          ? `\nStanowisko przyjete przez polityka w tym temacie: ${stanowisko}\nOznacz jako sprzecznosc (conflict_statement_index: null) takze kazdy wariant sprzeczny z tym stanowiskiem.`
          : "",
        "",
        "Warianty przekazu:",
        variantsBlock,
        "",
        statements.length > 0
          ? "Wczesniejsze wypowiedzi polityka (ponumerowane):"
          : "Brak wczesniejszych wypowiedzi w bazie.",
        statementsBlock,
      ].join("\n"),
    ],
  ]);

  const rawAlerts = Array.isArray(result.alerts) ? result.alerts : [];
  return rawAlerts
    .filter((a) => a && typeof a.description === "string" && a.description.trim())
    .map((a) => {
      const idx = typeof a.conflict_statement_index === "number"
        ? a.conflict_statement_index
        : null;
      const matched = idx !== null && idx >= 1 && idx <= statements.length
        ? statements[idx - 1].id
        : null;
      return {
        description: a.description.trim(),
        conflict_statement_id: matched,
        suggested_response: typeof a.suggested_response === "string"
          ? a.suggested_response.trim()
          : "",
      };
    });
}

// ---------------------------------------------------------------------------
// Operacje
// ---------------------------------------------------------------------------

async function opListSegments(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("segments")
    .select("id, name, priority")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Odczyt segmentow: ${error.message}`);
  return { segments: data ?? [] };
}

async function opCreate(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: {
    topic?: unknown;
    core_message?: unknown;
    segment_ids?: unknown;
    channels?: unknown;
    topic_framing?: unknown;
  },
) {
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (topic.length < TOPIC_MIN_LENGTH) {
    throw new HttpError(400, "Temat musi miec co najmniej 5 znakow");
  }
  const coreMessage =
    typeof body.core_message === "string" && body.core_message.trim()
      ? body.core_message.trim()
      : null;

  const rawChannels = Array.isArray(body.channels) ? body.channels : [];
  const channels = [...new Set(rawChannels.filter(
    (c): c is string => typeof c === "string",
  ))];
  if (channels.length === 0) {
    throw new HttpError(400, "Wybierz co najmniej jeden kanal");
  }
  for (const c of channels) {
    if (!CHANNELS[c]) throw new HttpError(400, `Nieznany kanal: ${c}`);
  }

  const rawSegmentIds = Array.isArray(body.segment_ids) ? body.segment_ids : [];
  const segmentIds = [...new Set(rawSegmentIds.filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  ))];
  const segMap = await fetchSegmentsById(supabase, tenantId, segmentIds);
  for (const id of segmentIds) {
    if (!segMap.has(id)) {
      throw new HttpError(400, "Nieprawidlowy segment na liscie segment_ids");
    }
  }

  const segmentPlan: { segment_id: string | null; segment_name: string }[] =
    segmentIds.length > 0
      ? segmentIds.map((id) => ({
        segment_id: id,
        segment_name: segMap.get(id)!.name,
      }))
      : [{ segment_id: null, segment_name: "Ogólny" }];

  const plan: PlanItem[] = [];
  for (const seg of segmentPlan) {
    for (const channel of channels) {
      plan.push({ ...seg, channel });
    }
  }

  const framing = parseFraming(body.topic_framing);

  const { data, error } = await supabase
    .from("content_drafts")
    .insert({
      tenant_id: tenantId,
      topic,
      core_message: coreMessage,
      variants: [],
      status: "draft",
      consistency_check: framing ? { _plan: plan, _framing: framing } : { _plan: plan },
    })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis draftu: ${error.message}`);

  await logAccess(supabase, tenantId, userId, "content_create", `draft:${data.id}`);
  return { draft_id: data.id, total_variants: plan.length };
}

async function opGenerateStep(
  supabase: SupabaseClient,
  tenantId: string,
  body: { draft_id?: unknown },
) {
  const draft = await getDraft(supabase, tenantId, body.draft_id);
  const cc = (draft.consistency_check ?? {}) as Record<string, unknown>;
  const plan = Array.isArray(cc._plan) ? cc._plan as PlanItem[] : [];
  if (plan.length === 0) {
    throw new HttpError(400, "Draft nie ma planu generacji. Utworz go ponownie.");
  }
  const variants: Variant[] = Array.isArray(draft.variants)
    ? draft.variants as Variant[]
    : [];
  const framing = getFraming(cc);
  const have = new Set(variants.map(variantKey));
  const missing = plan.filter((p) => !have.has(variantKey(p)));
  const consistencyDone = Array.isArray(cc.alerts);

  // Wszystko zrobione: wywolanie idempotentne.
  if (missing.length === 0 && consistencyDone) {
    return {
      processed: plan.length,
      total: plan.length,
      next: false,
      consistency_done: true,
    };
  }

  if (missing.length > 0) {
    const batch = missing.slice(0, VARIANTS_PER_CALL);
    const profile = await getProfile(supabase, tenantId);
    const segIds = [
      ...new Set(
        batch.map((b) => b.segment_id).filter((s): s is string => Boolean(s)),
      ),
    ];
    const segMap = await fetchSegmentsById(supabase, tenantId, segIds);

    let current = variants;
    for (const item of batch) {
      const text = await generateVariantText({
        profile,
        item,
        segmentProfile: item.segment_id
          ? segMap.get(item.segment_id)?.profile ?? null
          : null,
        topic: draft.topic as string,
        coreMessage: draft.core_message as string | null,
        existingVariants: current,
        framing,
      });
      current = [...current, { ...item, text }];
      // Zapis po kazdym wariancie: blad w polowie kroku nie traci pracy.
      await saveVariants(supabase, tenantId, draft.id as string, current);
    }
    return {
      processed: current.length,
      total: plan.length,
      next: true,
      consistency_done: false,
    };
  }

  // Warianty komplet, brak alerts: ostatni krok — kontrola spojnosci lite.
  const alerts = await runConsistencyCheck(
    supabase,
    tenantId,
    {
      id: draft.id as string,
      topic: draft.topic as string,
      core_message: draft.core_message as string | null,
    },
    variants,
    framing?.stanowisko ?? null,
  );

  // Idempotencja: usuwamy poprzednie alerty tego draftu przed insertem.
  const { error: deleteError } = await supabase
    .from("consistency_alerts")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("source_type", "draft")
    .eq("source_id", draft.id);
  if (deleteError) {
    throw new Error(`Czyszczenie alertow: ${deleteError.message}`);
  }
  if (alerts.length > 0) {
    const { error: insertError } = await supabase
      .from("consistency_alerts")
      .insert(alerts.map((a) => ({
        tenant_id: tenantId,
        source_type: "draft",
        source_id: draft.id,
        conflict_statement_id: a.conflict_statement_id,
        description: a.description,
        suggested_response: a.suggested_response,
      })));
    if (insertError) throw new Error(`Zapis alertow: ${insertError.message}`);
  }

  const { error: updateError } = await supabase
    .from("content_drafts")
    .update({ consistency_check: { ...cc, alerts } })
    .eq("tenant_id", tenantId)
    .eq("id", draft.id);
  if (updateError) {
    throw new Error(`Zapis kontroli spojnosci: ${updateError.message}`);
  }

  return {
    processed: plan.length,
    total: plan.length,
    next: false,
    consistency_done: true,
  };
}

function draftAlerts(cc: unknown): ConsistencyAlert[] {
  const alerts = (cc as Record<string, unknown> | null)?.alerts;
  return Array.isArray(alerts) ? alerts as ConsistencyAlert[] : [];
}

async function opGet(
  supabase: SupabaseClient,
  tenantId: string,
  body: { draft_id?: unknown },
) {
  const draft = await getDraft(supabase, tenantId, body.draft_id);
  return {
    draft: {
      id: draft.id,
      topic: draft.topic,
      core_message: draft.core_message,
      status: draft.status,
      created_at: draft.created_at,
      variants: Array.isArray(draft.variants) ? draft.variants : [],
      consistency_check: { alerts: draftAlerts(draft.consistency_check) },
    },
  };
}

async function opList(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("content_drafts")
    .select("id, topic, status, created_at, variants, consistency_check")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Odczyt draftow: ${error.message}`);
  return {
    drafts: (data ?? []).map((d) => ({
      id: d.id,
      topic: d.topic,
      status: d.status,
      created_at: d.created_at,
      variants_count: Array.isArray(d.variants) ? d.variants.length : 0,
      alerts_count: draftAlerts(d.consistency_check).length,
    })),
  };
}

async function opRegenerateVariant(
  supabase: SupabaseClient,
  tenantId: string,
  body: {
    draft_id?: unknown;
    segment_id?: unknown;
    channel?: unknown;
    feedback?: unknown;
  },
) {
  const draft = await getDraft(supabase, tenantId, body.draft_id);
  const channel = typeof body.channel === "string" ? body.channel : "";
  if (!CHANNELS[channel]) {
    throw new HttpError(400, `Nieznany kanal: ${channel || "(brak)"}`);
  }
  const segmentId = typeof body.segment_id === "string" && body.segment_id
    ? body.segment_id
    : null;
  const feedback = typeof body.feedback === "string" && body.feedback.trim()
    ? body.feedback.trim()
    : undefined;

  const cc = (draft.consistency_check ?? {}) as Record<string, unknown>;
  const framing = getFraming(cc);
  const plan = Array.isArray(cc._plan) ? cc._plan as PlanItem[] : [];
  const item = plan.find(
    (p) => variantKey(p) === variantKey({ segment_id: segmentId, channel }),
  );
  if (!item) {
    throw new HttpError(
      404,
      "Ten draft nie zawiera wariantu dla wskazanego segmentu i kanalu",
    );
  }

  const variants: Variant[] = Array.isArray(draft.variants)
    ? draft.variants as Variant[]
    : [];
  const profile = await getProfile(supabase, tenantId);
  const segMap = await fetchSegmentsById(
    supabase,
    tenantId,
    item.segment_id ? [item.segment_id] : [],
  );

  const text = await generateVariantText({
    profile,
    item,
    segmentProfile: item.segment_id
      ? segMap.get(item.segment_id)?.profile ?? null
      : null,
    topic: draft.topic as string,
    coreMessage: draft.core_message as string | null,
    existingVariants: variants.filter(
      (v) => variantKey(v) !== variantKey(item),
    ),
    framing,
    feedback,
  });

  const variant: Variant = { ...item, text };
  const updated = [
    ...variants.filter((v) => variantKey(v) !== variantKey(item)),
    variant,
  ];
  await saveVariants(supabase, tenantId, draft.id as string, updated);
  return { variant };
}

async function opSetStatus(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: { draft_id?: unknown; status?: unknown },
) {
  const status = body.status;
  if (status !== "accepted" && status !== "rejected") {
    throw new HttpError(400, "Status musi byc accepted albo rejected");
  }
  const draft = await getDraft(supabase, tenantId, body.draft_id);
  const { error } = await supabase
    .from("content_drafts")
    .update({ status })
    .eq("tenant_id", tenantId)
    .eq("id", draft.id);
  if (error) throw new Error(`Zapis statusu: ${error.message}`);
  await logAccess(
    supabase,
    tenantId,
    userId,
    "content_set_status",
    `draft:${draft.id}:${status}`,
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
      case "list_segments":
        return jsonResponse({
          ok: true,
          data: await opListSegments(supabase, tenantId),
        });
      case "create":
        return jsonResponse({
          ok: true,
          data: await opCreate(supabase, tenantId, user.id, body),
        });
      case "generate_step":
        return jsonResponse({
          ok: true,
          data: await opGenerateStep(supabase, tenantId, body),
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
      case "regenerate_variant":
        return jsonResponse({
          ok: true,
          data: await opRegenerateVariant(supabase, tenantId, body),
        });
      case "set_status":
        return jsonResponse({
          ok: true,
          data: await opSetStatus(supabase, tenantId, user.id, body),
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
    return serverErrorResponse("argus-content", err);
  }
});
