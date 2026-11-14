import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { jsonError, ApiError } from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { RUNNING_STATUSES, syncBuild } from "@/lib/builds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = env("CRON_SECRET");
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const direct = request.headers.get("x-cron-secret") ?? "";
  return bearer === secret || direct === secret;
}

export async function GET(request: Request) {
  try {
    if (!env("CRON_SECRET")) {
      throw new ApiError("CRON_SECRET is not configured on the server", 503, "cron_not_configured");
    }
    if (!authorized(request)) throw new ApiError("Unauthorized cron request", 401, "unauthorized");

    const admin = createAdminSupabase();
    const cutoff = new Date(Date.now() - 15_000).toISOString();
    const { data, error } = await admin
      .from("builds")
      .select("id")
      .in("status", [...RUNNING_STATUSES])
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(20);
    if (error) throw new ApiError("Could not load builds to poll", 500);

    const results: Array<{ id: string; ok: boolean; status?: string; error?: string }> = [];
    const ids = (data ?? []).map((row) => row.id as string);
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const settled = await Promise.allSettled(batch.map((id) => syncBuild(id)));
      settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push({ id: batch[index], ok: true, status: result.value.build.status });
        } else {
          results.push({
            id: batch[index],
            ok: false,
            error: result.reason instanceof Error ? result.reason.message : "sync failed",
          });
        }
      });
    }

    return NextResponse.json({ polled: ids.length, results, at: new Date().toISOString() });
  } catch (error) {
    return jsonError(error);
  }
}
