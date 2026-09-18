// argus-media — globalna baza mediow, dziennikarzy i programow (TASK 4).
// Operacje:
//   - list_journalists (ekran Dane -> Dziennikarze),
//   - list_programs, get_program (ekran Dane -> Programy: archiwum odcinkow),
//   - episodes_by_guest (gdzie ten polityk ostatnio wystepowal).
//
// Dane sa globalne i tylko do odczytu dla zalogowanych: zapisy robi wylacznie
// argus-ingest (operacje journalist_refresh i program_refresh, adaptery
// w _shared/media/).
// Rekordy z takedown_requested nie wychodza poza baze (RODO, proces usuniecia).
import { authenticateRequest, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

async function opListJournalists(supabase: SupabaseClient) {
  // UWAGA: lista kolumn musi byc JEDNYM literalem. supabase-js parsuje ten
  // string na poziomie typow (template literal types); string sklejony plusem
  // traci typ literalny, parser poddaje sie i kazde pole wiersza konczy sie
  // bledem "Property ... does not exist on type 'GenericStringError'".
  const { data, error } = await supabase
    .from("journalists")
    .select(
      "id, full_name, role, topics, bio, email, email_status, source_urls, outlets ( name )",
    )
    .eq("takedown_requested", false)
    .order("full_name", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`journalists select: ${error.message}`);

  const journalists = (data ?? []).map((row) => {
    // Relacja outlets przychodzi jako obiekt (FK pojedynczy), ale typy
    // supabase-js widza tablice; obslugujemy obie postacie.
    const outlet = Array.isArray(row.outlets) ? row.outlets[0] : row.outlets;
    return {
      id: row.id,
      full_name: row.full_name,
      outlet_name: outlet?.name ?? null,
      role: row.role ?? null,
      topics: Array.isArray(row.topics) ? row.topics : [],
      bio: row.bio ?? null,
      email: row.email ?? null,
      email_status: row.email_status ?? "none",
      source_urls: Array.isArray(row.source_urls) ? row.source_urls : [],
    };
  });

  return { journalists };
}

/** Ile odcinkow oddajemy na ekran programu. Zrodlo i tak trzyma okolo 24. */
const EPISODES_LIMIT = 40;

interface EpisodeRow {
  id: string;
  external_id: string;
  url: string;
  title: string;
  guests: string[] | null;
  published_at: string | null;
  summary: string | null;
}

function toEpisode(row: EpisodeRow) {
  return {
    id: row.id,
    external_id: row.external_id,
    url: row.url,
    title: row.title,
    guests: Array.isArray(row.guests) ? row.guests : [],
    published_at: row.published_at,
    summary: row.summary,
  };
}

/** Lista programow z liczba odcinkow i data ostatniego wejscia. */
async function opListPrograms(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("programs")
    .select(
      "id, source, slug, name, hosts, archive_url, schedule_note, last_scraped_at, outlets ( name )",
    )
    .order("name", { ascending: true })
    .limit(100);
  if (error) throw new Error(`programs select: ${error.message}`);

  const programs = [];
  for (const row of data ?? []) {
    // Liczba odcinkow i data ostatniego osobnym zapytaniem, bo agregaty
    // w select supabase-js wymagaja widoku albo RPC, a programow sa jednostki.
    const { count } = await supabase
      .from("program_episodes")
      .select("id", { count: "exact", head: true })
      .eq("program_id", row.id);
    const { data: last } = await supabase
      .from("program_episodes")
      .select("published_at")
      .eq("program_id", row.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const outlet = Array.isArray(row.outlets) ? row.outlets[0] : row.outlets;
    programs.push({
      id: row.id,
      source: row.source,
      slug: row.slug,
      name: row.name,
      hosts: Array.isArray(row.hosts) ? row.hosts : [],
      outlet_name: outlet?.name ?? null,
      archive_url: row.archive_url,
      schedule_note: row.schedule_note ?? null,
      last_scraped_at: row.last_scraped_at ?? null,
      episodes_count: count ?? 0,
      last_episode_at: last?.published_at ?? null,
    });
  }
  return { programs };
}

/** Jeden program z ostatnimi odcinkami. */
async function opGetProgram(supabase: SupabaseClient, body: Record<string, unknown>) {
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (slug === "") {
    throw new HttpError(400, "Podaj slug programu.");
  }

  const { data: program, error } = await supabase
    .from("programs")
    .select(
      "id, source, slug, name, hosts, archive_url, schedule_note, last_scraped_at, outlets ( name )",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`program select: ${error.message}`);
  if (!program) {
    throw new HttpError(404, "Nie znamy tego programu.");
  }

  const { data: episodes, error: episodesError } = await supabase
    .from("program_episodes")
    .select("id, external_id, url, title, guests, published_at, summary")
    .eq("program_id", program.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(EPISODES_LIMIT);
  if (episodesError) throw new Error(`episodes select: ${episodesError.message}`);

  const outlet = Array.isArray(program.outlets) ? program.outlets[0] : program.outlets;
  return {
    program: {
      id: program.id,
      source: program.source,
      slug: program.slug,
      name: program.name,
      hosts: Array.isArray(program.hosts) ? program.hosts : [],
      outlet_name: outlet?.name ?? null,
      archive_url: program.archive_url,
      schedule_note: program.schedule_note ?? null,
      last_scraped_at: program.last_scraped_at ?? null,
    },
    episodes: ((episodes ?? []) as EpisodeRow[]).map(toEpisode),
  };
}

/**
 * Odcinki, w ktorych wystapil dany gosc, ze wszystkich programow.
 *
 * Dopasowanie po nazwisku, nie po calym wpisie: w bazie sa pelne imiona
 * i nazwiska, a pytajacy zwykle zna samo nazwisko. Filtr `ilike` na
 * rozwinietej tablicy robimy przez `cs` na pelnej wartosci tylko wtedy, gdy
 * podano pelne imie i nazwisko; w pozostalych wypadkach filtrujemy w kodzie,
 * bo odcinkow sa setki, nie miliony.
 */
async function opEpisodesByGuest(supabase: SupabaseClient, body: Record<string, unknown>) {
  const query = typeof body.guest === "string" ? body.guest.trim() : "";
  if (query.length < 3) {
    throw new HttpError(400, "Podaj nazwisko gościa (min 3 znaki).");
  }

  const { data, error } = await supabase
    .from("program_episodes")
    .select(
      "id, external_id, url, title, guests, published_at, summary, programs ( name, slug )",
    )
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(`episodes select: ${error.message}`);

  const needle = query.toLowerCase();
  const episodes = (data ?? [])
    .filter((row) => {
      const guests = Array.isArray(row.guests) ? (row.guests as string[]) : [];
      return guests.some((guest) => guest.toLowerCase().includes(needle));
    })
    .slice(0, EPISODES_LIMIT)
    .map((row) => {
      const program = Array.isArray(row.programs) ? row.programs[0] : row.programs;
      return {
        ...toEpisode(row as EpisodeRow),
        program_name: program?.name ?? null,
        program_slug: program?.slug ?? null,
      };
    });

  return { episodes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase } = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const operation = body?.operation;

    switch (operation) {
      case "list_journalists":
        return jsonResponse({ ok: true, data: await opListJournalists(supabase) });
      case "list_programs":
        return jsonResponse({ ok: true, data: await opListPrograms(supabase) });
      case "get_program":
        return jsonResponse({ ok: true, data: await opGetProgram(supabase, body) });
      case "episodes_by_guest":
        return jsonResponse({ ok: true, data: await opEpisodesByGuest(supabase, body) });
      default:
        return jsonResponse(
          { ok: false, error: `Nieznana operacja: ${operation}` },
          400,
        );
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ ok: false, error: err.message }, err.status);
    }
    return serverErrorResponse("argus-media", err);
  }
});
