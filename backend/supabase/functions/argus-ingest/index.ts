// argus-ingest — ingest danych globalnych (cron / service only).
// Operacje: sejm_sync (nowe glosowania globalne od ostatniego znanego
// posiedzenia), registry_scan (zmiany w KRS dla obserwowanych podmiotow),
// mentions_sync (wzmianki z Google News dla hasel wszystkich tenantow).
// rss_sync i journalist_refresh dojda w pozniejszych taskach.
//
// Zabezpieczenie: wymaga naglowka `x-argus-cron: <CRON_SECRET>` ALBO tokena
// service_role w Authorization. Zwykly user dostaje 403.
// Konfiguracja pg_cron celowo poza zakresem tego taska.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/types.ts";
import { syncSejmVotings } from "../_shared/sejm.ts";
import { scanBulletin } from "../_shared/registry.ts";
import { MAX_TOPICS_PER_RUN, syncAllTenants } from "../_shared/mentions.ts";
import { refreshOnet } from "../_shared/media/refresh.ts";

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
      // Darmowe wykrywanie zmian w KRS: biuletyn dzienny otwartego API MS
      // porownany z lista obserwowanych podmiotow. Zero kosztu w Rejestr.io.
      // Domyslnie wczoraj, bo biuletyn za biezacy dzien jest niepelny.
      case "registry_scan": {
        const day =
          typeof body?.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day)
            ? body.day
            : new Date(Date.now() - 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10);
        const result = await scanBulletin(supabase, day);
        return jsonResponse({ ok: true, data: result });
      }
      // Wzmianki z Google News dla hasel wszystkich tenantow. Jeden przebieg
      // bierze najdawniej odswiezane hasla, wiec czestszy cron = swiezsze dane
      // przy tej samej porcji pracy na wywolanie.
      case "mentions_sync": {
        const limit = typeof body?.limit === "number" && body.limit > 0
          ? Math.min(Math.trunc(body.limit), MAX_TOPICS_PER_RUN)
          : MAX_TOPICS_PER_RUN;
        const results = await syncAllTenants(supabase, limit);
        return jsonResponse({
          ok: true,
          data: {
            topics: results.length,
            inserted: results.reduce((sum, item) => sum + item.inserted, 0),
            failed: results.filter((item) => item.error !== null).length,
            results,
          },
        });
      }
      // Odswiezenie bazy dziennikarzy ze stron autorow (na razie Onet).
      // Porcjowane przez maxAuthors, bo crawl chodzi po wielu stronach.
      case "journalist_refresh": {
        const maxAuthors =
          typeof body?.maxAuthors === "number" && body.maxAuthors > 0
            ? Math.min(Math.trunc(body.maxAuthors), 200)
            : 60;
        const sections = Array.isArray(body?.sections)
          ? body.sections.filter((s: unknown) => typeof s === "string")
          : undefined;
        const result = await refreshOnet(supabase, { sections, maxAuthors });
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
