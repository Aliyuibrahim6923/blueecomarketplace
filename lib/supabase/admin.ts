import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Elevated Supabase client (bypasses RLS). Use ONLY for:
 *   - payment webhooks / callbacks (no user session exists), and
 *   - the notification outbox worker.
 * Every caller must authorise the request itself (signature, cron secret).
 */
export function createAdminClient() {
  const { supabaseSecretKey } = serverEnv();
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not configured; this server operation is unavailable.");
  }
  return createClient(publicEnv().supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
