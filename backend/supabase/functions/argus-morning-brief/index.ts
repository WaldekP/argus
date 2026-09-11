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
  generateTweetsForTenant,
} from "../_shared/daily-brief.ts";
import { today } from "../_shared/date.ts";

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

/**
 * Slad po kazdej probie generacji w access_logs.
 *
 * Powod: brief dnia trzyma w wierszu tylko OSTATNI zapis, wiec nieudana proba,
 * po ktorej poszla udana, nie zostawiala zadnego sladu. Przy zgloszeniu
 * "brief nie dziala" nie bylo czego szukac: ani kto kliknal, ani czy sie udalo,
 * ani ile to trwalo. Logi Edge Functions na tym projekcie nie odpowiadaja.
 *
 * `resource` trzyma wynik i czas, bo to dwie rzeczy, ktore realnie tlumacza
 * wrazenie uzytkownika: czy padlo i czy czekal minute, czy siedem.
 */
async function logGeneration(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null,
  action: string,
  status: "ready" | "error" | "ok",
  startedAt: number,
): Promise<void> {
  const sekundy = Math.round((Date.now() - startedAt) / 1000);
  try {
    await supabase.from("access_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      action,
      resource: `${status === "error" ? "blad" : "ok"} ${sekundy}s`,
    });
  } catch {
    // Audyt nie moze wywrocic generacji briefu.
  }
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
      const start = Date.now();
      // Tu logu przy wyjatku nie ma i to jest swiadome: cron leci bez usera,
      // a tenant znamy dopiero po odczycie profili. Gdy wywroci sie wczesniej,
      // nie ma czego przypisac do wiersza, wiec zostaje log funkcji i 5xx.
      const results = await generateForAllTenants(supabase, optionalDate(body.date));
      for (const r of results) {
        await logGeneration(supabase, r.tenant_id, null, "morning_brief_generate", r.status, start);
      }
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
      // UWAGA na kolejnosc: log MUSI byc w catch, nie tylko po wywolaniu.
      // Pierwsza wersja tej instrumentacji miala go dopiero za `await`, wiec
      // przy wyjatku (a wlasnie tak konczyly sie tweety przy pustym saldzie
      // Claude API) nie zapisywala niczego. Czyli mijala sie z celem: nie
      // logowala dokladnie tych przebiegow, dla ktorych powstala.
      case "generate": {
        const start = Date.now();
        try {
          const result = await generateForTenant(supabase, tenantId, today());
          await logGeneration(
            supabase,
            tenantId,
            user.id,
            "morning_brief_generate",
            result.status,
            start,
          );
          return jsonResponse({ ok: true, data: result });
        } catch (err) {
          await logGeneration(
            supabase,
            tenantId,
            user.id,
            "morning_brief_generate",
            "error",
            start,
          );
          throw err;
        }
      }
      case "tweets": {
        const start = Date.now();
        const date = optionalDate(body.date) ?? today();
        try {
          const result = await generateTweetsForTenant(supabase, tenantId, date);
          await logGeneration(supabase, tenantId, user.id, "morning_brief_tweets", "ok", start);
          return jsonResponse({ ok: true, data: result });
        } catch (err) {
          await logGeneration(supabase, tenantId, user.id, "morning_brief_tweets", "error", start);
          throw err;
        }
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
