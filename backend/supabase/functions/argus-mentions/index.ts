// argus-mentions — wzmianki prasowe pod hasla obserwowane przez tenanta.
// Operacje: list_topics, add_topic, update_topic, remove_topic, sync,
// list_mentions, mark_read, dismiss.
//
// Zrodlo danych: Google News RSS (darmowe, bez klucza). Swiadoma decyzja
// zamiast platnego monitoringu mediow — uzasadnienie w naglowku migracji
// 20260724150000_mentions_google_news.sql.
//
// Kontrakt: docs/kontrakt-wzmianki.md
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/types.ts";
import { syncTenant, type TopicSyncResult } from "../_shared/mentions.ts";

/** Ile hasel moze miec jeden tenant. Chroni przed zajezdzeniem crona. */
const MAX_TOPICS_PER_TENANT = 25;

/** Domyslna i maksymalna liczba wzmianek na jedno pobranie listy. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const MENTION_COLUMNS =
  "id, topic_id, title, url, snippet, published_at, source_name, source_url, tone, read_at, created_at";

function requireString(value: unknown, field: string, min = 1): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min) {
    throw new HttpError(400, `Pole ${field} jest wymagane.`);
  }
  return text;
}

function requireUuid(value: unknown, field: string): string {
  const text = requireString(value, field);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
  ) {
    throw new HttpError(400, `Pole ${field} nie jest poprawnym identyfikatorem.`);
  }
  return text;
}

function optionalString(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function clampWindowDays(value: unknown, fallback = 7): number {
  const days = typeof value === "number" ? Math.trunc(value) : Number.NaN;
  if (Number.isNaN(days)) return fallback;
  return Math.min(Math.max(days, 1), 30);
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

// ---------------------------------------------------------------------------
// Operacje: hasla
// ---------------------------------------------------------------------------

/**
 * Hasla tenanta wraz z licznikiem nowych wzmianek (nieprzeczytanych,
 * nieodrzuconych). Licznik liczymy w jednym przebiegu po stronie funkcji,
 * zeby nie robic zapytania na haslo.
 */
async function opListTopics(supabase: SupabaseClient, tenantId: string) {
  const { data: topics, error } = await supabase
    .from("topics_watched")
    .select(
      "id, phrase, query, window_days, active, last_synced_at, last_sync_error, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const { data: unread, error: unreadError } = await supabase
    .from("mentions")
    .select("topic_id")
    .eq("tenant_id", tenantId)
    .is("read_at", null)
    .is("dismissed_at", null);

  if (unreadError) throw new Error(unreadError.message);

  const counts = new Map<string, number>();
  for (const row of unread ?? []) {
    const key = (row as { topic_id: string }).topic_id;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    topics: (topics ?? []).map((topic) => ({
      ...topic,
      unread_count: counts.get((topic as { id: string }).id) ?? 0,
    })),
  };
}

async function opAddTopic(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const phrase = requireString(body.phrase, "phrase", 2);

  const { count, error: countError } = await supabase
    .from("topics_watched")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= MAX_TOPICS_PER_TENANT) {
    throw new HttpError(
      400,
      `Limit hasel to ${MAX_TOPICS_PER_TENANT}. Usun jedno, zanim dodasz kolejne.`,
    );
  }

  const { data, error } = await supabase
    .from("topics_watched")
    .insert({
      tenant_id: tenantId,
      phrase,
      query: optionalString(body.query),
      window_days: clampWindowDays(body.window_days),
      active: true,
    })
    .select("id, phrase, query, window_days, active, last_synced_at, last_sync_error, created_at")
    .single();

  // 23505: unikat (tenant_id, lower(phrase)). Komunikat po ludzku, nie kod bazy.
  if (error) {
    if (error.code === "23505") {
      throw new HttpError(400, `Haslo "${phrase}" jest juz obserwowane.`);
    }
    throw new Error(error.message);
  }

  await logAccess(supabase, tenantId, userId, "mentions.add_topic", phrase);

  // Pierwsze pobranie od razu, z szerszym oknem: nowe haslo bez ani jednej
  // wzmianki wyglada jak zepsute, a Google News i tak ma tylko biezace okno.
  const sync = await syncTenant(supabase, tenantId, { topicId: data.id });

  return { topic: { ...data, unread_count: 0 }, sync: sync[0] ?? null };
}

