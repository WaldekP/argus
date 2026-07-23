import {
  createClient,
  type SupabaseClient,
  type User,
} from "https://esm.sh/@supabase/supabase-js@2";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
}

// Validate the Bearer token from the Authorization header.
// Returns the authenticated user and a service-role client.
// Throws HttpError(401) when the token is missing or invalid.
export async function authenticateRequest(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new HttpError(401, "Missing Authorization bearer token");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, "Invalid or expired token");
  }

  return { user: data.user, supabase };
}

// Resolve the tenant for a user via the memberships table.
// Throws HttpError(403) when the user has no membership.
export async function getTenantId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.tenant_id) {
    throw new HttpError(403, "User has no tenant membership");
  }

  return data.tenant_id;
}
