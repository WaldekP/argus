/**
 * Klient Edge Function `argus-morning-brief` (brief dnia — synteza przeglądu
 * polityki pod strategię polityka tenanta).
 *
 * Konwencja: POST {SUPABASE_URL}/functions/v1/argus-morning-brief z tokenem
 * usera i polem `operation` w body. Materiał (Bing News + Sejm) zbiera i
 * syntezuje Edge Function; klient tylko czyta gotowy artefakt i prosi o
 * regenerację.
 *
 * Projekt: docs/superpowers/specs/2026-07-26-brief-dnia-synteza-design.md
 */

import { edgeClient, LONG_TIMEOUT_MS } from '@/lib/api/client';

/** Jedno źródło pod wydarzeniem. `url` pusty dla wydarzeń sejmowych. */
export type DailyBriefSource = {
  tytul: string;
  url: string;
  redakcja: string | null;
};

/** Jedno wydarzenie w przeglądzie dnia. */
export type DailyBriefItem = {
  kategoria: string;
  naglowek: string;
  streszczenie: string;
  /** Warstwa strategiczna: co to znaczy dla polityka. */
  znaczenie_dla_ciebie: string;
  zrodla: DailyBriefSource[];
  source_type: 'press' | 'sejm';
};

/** Brief na jedną dobę. */
export type DailyBrief = {
  brief_date: string;
  status: 'generating' | 'ready' | 'error';
  lead: string | null;
  items: DailyBriefItem[];
  model: string | null;
  generated_at: string | null;
  error: string | null;
};

/** Pozycja listy archiwum (zakładka Briefy). */
export type DailyBriefSummary = {
  brief_date: string;
  status: 'generating' | 'ready' | 'error';
  lead: string | null;
  generated_at: string | null;
};

/** Pomysł na wpis na X wygenerowany z briefu dnia. */
export type TweetIdea = {
  tekst: string;
  /** Etykieta wydarzenia z przeglądu, którego dotyczy wpis. */
  wydarzenie: string;
  /** Strategia wpisu w jednym zdaniu. */
  kat: string;
};

type BriefOperation = 'generate' | 'get' | 'list' | 'tweets';

const call = edgeClient<BriefOperation>('argus-morning-brief');

/** Brief na wskazaną datę (domyślnie dziś). `brief` null, gdy jeszcze go nie ma. */
export function getDailyBrief(date?: string): Promise<{ brief: DailyBrief | null; date: string }> {
  return call('get', date ? { date } : undefined);
}

/** Lista briefów dnia do archiwum, od najnowszego. */
export function listDailyBriefs(): Promise<{ briefs: DailyBriefSummary[] }> {
  return call('list');
}

/**
 * Wygeneruj (albo zregeneruj) dzisiejszy brief. Zbieranie prasy i synteza
 * Sonnet trwają, stąd długi timeout.
 */
export function generateDailyBrief(): Promise<{
  brief_date: string;
  status: 'ready' | 'error';
  items: number;
  error: string | null;
}> {
  return call('generate', undefined, LONG_TIMEOUT_MS);
}

/**
 * Pomysły na tweety (X) z dzisiejszego briefu dnia. Efemeryczne — nie są
 * zapisywane, generują się na żądanie. Synteza Sonnet, stąd długi timeout.
 */
export function generateBriefTweets(): Promise<{ tweets: TweetIdea[]; brief_date: string }> {
  return call('tweets', undefined, LONG_TIMEOUT_MS);
}
