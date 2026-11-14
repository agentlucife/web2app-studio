/**
 * Centralised environment access.
 *
 * Values are read lazily so that `next build` can run without production
 * secrets. Routes that need a value call `requireEnv` and return a clear
 * configuration error instead of crashing the whole deployment.
 */

export function env(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Configure it in Vercel (or .env.local for development).`
    );
  }
  return value;
}

export function appUrl() {
  const configured = env("NEXT_PUBLIC_APP_URL") ?? env("APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  if (env("VERCEL_PROJECT_PRODUCTION_URL")) {
    return `https://${env("VERCEL_PROJECT_PRODUCTION_URL")}`;
  }
  if (env("VERCEL_URL")) return `https://${env("VERCEL_URL")}`;
  return "http://localhost:3000";
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export type ConfigStatus = {
  name: string;
  required: boolean;
  configured: boolean;
  hint: string;
};

export function configurationStatus(): ConfigStatus[] {
  const entries: Array<[string, boolean, string]> = [
    ["NEXT_PUBLIC_SUPABASE_URL", true, "Supabase project URL"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", true, "Supabase publishable/anon key (safe for the browser)"],
    ["SUPABASE_SERVICE_ROLE_KEY", true, "Server-only Supabase secret/service key"],
    ["ENCRYPTION_KEY", true, "32-byte hex key for GitHub token encryption"],
    ["GITHUB_WEBHOOK_SECRET", true, "HMAC secret for GitHub webhooks"],
    ["NEXT_PUBLIC_APP_URL", true, "Public base URL of this deployment"],
    ["GITHUB_CLIENT_ID", false, "GitHub OAuth app ID (also configure in Supabase Auth)"],
    ["GITHUB_CLIENT_SECRET", false, "GitHub OAuth app secret (also configure in Supabase Auth)"],
    ["CRON_SECRET", true, "Bearer secret for the build polling cron endpoint"],
    ["BUILD_CALLBACK_SECRET", false, "Optional dedicated HMAC key for build callbacks"],
    ["UPSTASH_REDIS_REST_URL", false, "Optional distributed rate limiting"],
    ["UPSTASH_REDIS_REST_TOKEN", false, "Optional distributed rate limiting"],
  ];
  return entries.map(([name, required, hint]) => ({
    name,
    required,
    configured: Boolean(env(name)),
    hint,
  }));
}