async function opUpdateTopic(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const id = requireUuid(body.topic_id, "topic_id");

  const patch: Record<string, unknown> = {};
  if (body.phrase !== undefined) patch.phrase = requireString(body.phrase, "phrase", 2);
  if (body.query !== undefined) patch.query = optionalString(body.query);
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.window_days !== undefined) patch.window_days = clampWindowDays(body.window_days);

  if (Object.keys(patch).length === 0) {
    throw new HttpError(400, "Brak pol do aktualizacji.");
  }

  const { data, error } = await supabase
    .from("topics_watched")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id, phrase, query, window_days, active, last_synced_at, last_sync_error, created_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new HttpError(400, "Takie haslo jest juz obserwowane.");
    }
    throw new Error(error.message);
  }
  if (!data) throw new HttpError(404, "Nie znaleziono hasla.");

  return { topic: data };
}

/** Usuniecie hasla kasuje tez jego wzmianki (ON DELETE CASCADE). */
async function opRemoveTopic(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const id = requireUuid(body.topic_id, "topic_id");

  const { data, error } = await supabase
    .from("topics_watched")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("phrase")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, "Nie znaleziono hasla.");

  await logAccess(supabase, tenantId, userId, "mentions.remove_topic", data.phrase);
  return { removed: true };
}

// ---------------------------------------------------------------------------
// Operacje: wzmianki
// ---------------------------------------------------------------------------

async function opSync(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<{ results: TopicSyncResult[]; inserted: number }> {
  const topicId = body.topic_id === undefined
    ? undefined
    : requireUuid(body.topic_id, "topic_id");

  const results = await syncTenant(supabase, tenantId, { topicId });
  const inserted = results.reduce((sum, item) => sum + item.inserted, 0);
  return { results, inserted };
}

async function opListMentions(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const limit = Math.min(
    typeof body.limit === "number" && body.limit > 0 ? Math.trunc(body.limit) : DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const offset = typeof body.offset === "number" && body.offset > 0
    ? Math.trunc(body.offset)
    : 0;

  let query = supabase
    .from("mentions")
    .select(MENTION_COLUMNS)
    .eq("tenant_id", tenantId)
    .is("dismissed_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (body.topic_id !== undefined) {
    query = query.eq("topic_id", requireUuid(body.topic_id, "topic_id"));
  }
  if (body.only_unread === true) {
    query = query.is("read_at", null);
  }
  if (typeof body.since === "string" && body.since.trim().length > 0) {
    query = query.gte("published_at", body.since);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return { mentions: data ?? [] };
}

async function opMarkRead(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const now = new Date().toISOString();

  // Bez `mention_id` oznaczamy caly ekran jako przeczytany. Tak dziala
  // "przeczytalem brief poranny", a nie klikanie w kazda pozycje z osobna.
  let query = supabase
    .from("mentions")
    .update({ read_at: now })
    .eq("tenant_id", tenantId)
    .is("read_at", null);

  if (body.mention_id !== undefined) {
    query = query.eq("id", requireUuid(body.mention_id, "mention_id"));
  }

  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);

  return { marked: data?.length ?? 0 };
}

/** Odrzucenie: wzmianka znika z list, ale zostaje w bazie jako juz widziana. */
async function opDismiss(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const id = requireUuid(body.mention_id, "mention_id");

  const { data, error } = await supabase
    .from("mentions")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, "Nie znaleziono wzmianki.");

  return { dismissed: true };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await authenticateRequest(req);
    const tenantId = await getTenantId(supabase, user.id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    switch (body?.operation) {
      case "list_topics":
        return jsonResponse({ ok: true, data: await opListTopics(supabase, tenantId) });
      case "add_topic":
        return jsonResponse({
          ok: true,
          data: await opAddTopic(supabase, tenantId, user.id, body),
        });
      case "update_topic":
        return jsonResponse({
          ok: true,
          data: await opUpdateTopic(supabase, tenantId, body),
        });
      case "remove_topic":
        return jsonResponse({
          ok: true,
          data: await opRemoveTopic(supabase, tenantId, user.id, body),
        });
      case "sync":
        return jsonResponse({ ok: true, data: await opSync(supabase, tenantId, body) });
      case "list_mentions":
        return jsonResponse({
          ok: true,
          data: await opListMentions(supabase, tenantId, body),
        });
      case "mark_read":
        return jsonResponse({ ok: true, data: await opMarkRead(supabase, tenantId, body) });
      case "dismiss":
        return jsonResponse({ ok: true, data: await opDismiss(supabase, tenantId, body) });
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
    console.error("argus-mentions error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { ok: false, error: `Wystapil blad. Sprobuj ponownie pozniej. (${detail})` },
      500,
    );
  }
});
