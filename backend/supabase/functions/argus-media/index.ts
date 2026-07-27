// argus-media — globalna baza mediow i dziennikarzy (poczatek TASK 4).
// Operacje: list_journalists (ekran Dane -> Dziennikarze).
//
// Dane sa globalne i tylko do odczytu dla zalogowanych: zapisy robi wylacznie
// argus-ingest (operation journalist_refresh, adaptery w _shared/media/).
// Rekordy z takedown_requested nie wychodza poza baze (RODO, proces usuniecia).
import { authenticateRequest, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

async function opListJournalists(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("journalists")
    .select(
      "id, full_name, role, topics, bio, email, email_status, source_urls, " +
        "outlets ( name )",
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
