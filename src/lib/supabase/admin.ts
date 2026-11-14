import { createClient } from "@supabase/supabase-js";
import { env, requireEnv } from "@/lib/env";

/**
 * Server-only Supabase client. Uses the secret/service key and bypasses RLS.
 * Every call site MUST perform its own ownership checks before reading or
 * mutating another user's data.
 */
export function createAdminSupabase() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY") ?? env("SUPABASE_SECRET_KEY");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Server-side operations cannot run."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "web2app-studio-server" } },
  });
}

export function adminConfigured() {
  return Boolean(
    env("NEXT_PUBLIC_SUPABASE_URL") &&
      (env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY"))
  );
}
