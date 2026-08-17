// Synchronizacja wzmianek Brand24 -> tabela `mentions`, z oceną sentymentu przez
// Haiku (trafniejszą dla polskiego niż surowe -1/0/1 z Brand24).
//
// Dwie ścieżki wejścia (jak przy RSS w mentions.ts):
//   - argus-mentions (operation `brand24_sync`) — user klika „Odśwież",
//   - argus-ingest (operation `brand24_sync`) — cron dla wszystkich tenantów.
//
// Wzmianki Brand24 podpinamy pod jedno syntetyczne hasło-rodzic w
// topics_watched (bo mentions.topic_id jest NOT NULL). To hasło ma active=false,
// żeby cron RSS go nie dotykał. Namiary projektu: tabela brand24_projects.
//
// Wydajność: klasyfikujemy TYLKO nowe wzmianki (te, których jeszcze nie ma w
// bazie) i wstawiamy je już z tonem jednym upsertem — bez setki update'ów per
// wiersz, żeby zmieścić się w limicie czasu przycisku „Odśwież".
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod";

import { getClassificationModel, loadPrompt } from "./ai.ts";
import {
  type Brand24Mention,
  getMentions,
  mentionExternalId,
  mentionUrl,
} from "./brand24.ts";

/** Nazwa syntetycznego hasła-rodzica pod wzmianki Brand24. */
const PARENT_PHRASE = "Brand24 (monitoring)";
/** Okno pobierania: ostatnie N dni (Data API pozwala max 31). */
const WINDOW_DAYS = 7;
/** Ile wzmianek pobieramy i przetwarzamy na jedno wywołanie. */
const MAX_MENTIONS_PER_RUN = 50;
/** Ile wzmianek klasyfikujemy jednym wywołaniem Haiku. */
const SENTIMENT_BATCH = 15;

export interface Brand24SyncResult {
  tenant_id: string;
  configured: boolean;
  fetched: number;
  inserted: number;
  classified: number;
  error: string | null;
}

interface ProjectRow {
  tenant_id: string;
  account_id: string;
  project_id: string;
  watched_topic_id: string | null;
}

/** Logiczna „dziś" w strefie Warszawy (data, nie UTC). */
function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}

function daysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}

/** date + time z Brand24 -> timestamptz. Czas traktujemy jako czas polski. */
function publishedAt(m: Brand24Mention): string | null {
  if (!m.date) return null;
  const time = typeof m.time === "string" && /^\d{1,2}:\d{2}/.test(m.time)
    ? (m.time.length === 4 ? `0${m.time}` : m.time.slice(0, 5))
    : "00:00";
  // +02:00 to CEST; drobna nieścisłość zimą jest bez znaczenia dla sortowania.
  return `${m.date}T${time}:00+02:00`;
}

/**
 * Tytuł wzmianki — zawsze niepusty (mentions.title jest NOT NULL). Wzmianki z X
 * mają title i content null, więc gdy brak tytułu, budujemy go z treści albo
 * z etykiety źródła.
 */
function mentionTitle(m: Brand24Mention): string {
  const t = typeof m.title === "string" ? m.title.trim() : "";
  if (t) return t;
  const c = typeof m.content === "string" ? m.content.trim() : "";
  if (c) return c.length > 120 ? `${c.slice(0, 117)}...` : c;
  const label = m.category || m.host || "brak treści";
  return `Wzmianka (${label})`;
}

/**
 * Link wzmianki — zawsze niepusty (mentions.url jest NOT NULL). Kolejność:
 * prawdziwy URL, status na X z „Tweet-ID: ...", inaczej domena hosta.
 */
function mentionLink(m: Brand24Mention): string {
  const url = mentionUrl(m);
  if (url) return url;
  const source = m.source?.trim() ?? "";
  const tweet = /tweet-id/i.test(source) ? source.match(/(\d{6,})/) : null;
  if (tweet) return `https://x.com/i/web/status/${tweet[1]}`;
  const host = m.host?.trim().replace(/^https?:\/\//, "");
  if (host) return `https://${host}`;
  return "https://brand24.com";
}

/** Tekst wzmianki do oceny sentymentu. Null, gdy nie ma czego oceniać. */
function mentionText(m: Brand24Mention): string | null {
  const parts = [m.title, m.content]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v !== "");
  return parts.length > 0 ? parts.join(" — ") : null;
}

// ---------------------------------------------------------------------------
// Setup: syntetyczne hasło-rodzic + wpis brand24_projects. Idempotentne.
// ---------------------------------------------------------------------------

