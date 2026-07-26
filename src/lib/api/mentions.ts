/**
 * Klient Edge Function `argus-mentions` (wzmianki prasowe).
 * Wiążący kontrakt: docs/kontrakt-wzmianki.md.
 *
 * Konwencja: POST {SUPABASE_URL}/functions/v1/argus-mentions
 * z tokenem usera w Authorization i polem `operation` w body.
 * Odpowiedź: { ok: true, data } albo { ok: false, error }.
 *
 * Źródło danych to Bing News RSS (Google News zapasowo, bo odpowiada 503 na
 * ruch z centrów danych). Klient nigdy nie odpytuje go sam: pobranie,
 * deduplikacja i zapis dzieją się w Edge Function.
 */

import { edgeClient, LONG_TIMEOUT_MS } from '@/lib/api/client';

/** Hasło obserwowane przez tenanta. Polityk i asystent widzą te same hasła. */
export type WatchedTopic = {
  id: string;
  phrase: string;
  /**
   * Nadpisanie zapytania do wyszukiwarki, gdy samo hasło nie wystarcza.
   * Przykład: '"Waldemar Pieniak" OR "Pieniaka"'. Null = pytamy o `phrase`.
   */
  query: string | null;
  /** Ile dni wstecz obejmuje jedno pobranie (1-30). */
  window_days: number;
  active: boolean;
  last_synced_at: string | null;
  /** Ostatni błąd pobrania. Pokazujemy go wprost przy haśle. */
  last_sync_error: string | null;
  created_at: string;
  unread_count: number;
};

/** Pojedyncza wzmianka. `tone` zostaje null do czasu wdrożenia klasyfikacji. */
export type Mention = {
  id: string;
  topic_id: string;
  title: string;
  /** Link przekierowujący Google News. Otwieramy go w przeglądarce. */
  url: string;
  snippet: string | null;
  published_at: string | null;
  source_name: string | null;
  source_url: string | null;
  tone: 'przychylna' | 'krytyczna' | 'atak' | 'neutralna' | null;
  read_at: string | null;
  created_at: string;
};

/** Wynik pobrania dla jednego hasła. */
export type TopicSyncResult = {
  topic_id: string;
  phrase: string;
  fetched: number;
  inserted: number;
  error: string | null;
};

type MentionOperation =
  | 'add_topic'
  | 'dismiss'
  | 'list_mentions'
  | 'list_topics'
  | 'mark_read'
  | 'remove_topic'
  | 'sync'
  | 'update_topic';

/** Klient tej domeny: transport w @/lib/api/client. */
const call = edgeClient<MentionOperation>('argus-mentions');

export function listTopics() {
  return call<{ topics: WatchedTopic[] }>('list_topics');
}

/**
 * Dodanie hasła od razu pobiera pierwsze wzmianki, żeby lista nie była pusta.
 * Pobranie idzie do zewnętrznego RSS, więc dostaje dłuższy limit czasu.
 */
export function addTopic(params: { phrase: string; query?: string; window_days?: number }) {
  return call<{ topic: WatchedTopic; sync: TopicSyncResult | null }>(
    'add_topic',
    params,
    LONG_TIMEOUT_MS
  );
}

export function updateTopic(params: {
  topic_id: string;
  phrase?: string;
  query?: string | null;
  active?: boolean;
  window_days?: number;
}) {
  return call<{ topic: WatchedTopic }>('update_topic', params);
}

/** Usunięcie hasła kasuje też jego wzmianki. */
export function removeTopic(topicId: string) {
  return call<{ removed: true }>('remove_topic', { topic_id: topicId });
}

/**
 * Ręczne odświeżenie. Bez `topicId` odświeża wszystkie aktywne hasła, czyli
 * pobiera z RSS tyle razy, ile haseł. Stąd dłuższy limit czasu.
 */
export function syncMentions(topicId?: string) {
  return call<{ results: TopicSyncResult[]; inserted: number }>(
    'sync',
    topicId ? { topic_id: topicId } : {},
    LONG_TIMEOUT_MS,
  );
}

export function listMentions(
  params: {
    topic_id?: string;
    only_unread?: boolean;
    since?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  return call<{ mentions: Mention[] }>('list_mentions', params);
}

/** Bez `mentionId` oznacza wszystkie nieprzeczytane wzmianki tenanta. */
export function markMentionsRead(mentionId?: string) {
  return call<{ marked: number }>('mark_read', mentionId ? { mention_id: mentionId } : {});
}

/** Wzmianka znika z list, ale zostaje w bazie jako już widziana. */
export function dismissMention(mentionId: string) {
  return call<{ dismissed: true }>('dismiss', { mention_id: mentionId });
}
