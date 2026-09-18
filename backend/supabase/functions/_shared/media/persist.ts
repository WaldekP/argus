// Zapis wynikow adaptera do bazy (tabele outlets / journalists /
// journalist_materials oraz programs / program_episodes).
// Logika parsowania zyje w adapterach (onet.ts, programs.ts...), tutaj tylko
// mapowanie na wiersze i upsert. Wolane z argus-ingest (service_role).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ScrapedJournalist } from "./types.ts";
import { archiveUrl, type ProgramSeed, type ScrapedEpisode } from "./programs.ts";

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
  failed: number;
}

// Zapis dziennikarzy po (outlet_id, outlet_author_slug) i ich materialow.
// UWAGA: nie uzywamy .upsert(onConflict), bo indeks unikalny na tych kolumnach
// jest CZESCIOWY (where outlet_author_slug is not null), a Postgres nie umie
// go dopasowac do ON CONFLICT bez predykatu — kazdy wiersz konczyl sie bledem
// polykanym przez `continue` i baza nie rosla. Robimy select -> update/insert.
export async function persistJournalists(
  supabase: SupabaseClient,
  outletId: string,
  scraped: ScrapedJournalist[],
): Promise<PersistResult> {
  let materials = 0;
  let upserted = 0;
  let failed = 0;

  for (const j of scraped) {
    const values = {
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
    };

    const { data: existing } = await supabase
      .from("journalists")
      .select("id")
      .eq("outlet_id", outletId)
      .eq("outlet_author_slug", j.outletAuthorSlug)
      .maybeSingle();

    let row: { id: string } | null = null;
    let error: { message: string } | null = null;
    if (existing?.id) {
      const res = await supabase
        .from("journalists")
        .update(values)
        .eq("id", existing.id)
        .select("id")
        .single();
      row = res.data;
      error = res.error;
    } else {
      const res = await supabase
        .from("journalists")
        .insert(values)
        .select("id")
        .single();
      row = res.data;
      error = res.error;
    }
    if (error || !row) {
      failed += 1;
      console.error(
        `persistJournalists: ${j.outletAuthorSlug}: ${error?.message ?? "brak wiersza"}`,
      );
      continue;
    }
    upserted += 1;

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

  return { outletId, upserted, materials, failed };
}

// ---------------------------------------------------------------------------
// Programy publicystyczne (archiwum odcinkow)
// ---------------------------------------------------------------------------

/** Znajduje program po (source, slug) albo go zaklada. Zwraca id. */
export async function ensureProgram(
  supabase: SupabaseClient,
  seed: ProgramSeed,
  outletId: string | null,
): Promise<string> {
  const values = {
    outlet_id: outletId,
    source: seed.source,
    slug: seed.slug,
    name: seed.name,
    hosts: seed.hosts,
    archive_url: archiveUrl(seed),
    schedule_note: seed.scheduleNote,
  };

  const { data: found } = await supabase
    .from("programs")
    .select("id")
    .eq("source", seed.source)
    .eq("slug", seed.slug)
    .maybeSingle();

  if (found?.id) {
    // Prowadzacy i pasmo siedza w adapterze, wiec zmiana w kodzie ma dojsc
    // do bazy przy najblizszym odswiezeniu, a nie czekac na recznego update'a.
    const { error } = await supabase.from("programs").update(values).eq("id", found.id);
    if (error) throw error;
    return found.id;
  }

  const { data, error } = await supabase
    .from("programs")
    .insert(values)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Identyfikatory odcinkow juz zapisanych: adapter nie dociaga ich po raz drugi. */
export async function knownEpisodeIds(
  supabase: SupabaseClient,
  programId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("program_episodes")
    .select("external_id")
    .eq("program_id", programId)
    .limit(500);
  return new Set((data ?? []).map((row) => row.external_id as string));
}

export interface EpisodesResult {
  programId: string;
  upserted: number;
  failed: number;
}

/**
 * Zapis odcinkow po (program_id, external_id).
 *
 * Tu wolno uzyc `.upsert(onConflict)`, w odroznieniu od persistJournalists:
 * tamten indeks unikalny jest CZESCIOWY (where outlet_author_slug is not null)
 * i Postgres nie umie go dopasowac do ON CONFLICT, a ten jest pelny.
 */
export async function persistEpisodes(
  supabase: SupabaseClient,
  programId: string,
  episodes: ScrapedEpisode[],
): Promise<EpisodesResult> {
  let upserted = 0;
  let failed = 0;

  for (const episode of episodes) {
    const { error } = await supabase
      .from("program_episodes")
      .upsert(
        {
          program_id: programId,
          external_id: episode.externalId,
          url: episode.url,
          title: episode.title,
          guests: episode.guests,
          published_at: episode.publishedAt,
          summary: episode.summary,
        },
        { onConflict: "program_id,external_id" },
      );
    if (error) {
      failed += 1;
      console.error(`persistEpisodes: ${episode.externalId}: ${error.message}`);
      continue;
    }
    upserted += 1;
  }

  await supabase
    .from("programs")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", programId);

  return { programId, upserted, failed };
}
