/**
 * Klient Edge Function `argus-media`: globalna baza dziennikarzy i redakcji
 * (tabele `journalists` + `outlets`, dane wyłącznie z publicznych stron
 * autorskich). Ekran: Dane → Dziennikarze.
 */

import { edgeClient } from '@/lib/api/client';

/** Status pewności adresu e-mail dziennikarza (enum `email_status` w bazie). */
export type EmailStatus = 'public' | 'pattern' | 'verified' | 'none';

/** Dziennikarz na liście (operation: list_journalists). */
export type JournalistListItem = {
  id: string;
  full_name: string;
  outlet_name: string | null;
  role: string | null;
  topics: string[];
  bio: string | null;
  email: string | null;
  email_status: EmailStatus;
  source_urls: string[];
};

type MediaOperation = 'list_journalists';

const callMedia = edgeClient<MediaOperation>('argus-media');

/** Pełna lista dziennikarzy z bazy globalnej, pogrupowanie robi ekran. */
export async function listJournalists(): Promise<JournalistListItem[]> {
  const data = await callMedia<{ journalists: JournalistListItem[] }>('list_journalists');
  return data.journalists;
}
