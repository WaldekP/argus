// Orkiestracja odswiezania bazy dziennikarzy per medium.
// Na razie jeden adapter (Onet); kolejne (tvn24, radio, prasa) dojda tak samo:
// crawl -> ensureOutlet -> persist.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crawlOnet } from "./onet.ts";
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
