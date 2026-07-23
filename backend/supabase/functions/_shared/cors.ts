// Standard CORS headers for Edge Functions.
// Return these on the OPTIONS preflight and on every response.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
