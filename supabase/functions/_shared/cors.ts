// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allows all origins. Consider restricting this in production.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