export async function setupBrand24(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    accountId: string;
    projectId: string;
    keywords?: unknown[];
  },
): Promise<{ tenant_id: string; project_id: string; watched_topic_id: string }> {
  const { tenantId, accountId, projectId } = opts;

  const { data: existing } = await supabase
    .from("brand24_projects")
    .select("watched_topic_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let topicId = existing?.watched_topic_id as string | null | undefined;

  if (!topicId) {
    const { data: found } = await supabase
      .from("topics_watched")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("phrase", PARENT_PHRASE)
      .maybeSingle();
    topicId = found?.id;
  }

  if (!topicId) {
    const { data: created, error } = await supabase
      .from("topics_watched")
      .insert({
        tenant_id: tenantId,
        phrase: PARENT_PHRASE,
        query: null,
        window_days: WINDOW_DAYS,
        active: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Nie udało się utworzyć hasła-rodzica: ${error.message}`);
    topicId = created.id;
  }

  const { error: upsertError } = await supabase.from("brand24_projects").upsert(
    {
      tenant_id: tenantId,
      account_id: accountId,
      project_id: projectId,
      keywords: opts.keywords ?? [],
      watched_topic_id: topicId,
    },
    { onConflict: "tenant_id" },
  );
  if (upsertError) throw new Error(upsertError.message);

  return { tenant_id: tenantId, project_id: projectId, watched_topic_id: topicId! };
}

// ---------------------------------------------------------------------------
// Sentyment (Haiku, batchami)
// ---------------------------------------------------------------------------

const sentimentSchema = z.object({
  oceny: z.array(
    z.object({
      nr: z.number(),
      ton: z.enum(["przychylna", "krytyczna", "atak", "neutralna"]),
    }),
  ),
});

type Tone = z.infer<typeof sentimentSchema>["oceny"][number]["ton"];

/** Fallback dla wzmianek bez tekstu: surowy sentyment Brand24 (-1/0/1) -> ton. */
function toneFromBrand24(value: number | null | undefined): Tone | null {
  if (value === null || value === undefined) return null;
  if (value > 0) return "przychylna";
  if (value < 0) return "krytyczna"; // z liczby nie odróżnimy krytyki od ataku
  return "neutralna";
}

async function classifyBatch(
  politician: string,
  items: { nr: number; text: string }[],
): Promise<Map<number, Tone>> {
  const system = loadPrompt("mention-sentiment");
  const human = [
    `Polityk, dla którego pracujesz: ${politician}`,
    "",
    "Wzmianki do oceny (oceń każdą po jej numerze):",
    ...items.map((it) => `[${it.nr}] ${it.text}`),
  ].join("\n");

  const model = (await getClassificationModel()).withStructuredOutput(
    sentimentSchema,
    { name: "sentyment_wzmianek" },
  );
  const result = await model.invoke([
    ["system", system],
    ["human", human],
  ]);

  const map = new Map<number, Tone>();
  for (const o of result.oceny ?? []) map.set(o.nr, o.ton);
  return map;
}

// ---------------------------------------------------------------------------
// Sync jednego tenanta
// ---------------------------------------------------------------------------

export async function syncBrand24Tenant(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<Brand24SyncResult> {
  const base: Brand24SyncResult = {
    tenant_id: tenantId,
    configured: false,
    fetched: 0,
    inserted: 0,
    classified: 0,
    error: null,
  };

  const { data: project } = await supabase
    .from("brand24_projects")
    .select("tenant_id, account_id, project_id, watched_topic_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!project) return base; // tenant bez konfiguracji Brand24 — pomijamy cicho
  base.configured = true;

  const proj = project as ProjectRow;

  try {
    // Hasło-rodzic musi istnieć (setup je tworzy). Gdyby go zabrakło — zakładamy.
    let topicId = proj.watched_topic_id;
    if (!topicId) {
      const setup = await setupBrand24(supabase, {
        tenantId,
        accountId: proj.account_id,
        projectId: proj.project_id,
      });
      topicId = setup.watched_topic_id;
    }

    // 1. Pobranie porcji wzmianek (jedna strona, ograniczona liczbą na przebieg).
    const page = await getMentions(proj.project_id, {
      dateFrom: daysAgo(WINDOW_DAYS),
      dateTo: today(),
      limit: MAX_MENTIONS_PER_RUN,
    });
    base.fetched = page.mentions.length;

    // 2. Dedup w obrębie porcji po kluczu syntetycznym; pomijamy bez klucza.
    const byExt = new Map<string, Brand24Mention>();
    for (const m of page.mentions) {
      const ext = mentionExternalId(m);
      if (ext && !byExt.has(ext)) byExt.set(ext, m);
    }
    if (byExt.size === 0) {
      await markSynced(supabase, tenantId, null);
      return base;
    }

    // 3. Które już są w bazie — klasyfikujemy i wstawiamy tylko nowe.
    const extIds = [...byExt.keys()];
    const { data: existing } = await supabase
      .from("mentions")
      .select("external_id")
      .eq("topic_id", topicId)
      .in("external_id", extIds);
    const seen = new Set((existing ?? []).map((r) => (r as { external_id: string }).external_id));
    const fresh = extIds.filter((e) => !seen.has(e)).map((e) => byExt.get(e)!);

    if (fresh.length === 0) {
      await markSynced(supabase, tenantId, null);
      return base;
    }

    // 4. Sentyment. Wzmianki z tekstem -> Haiku; bez tekstu (np. X) -> fallback
    //    na surowy sentyment Brand24, bo nie ma czego dać modelowi.
    const politician = await politicianName(supabase, tenantId);
    const toneByExt = new Map<string, Tone | null>();
    const withText: { ext: string; nr: number; text: string }[] = [];

    fresh.forEach((m, i) => {
      const ext = mentionExternalId(m)!;
      const text = mentionText(m);
      if (text) withText.push({ ext, nr: i, text });
      else toneByExt.set(ext, toneFromBrand24(m.sentiment ?? null));
    });

    for (let i = 0; i < withText.length; i += SENTIMENT_BATCH) {
      const batch = withText.slice(i, i + SENTIMENT_BATCH);
      let toneByNr = new Map<number, Tone>();
      try {
        toneByNr = await classifyBatch(
          politician,
          batch.map((b) => ({ nr: b.nr, text: b.text.slice(0, 600) })),
        );
      } catch (err) {
        // Klasyfikacja to wzbogacenie, nie warunek zapisu: brak tonu jest
        // dopuszczalny (kolumna nullable), więc błąd Haiku nie wywala synca.
        console.warn("brand24 sentyment:", err instanceof Error ? err.message : err);
      }
      for (const b of batch) toneByExt.set(b.ext, toneByNr.get(b.nr) ?? null);
    }

    // 5. Jeden upsert nowych wzmianek, już z tonem.
    const classifiedAt = new Date().toISOString();
    const rows = fresh.map((m) => {
      const ext = mentionExternalId(m)!;
      const tone = toneByExt.get(ext) ?? null;
      const text = mentionText(m);
      return {
        tenant_id: tenantId,
        topic_id: topicId,
        source: "brand24",
        external_id: ext,
        title: mentionTitle(m),
        url: mentionLink(m),
        snippet: m.content ?? null,
        published_at: publishedAt(m),
        source_name: m.host ?? null,
        source_url: null,
        tone,
        classified_at: tone !== null ? classifiedAt : null,
        classification: {
          brand24_sentiment: m.sentiment ?? null,
          category: m.category ?? null,
          host: m.host ?? null,
          tone_source: text ? "haiku" : "brand24",
        },
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from("mentions")
      .upsert(rows, { onConflict: "topic_id,external_id", ignoreDuplicates: true })
      .select("id, tone");

    if (insertError) throw new Error(insertError.message);
    base.inserted = inserted?.length ?? 0;
    base.classified = (inserted ?? []).filter((r) => (r as { tone: string | null }).tone !== null).length;

    await markSynced(supabase, tenantId, null);
    return base;
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
    await markSynced(supabase, tenantId, base.error);
    return base;
  }
}

async function politicianName(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<string> {
  const { data } = await supabase
    .from("politician_profiles")
    .select("full_name")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data?.full_name as string | undefined) ?? "polityk";
}

async function markSynced(
  supabase: SupabaseClient,
  tenantId: string,
  error: string | null,
) {
  await supabase
    .from("brand24_projects")
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: error })
    .eq("tenant_id", tenantId);
}

// ---------------------------------------------------------------------------
// Sync wszystkich tenantów (cron)
// ---------------------------------------------------------------------------

export async function syncBrand24AllTenants(
  supabase: SupabaseClient,
): Promise<Brand24SyncResult[]> {
  const { data, error } = await supabase
    .from("brand24_projects")
    .select("tenant_id")
    .order("last_synced_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);

  const results: Brand24SyncResult[] = [];
  for (const row of (data ?? []) as { tenant_id: string }[]) {
    results.push(await syncBrand24Tenant(supabase, row.tenant_id));
  }
  return results;
}
