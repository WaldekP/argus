// Synchronizacja wzmianek: Google News RSS -> tabela `mentions`.
//
// Modul dzielony przez dwie sciezki wejscia:
//   - `argus-mentions` (operation `sync`) — uzytkownik klika "Odswiez",
//   - `argus-ingest` (operation `mentions_sync`) — cron dla wszystkich tenantow.
//
// Kontrakt: docs/kontrakt-wzmianki.md
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { fetchBingNews } from "./bing-news.ts";
import { fetchGoogleNews } from "./google-news.ts";
import {
  describeFailures,
  fetchFromSources,
  type NewsSource,
} from "./news-sources.ts";

/**
 * Kolejnosc probowania zrodel. Bing pierwszy, bo jako jedyny odpowiada na
 * ruch z runtime'u Edge Functions; Google zapasowo, bo bywa szerszy dla
 * polskiej prasy i dziala przy uruchomieniu ze zwyklego lacza.
 */
const SOURCES: NewsSource[] = [
  { name: "bing_news", fetch: fetchBingNews },
  { name: "google_news", fetch: fetchGoogleNews },
];

/** Hasło obserwowane w formie, w jakiej potrzebuje go synchronizacja. */
export interface WatchedTopic {
  id: string;
  tenant_id: string;
  phrase: string;
  query: string | null;
  window_days: number;
}

export interface TopicSyncResult {
  topic_id: string;
  phrase: string;
  /** Zrodlo, ktore odpowiedzialo. Null, gdy zadne. */
  source: string | null;
  /** Ile pozycji zwrocil feed. */
  fetched: number;
  /** Ile bylo nowych, czyli ile realnie doszlo do bazy. */
  inserted: number;
  error: string | null;
}

/**
 * Ile hasel obsluguje jedno wywolanie. Worker Edge Functions ma limit czasu
 * i pamieci, a kazde haslo to osobny request HTTP do Google. Reszta hasel
 * zlapie sie w kolejnym przebiegu crona.
 */
export const MAX_TOPICS_PER_RUN = 20;

/** Zapytanie do wyszukiwarki: wlasne, jesli ustawione, inaczej samo haslo. */
export function resolveQuery(topic: WatchedTopic): string {
  const custom = topic.query?.trim();
  return custom && custom.length > 0 ? custom : topic.phrase;
}

/** Jedno hasło: pobranie feedu, zapis nowych pozycji, zapis stanu synchronizacji. */
export async function syncTopic(
  supabase: SupabaseClient,
  topic: WatchedTopic,
): Promise<TopicSyncResult> {
  const base: TopicSyncResult = {
    topic_id: topic.id,
    phrase: topic.phrase,
    source: null,
    fetched: 0,
    inserted: 0,
    error: null,
  };

  try {
    const outcome = await fetchFromSources(
      SOURCES,
      resolveQuery(topic),
      topic.window_days,
    );

    // Zadne zrodlo nie odpowiedzialo. Komunikat wymienia wszystkie proby,
    // bo "nie udalo sie pobrac" bez podania kto i czym odmowil jest bezuzyteczne.
    if (!outcome.source) {
      throw new Error(describeFailures(outcome.failures));
    }

    const items = outcome.items;
    base.source = outcome.source;
    base.fetched = items.length;

    if (items.length > 0) {
      const rows = items.map((item) => ({
        tenant_id: topic.tenant_id,
        topic_id: topic.id,
        source: outcome.source,
        external_id: item.externalId,
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        published_at: item.publishedAt,
        source_name: item.sourceName,
        source_url: item.sourceUrl,
      }));

      // ignoreDuplicates: ON CONFLICT DO NOTHING. Dzieki temu `select()`
      // zwraca wylacznie wiersze faktycznie dopisane, czyli nowe wzmianki.
      const { data, error } = await supabase
        .from("mentions")
        .upsert(rows, { onConflict: "topic_id,external_id", ignoreDuplicates: true })
        .select("id");

      if (error) throw new Error(error.message);
      base.inserted = data?.length ?? 0;
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
  }

  await supabase
    .from("topics_watched")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: base.error,
    })
    .eq("id", topic.id);

  return base;
}

/**
 * Wszystkie aktywne hasla tenanta (albo jedno wskazane).
 * Sekwencyjnie, nie rownolegle: kilkanascie jednoczesnych requestow do Google
 * z jednego adresu to prosta droga do odciecia.
 */
export async function syncTenant(
  supabase: SupabaseClient,
  tenantId: string,
  options: { topicId?: string } = {},
): Promise<TopicSyncResult[]> {
  let query = supabase
    .from("topics_watched")
    .select("id, tenant_id, phrase, query, window_days")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(MAX_TOPICS_PER_RUN);

  if (options.topicId) {
    query = query.eq("id", options.topicId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const results: TopicSyncResult[] = [];
  for (const topic of (data ?? []) as WatchedTopic[]) {
    results.push(await syncTopic(supabase, topic));
  }
  return results;
}

/**
 * Przebieg cronowy: najdawniej odswiezane hasla wszystkich tenantow.
 * Sortowanie po `last_synced_at` z NULL-ami na poczatku sprawia, ze nowo
 * dodane hasla lapia sie w najblizszym przebiegu.
 */
export async function syncAllTenants(
  supabase: SupabaseClient,
  limit = MAX_TOPICS_PER_RUN,
): Promise<TopicSyncResult[]> {
  const { data, error } = await supabase
    .from("topics_watched")
    .select("id, tenant_id, phrase, query, window_days")
    .eq("active", true)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: TopicSyncResult[] = [];
  for (const topic of (data ?? []) as WatchedTopic[]) {
    results.push(await syncTopic(supabase, topic));
  }
  return results;
}
