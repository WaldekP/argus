// Orkiestracja odswiezania danych o mediach.
// Dziennikarze per medium (Onet, WP Wiadomosci, RMF24, TVN24, Polsat News):
// crawl -> ensureOutlet -> persist.
// Archiwum programow publicystycznych (refreshProgram nizej): crawl strony
// programu -> ensureProgram -> persistEpisodes. Osobna sciezka, bo prowadzacy
// programu nie jest autorem artykulow i crawl stron autorskich go nie widzi.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crawlOnet } from "./onet.ts";
import { crawlWp } from "./wp.ts";
import { crawlRmf } from "./rmf24.ts";
import { crawlTvn24 } from "./tvn24.ts";
import { crawlPolsat } from "./polsatnews.ts";
import { crawlProgram, PROGRAM_SEEDS, type ProgramSeed } from "./programs.ts";
import {
  ensureOutlet,
  ensureProgram,
  knownEpisodeIds,
  persistEpisodes,
  persistJournalists,
  type OutletSeed,
} from "./persist.ts";

const ONET_SEED: OutletSeed = {
  name: "Onet Wiadomosci",
  type: "portal",
  domain: "redakcjaonet.pl",
  // Schemat potwierdzony na publicznym adresie autora (piotr-halicki ->
  // piotr.halicki@redakcjaonet.pl). Wzorzec renderowany ze sluga profilu.
  emailPattern: "{first}.{last}@redakcjaonet.pl",
  authorUrlPattern: "https://wiadomosci.onet.pl/autorzy/{slug}",
};

export async function refreshOnet(
  supabase: SupabaseClient,
  opts: { sections?: string[]; maxAuthors?: number } = {},
) {
  const outletId = await ensureOutlet(supabase, ONET_SEED);
  const scraped = await crawlOnet({
    sections: opts.sections,
    maxAuthors: opts.maxAuthors ?? 60,
  });
  const result = await persistJournalists(supabase, outletId, scraped);
  return { source: "onet", ...result };
}

const WP_SEED: OutletSeed = {
  name: "WP Wiadomosci",
  type: "portal",
  domain: "grupawp.pl",
  // Schemat potwierdzony na publicznych adresach autorow (michal.wroblewski@
  // grupawp.pl, paulina.ciesielska@grupawp.pl). Wzorzec renderowany ze sluga.
  emailPattern: "{first}.{last}@grupawp.pl",
  authorUrlPattern: "https://wiadomosci.wp.pl/autor/{slug}",
};

export async function refreshWp(
  supabase: SupabaseClient,
  opts: { sections?: string[]; maxAuthors?: number } = {},
) {
  const outletId = await ensureOutlet(supabase, WP_SEED);
  const scraped = await crawlWp({
    sections: opts.sections,
    maxAuthors: opts.maxAuthors ?? 60,
  });
  const result = await persistJournalists(supabase, outletId, scraped);
  return { source: "wp", ...result };
}

const RMF_SEED: OutletSeed = {
  name: "RMF24",
  type: "radio",
  domain: "rmf24.pl",
  // RMF nie publikuje osobistych adresow dziennikarzy, wiec wzorca nie ma
  // (zasada: pattern tylko po potwierdzeniu na opublikowanym adresie).
  emailPattern: "",
  authorUrlPattern: "https://www.rmf24.pl/autor/{slug}",
};

export async function refreshRmf(
  supabase: SupabaseClient,
  opts: { sections?: string[]; maxAuthors?: number } = {},
) {
  const outletId = await ensureOutlet(supabase, RMF_SEED);
  const scraped = await crawlRmf({
    sections: opts.sections,
    maxAuthors: opts.maxAuthors ?? 60,
  });
  const result = await persistJournalists(supabase, outletId, scraped);
  return { source: "rmf24", ...result };
}

const TVN24_SEED: OutletSeed = {
  name: "TVN24",
  type: "tv",
  domain: "tvn24.pl",
  // TVN24 nie publikuje osobistych adresow na profilach autorow, wiec wzorca
  // nie ma (zasada: pattern dopiero po potwierdzeniu na opublikowanym adresie).
  emailPattern: "",
  authorUrlPattern: "https://tvn24.pl/autorzy/{slug}",
};

export async function refreshTvn24(
  supabase: SupabaseClient,
  opts: { sections?: string[]; maxAuthors?: number } = {},
) {
  const outletId = await ensureOutlet(supabase, TVN24_SEED);
  const scraped = await crawlTvn24({
    sections: opts.sections,
    maxAuthors: opts.maxAuthors ?? 60,
  });
  const result = await persistJournalists(supabase, outletId, scraped);
  return { source: "tvn24", ...result };
}

const POLSAT_SEED: OutletSeed = {
  name: "Polsat News",
  type: "tv",
  domain: "polsatnews.pl",
  // Jak wyzej: brak opublikowanych adresow osobistych, wiec brak wzorca.
  emailPattern: "",
  authorUrlPattern: "https://www.polsatnews.pl/autor/{slug}/",
};

export async function refreshPolsat(
  supabase: SupabaseClient,
  opts: { sections?: string[]; maxAuthors?: number } = {},
) {
  const outletId = await ensureOutlet(supabase, POLSAT_SEED);
  const scraped = await crawlPolsat({
    sections: opts.sections,
    maxAuthors: opts.maxAuthors ?? 60,
  });
  const result = await persistJournalists(supabase, outletId, scraped);
  return { source: "polsatnews", ...result };
}

// ---------------------------------------------------------------------------
// Archiwum programow publicystycznych
// ---------------------------------------------------------------------------

/** Redakcja programu. Na razie wszystkie programy w adapterze sa z TVN24. */
const PROGRAM_OUTLET_SEEDS: Record<ProgramSeed["source"], OutletSeed> = {
  tvn24: TVN24_SEED,
};

export interface ProgramRefreshResult {
  slug: string;
  name: string;
  programId: string;
  upserted: number;
  failed: number;
}

/**
 * Odswiezenie archiwum jednego programu: strona programu -> odcinki -> baza.
 * Odcinki juz zapisane sa pomijane przed dociagnieciem ich stron, wiec kolejny
 * przebieg kosztuje tyle, ile przybylo nowych wejsc.
 */
export async function refreshProgram(
  supabase: SupabaseClient,
  seed: ProgramSeed,
  opts: { maxEpisodes?: number } = {},
): Promise<ProgramRefreshResult> {
  const outletId = await ensureOutlet(supabase, PROGRAM_OUTLET_SEEDS[seed.source]);
  const programId = await ensureProgram(supabase, seed, outletId);
  const known = await knownEpisodeIds(supabase, programId);
  const episodes = await crawlProgram(seed, {
    maxEpisodes: opts.maxEpisodes,
    knownIds: known,
  });
  const result = await persistEpisodes(supabase, programId, episodes);
  return {
    slug: seed.slug,
    name: seed.name,
    programId: result.programId,
    upserted: result.upserted,
    failed: result.failed,
  };
}

/** Wszystkie znane programy, jeden po drugim. Wolane z crona. */
export async function refreshAllPrograms(
  supabase: SupabaseClient,
  opts: { maxEpisodes?: number } = {},
): Promise<ProgramRefreshResult[]> {
  const results: ProgramRefreshResult[] = [];
  for (const seed of PROGRAM_SEEDS) {
    results.push(await refreshProgram(supabase, seed, opts));
  }
  return results;
}
