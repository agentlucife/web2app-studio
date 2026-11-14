import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";
import type { Profile } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "bad_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const field = first?.path?.join(".");
    return NextResponse.json(
      {
        error: field ? `${field}: ${first.message}` : first?.message ?? "Invalid input",
        code: "validation_error",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 422 }
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  // Do not leak stack traces or secrets to the client.
  console.error("[api]", message);
  const isConfig = /Missing required environment variable|not configured/i.test(message);
  return NextResponse.json(
    { error: isConfig ? message : "Something went wrong. Please try again.", code: isConfig ? "configuration_error" : "server_error" },
    { status: isConfig ? 503 : 500 }
  );
}

export type AuthContext = {
  userId: string;
  email: string | null;
  profile: Profile;
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  admin: ReturnType<typeof createAdminSupabase>;
};

export async function requireApiUser(): Promise<AuthContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("You need to sign in to do that", 401, "unauthorized");

  const admin = createAdminSupabase();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new ApiError("Could not load your profile", 500, "profile_error");
  if (!profile) throw new ApiError("Your profile is missing. Sign out and back in.", 403, "profile_missing");
  if (profile.suspended) {
    throw new ApiError("This account is suspended. Contact support.", 403, "account_suspended");
  }
  return { userId: user.id, email: user.email ?? null, profile: profile as Profile, supabase, admin };
}

export async function requireApiAdmin(): Promise<AuthContext> {
  const context = await requireApiUser();
  if (context.profile.role !== "admin") {
    throw new ApiError("Administrator access required", 403, "forbidden");
  }
  return context;
}

/**
 * CSRF defence for cookie-authenticated mutations. When a browser sends an
 * Origin header it must match this deployment (or a configured app URL).
 * Non-browser clients (curl, server-to-server) do not send Origin.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(appUrl()).origin);
  } catch {
    /* ignore malformed config */
  }
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    /* ignore */
  }
  const vercel = process.env.VERCEL_URL;
  if (vercel) allowed.add(`https://${vercel}`);
  if (!allowed.has(origin)) {
    throw new ApiError("Cross-origin request blocked", 403, "csrf_blocked");
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("Expected a JSON request body", 415, "unsupported_media_type");
  }
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("Request body is not valid JSON", 400, "invalid_json");
  }
}
