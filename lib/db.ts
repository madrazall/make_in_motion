import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./config";

/**
 * Server-side Supabase client using the service role key.
 *
 * This bypasses row-level security, so it must never be imported into a client
 * component. Everything that touches it lives in an API route or a server
 * component.
 *
 * The client is fetch-based, which is why this whole app can run on Cloudflare
 * Workers — there is no TCP connection to Postgres anywhere.
 */
let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
  return cached;
}
