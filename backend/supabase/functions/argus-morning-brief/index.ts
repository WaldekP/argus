// argus-morning-brief — brief dnia (synteza przeglądu polityki pod strategię
// polityka tenanta). Warstwa syntezy nad surowymi wzmiankami.
// Operacje:
//   - generate: cron (x-argus-cron / service_role) dla wszystkich tenantów,
//     albo user (regeneracja dzisiejszego briefu swojego tenanta),
//   - get: brief na datę (domyślnie dziś) dla tenanta,
//   - list: lista briefów dnia do archiwum (zakładka Briefy).
//
// Źródło materiału: Bing News (ogólne zapytania) + Sejm. Model: Sonnet 5.
// Projekt: docs/superpowers/specs/2026-07-26-brief-dnia-synteza-design.md
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import {
  generateForAllTenants,
  generateForTenant,
  today,
} from "../_shared/daily-brief.ts";

const BRIEF_COLUMNS =
  "brief_date, status, lead, items, model, generated_at, error";
const LIST_LIMIT = 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Czy żądanie pochodzi od crona lub service_role (jak w argus-ingest). */
function isCronAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const cronHeader = req.headers.get("x-argus-cron") ?? "";
  if (cronSecret && cronHeader === cronSecret) return true;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  return Boolean(serviceKey) && token === serviceKey;
}

function optionalDate(value: unknown): string | undefined {
  return typeof value === "string" && DATE_RE.test(value) ? value : undefined;
}

async function opGet(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const briefDate = optionalDate(body.date) ?? today();
  const { data, error } = await supabase
    .from("daily_briefs")
    .select(BRIEF_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("brief_date", briefDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { brief: data ?? null, date: briefDate };
}

async function opList(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("daily_briefs")
    .select("brief_date, status, lead, generated_at")
    .eq("tenant_id", tenantId)
    .order("brief_date", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) throw new Error(error.message);
  return { briefs: data ?? [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Ścieżka cronowa: generacja dla wszystkich tenantów, bez usera.
  if (isCronAuthorized(req)) {
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      if (body?.operation !== "generate") {
        return jsonResponse(
          { ok: false, error: "Cron obsługuje tylko operację generate." },
          400,
        );
      }
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const results = await generateForAllTenants(
        supabase,
        optionalDate(body.date),
      );
      return jsonResponse({ ok: true, data: { tenants: results.length, results } });
    } catch (err) {
      return serverErrorResponse("argus-morning-brief", err);
    }
  }

  // Ścieżka userska: get / list / generate (tylko dziś, tylko swój tenant).
  try {
    const { user, supabase } = await authenticateRequest(req);
    const tenantId = await getTenantId(supabase, user.id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    switch (body?.operation) {
      case "get":
        return jsonResponse({ ok: true, data: await opGet(supabase, tenantId, body) });
      case "list":
        return jsonResponse({ ok: true, data: await opList(supabase, tenantId) });
      case "generate": {
        const result = await generateForTenant(supabase, tenantId, today());
        return jsonResponse({ ok: true, data: result });
      }
      default:
        return jsonResponse(
          { ok: false, error: `Nieznana operacja: ${body?.operation}` },
          400,
        );
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ ok: false, error: err.message }, err.status);
    }
    return serverErrorResponse("argus-morning-brief", err);
  }
});
