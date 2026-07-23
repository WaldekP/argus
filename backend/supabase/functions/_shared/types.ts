import { corsHeaders } from "./cors.ts";

// Shared response envelope for all Edge Functions.
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

// Build a JSON Response with CORS headers.
export function jsonResponse(body: ApiResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
