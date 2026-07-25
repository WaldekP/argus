// Zapis wynikow adaptera do bazy (tabele outlets / journalists / journalist_materials).
// Logika parsowania zyje w adapterach (onet.ts...), tutaj tylko mapowanie na
// wiersze i upsert. Wolane z argus-ingest (service_role).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ScrapedJournalist } from "./types.ts";

export interface OutletSeed {
  name: string;
  type: "tv" | "radio" | "portal" | "prasa" | "podcast";
  domain: string;
  emailPattern: string;
  authorUrlPattern: string;
}

// Znajduje outlet po domenie albo zaklada go, gdy go nie ma. Zwraca id.
export async function ensureOutlet(
  supabase: SupabaseClient,
  seed: OutletSeed,
): Promise<string> {
  const { data: found } = await supabase
    .from("outlets")
    .select("id")
    .eq("domain", seed.domain)
    .maybeSingle();
  if (found?.id) return found.id;

  const { data, error } = await supabase
    .from("outlets")
    .insert({
      name: seed.name,
      type: seed.type,
      domain: seed.domain,
      email_pattern: seed.emailPattern,
      author_url_pattern: seed.authorUrlPattern,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Tytul materialu z ostatniego segmentu sluga w URL (bez dociagania artykulu).
function titleFromUrl(url: string): string {
  const m = url.match(/\/([^\/]+)\/[a-z0-9]{5,8}$/);
  if (!m) return url;
  return m[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface PersistResult {
  outletId: string;
  upserted: number;
  materials: number;
}

// Upsert dziennikarzy po (outlet_id, outlet_author_slug) i ich materialow.
export async function persistJournalists(
  supabase: SupabaseClient,
  outletId: string,
  scraped: ScrapedJournalist[],
): Promise<PersistResult> {
  let materials = 0;

  for (const j of scraped) {
    const { data: row, error } = await supabase
      .from("journalists")
      .upsert(
        {
          outlet_id: outletId,
          outlet_author_slug: j.outletAuthorSlug,
          full_name: j.fullName,
          role: j.role,
          topics: j.topics,
          email: j.email,
          email_status: j.emailStatus,
          bio: j.bio,
          socials: j.socials,
          source_urls: j.sourceUrls,
          last_scraped_at: new Date().toISOString(),
        },
        { onConflict: "outlet_id,outlet_author_slug" },
      )
      .select("id")
      .single();
    if (error || !row) continue;

    // Materialy: wstawiamy tylko nowe URL-e (unikamy duplikatow po adresie).
    for (const url of j.articleUrls) {
      const { data: exists } = await supabase
        .from("journalist_materials")
        .select("id")
        .eq("journalist_id", row.id)
        .eq("url", url)
        .maybeSingle();
      if (exists?.id) continue;
      const { error: mErr } = await supabase.from("journalist_materials").insert({
        journalist_id: row.id,
        title: titleFromUrl(url),
        url,
      });
      if (!mErr) materials += 1;
    }
  }

  await supabase
    .from("outlets")
    .update({ last_crawled_at: new Date().toISOString() })
    .eq("id", outletId);

  return { outletId, upserted: scraped.length, materials };
}
