// argus-ingest — ingest danych globalnych (cron / service only).
// Operacje: sejm_sync (nowe glosowania globalne od ostatniego znanego
// posiedzenia). rss_sync i journalist_refresh dojda w pozniejszych taskach.
//
// Zabezpieczenie: wymaga naglowka `x-argus-cron: <CRON_SECRET>` ALBO tokena
// service_role w Authorization. Zwykly user dostaje 403.
// Konfiguracja pg_cron celowo poza zakresem tego taska.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/types.ts";
import { syncSejmVotings } from "../_shared/sejm.ts";

function isAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const cronHeader = req.headers.get("x-argus-cron") ?? "";
  if (cronSecret && cronHeader === cronSecret) return true;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  return Boolean(serviceKey) && token === serviceKey;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isAuthorized(req)) {
    return jsonResponse(
      { ok: false, error: "Operacja dostepna tylko dla crona lub service role" },
      403,
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const operation = body?.operation;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    switch (operation) {
      case "sejm_sync": {
        const result = await syncSejmVotings(supabase);
        return jsonResponse({ ok: true, data: result });
      }
      default:
        return jsonResponse(
          { ok: false, error: `Nieznana operacja: ${operation}` },
          400,
        );
    }
  } catch (err) {
    console.error("argus-ingest error:", err);
    return jsonResponse(
      { ok: false, error: "Blad ingestu danych. Sprobuj ponownie pozniej." },
      500,
    );
  }
});
