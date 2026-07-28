// argus-knowledge — globalna baza badan opinii publicznej (knowledge_docs,
// zrodlo CBOS + ...). Operacje:
//   - list_knowledge_docs: lista pod ekran Dane -> Badania opinii (pola
//     odchudzone, bez pelnego tekstu; opcjonalny filtr po topic_slug),
//   - get_knowledge_doc: pelny rekord z badaniami pod ekran szczegolu.
//
// Dane sa globalne i tylko do odczytu dla zalogowanych: zapisy robi wylacznie
// argus-ingest (operation load_knowledge, zrodlo tools/cbos-crawler).
import { authenticateRequest, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Structured {
  badania?: unknown[];
}

/** Ile pytan niesie rekord (do meta na liscie). */
function questionCount(structured: unknown): number {
  const s = structured as Structured | null;
  return Array.isArray(s?.badania) ? s.badania.length : 0;
}

async function opListKnowledgeDocs(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
) {
  const topicSlug = typeof body.topic_slug === "string" && body.topic_slug
    ? body.topic_slug
    : null;

  // UWAGA: lista kolumn musi byc JEDNYM literalem (typy supabase-js parsuja
  // template literal); string sklejony plusem traci typ i psuje wiersz.
  let query = supabase
    .from("knowledge_docs")
    .select("id, source, external_id, title, pub_date, topic_slugs, structured")
    .order("pub_date", { ascending: false, nullsFirst: false })
    .limit(500);
  if (topicSlug) {
    query = query.contains("topic_slugs", [topicSlug]);
  }
  const { data, error } = await query;
  if (error) throw new Error(`knowledge_docs select: ${error.message}`);

  const docs = (data ?? []).map((row) => ({
    id: row.id,
    source: row.source,
    external_id: row.external_id,
    title: row.title,
    pub_date: row.pub_date ?? null,
    topic_slugs: Array.isArray(row.topic_slugs) ? row.topic_slugs : [],
    question_count: questionCount(row.structured),
  }));

  return { docs };
}

async function opGetKnowledgeDoc(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
) {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) throw new HttpError(400, "Podaj id badania");

  const { data, error } = await supabase
    .from("knowledge_docs")
    .select(
      "id, source, external_id, title, report_url, pdf_url, pub_date, author, year, topic_tags, topic_slugs, summary, structured",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`knowledge_docs get: ${error.message}`);
  if (!data) throw new HttpError(404, "Nie ma takiego badania");

  return { doc: data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase } = await authenticateRequest(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const operation = body?.operation;

    switch (operation) {
      case "list_knowledge_docs":
        return jsonResponse({ ok: true, data: await opListKnowledgeDocs(supabase, body) });
      case "get_knowledge_doc":
        return jsonResponse({ ok: true, data: await opGetKnowledgeDoc(supabase, body) });
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
    return serverErrorResponse("argus-knowledge", err);
  }
});
