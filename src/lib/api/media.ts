/**
 * Klient Edge Function `argus-media`: globalna baza dziennikarzy, redakcji
 * i programów publicystycznych (tabele `journalists`, `outlets`, `programs`,
 * `program_episodes`; dane wyłącznie z publicznych stron redakcji).
 * Ekrany: Dane → Dziennikarze, Dane → Programy.
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

/** Program publicystyczny na liście (operation: list_programs). */
export type ProgramListItem = {
  id: string;
  source: string;
  slug: string;
  name: string;
  hosts: string[];
  outlet_name: string | null;
  archive_url: string;
  schedule_note: string | null;
  last_scraped_at: string | null;
  episodes_count: number;
  last_episode_at: string | null;
};

/** Program bez liczników (operation: get_program). */
export type ProgramDetails = Omit<ProgramListItem, 'episodes_count' | 'last_episode_at'>;

/** Odcinek: kto był gościem, o czym była rozmowa, kiedy. */
export type ProgramEpisode = {
  id: string;
  external_id: string;
  url: string;
  title: string;
  guests: string[];
  published_at: string | null;
  summary: string | null;
};

/** Odcinek z wyszukiwania po gościu: niesie też nazwę programu. */
export type GuestEpisode = ProgramEpisode & {
  program_name: string | null;
  program_slug: string | null;
};

type MediaOperation = 'list_journalists' | 'list_programs' | 'get_program' | 'episodes_by_guest';

const callMedia = edgeClient<MediaOperation>('argus-media');

/** Pełna lista dziennikarzy z bazy globalnej, pogrupowanie robi ekran. */
export async function listJournalists(): Promise<JournalistListItem[]> {
  const data = await callMedia<{ journalists: JournalistListItem[] }>('list_journalists');
  return data.journalists;
}

/** Programy, których archiwum Argus zaciąga. */
export async function listPrograms(): Promise<ProgramListItem[]> {
  const data = await callMedia<{ programs: ProgramListItem[] }>('list_programs');
  return data.programs;
}

/** Jeden program z ostatnimi odcinkami, najnowsze pierwsze. */
export async function getProgram(
  slug: string
): Promise<{ program: ProgramDetails; episodes: ProgramEpisode[] }> {
  return callMedia<{ program: ProgramDetails; episodes: ProgramEpisode[] }>('get_program', {
    slug,
  });
}

/** Odcinki, w których wystąpił dany gość, ze wszystkich programów. */
export async function episodesByGuest(guest: string): Promise<GuestEpisode[]> {
  const data = await callMedia<{ episodes: GuestEpisode[] }>('episodes_by_guest', { guest });
  return data.episodes;
}
