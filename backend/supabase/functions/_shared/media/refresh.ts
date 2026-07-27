// Orkiestracja odswiezania bazy dziennikarzy per medium.
// Adaptery: Onet, WP Wiadomosci, RMF24; kolejne (tvn24, prasa) dojda tak samo:
// crawl -> ensureOutlet -> persist.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crawlOnet } from "./onet.ts";
import { crawlWp } from "./wp.ts";
import { crawlRmf } from "./rmf24.ts";
import { ensureOutlet, persistJournalists, type OutletSeed } from "./persist.ts";

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
