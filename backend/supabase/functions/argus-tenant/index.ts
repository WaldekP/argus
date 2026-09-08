// argus-tenant — sprawy na poziomie konta klienta (biura).
// Operacje: record_login (zapis logowania), login_stats (odczyt licznika).
//
// Eksport i twarde usuniecie danych tenanta (operation delete_all z CLAUDE.md)
// jeszcze tutaj nie mieszkaja; ta funkcja powstala pod telemetrie pilotazu.
//
// Logowania laduja w globalnej tabeli `access_logs` (action = "login"), a nie
// w nowej tabeli, bo access_logs jest dokladnie od tego: audyt dostepu do
// danych tenanta. Tabela nie ma polityk RLS dla `authenticated`, czyli klient
// nie zapisze ani nie odczyta jej sam. Dlatego oba kierunki ida przez te
// funkcje na service_role. Zadnej migracji to nie wymaga.
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOGIN_ACTION = "login";

// Platforma z klienta ("web" | "ios" | "android"). Trafia do kolumny
// `resource`, bo w kontekscie logowania to wlasnie zasob, z ktorego user
// wszedl, a osobna kolumna wymagalaby migracji dla jednego stringa.
const ALLOWED_PLATFORMS = ["web", "ios", "android"];

function normalizePlatform(value: unknown): string | null {
  return typeof value === "string" && ALLOWED_PLATFORMS.includes(value) ? value : null;
}

async function opRecordLogin(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  platform: unknown,
) {
  const { error } = await supabase.from("access_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    action: LOGIN_ACTION,
    resource: normalizePlatform(platform),
  });
  if (error) throw new Error(`access_logs insert: ${error.message}`);

  return { recorded: true };
}

interface LoginStatsUser {
  user_id: string;
  email: string | null;
  logins: number;
  last_login_at: string | null;
}

async function opLoginStats(supabase: SupabaseClient, tenantId: string) {
  // Liczymy dla calego tenanta, nie tylko dla siebie: polityk i asystent
  // dziela jedno biuro, a sens tej operacji to podglad, kto faktycznie wchodzi
  // do aplikacji w trakcie pilotazu.
  const { data: members, error: membersError } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenantId);
  if (membersError) throw new Error(`memberships select: ${membersError.message}`);

  const users: LoginStatsUser[] = [];

  for (const member of members ?? []) {
    const userId = member.user_id as string;

    // head: true nie sciaga wierszy, samo `count`. Przy tysiacu logowan
    // pobieranie ich wszystkich tylko po to, zeby policzyc dlugosc tablicy,
    // byloby marnotrawstwem.
    const { count, error: countError } = await supabase
      .from("access_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("action", LOGIN_ACTION);
    if (countError) throw new Error(`access_logs count: ${countError.message}`);

    const { data: lastRow, error: lastError } = await supabase
      .from("access_logs")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("action", LOGIN_ACTION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw new Error(`access_logs last: ${lastError.message}`);

    // Adres e-mail siedzi w schemacie auth, ktorego supabase-js nie wystawia
    // przez .from(); admin API jest tu jedyna droga.
    const { data: userData } = await supabase.auth.admin.getUserById(userId);

    users.push({
      user_id: userId,
      email: userData?.user?.email ?? null,
      logins: count ?? 0,
      last_login_at: lastRow?.created_at ?? null,
    });
  }

  users.sort((a, b) => b.logins - a.logins);

  return { users, total: users.reduce((sum, user) => sum + user.logins, 0) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await authenticateRequest(req);
    const tenantId = await getTenantId(supabase, user.id);
    const body = await req.json().catch(() => ({}));
    const operation = body?.operation;

    switch (operation) {
      case "record_login":
        return jsonResponse({
          ok: true,
          data: await opRecordLogin(supabase, user.id, tenantId, body?.platform),
        });
      case "login_stats":
        return jsonResponse({ ok: true, data: await opLoginStats(supabase, tenantId) });
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
    return serverErrorResponse("argus-tenant", err);
  }
});
