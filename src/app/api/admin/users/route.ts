import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiAdmin, ApiError } from "@/lib/api";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "admin"]).optional(),
  suspended: z.boolean().optional(),
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
});

export async function GET(request: Request) {
  try {
    const { admin } = await requireApiAdmin();
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const perPage = 25;

    let query = admin
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);
    if (search) {
      const escaped = search.replace(/[%,()]/g, "");
      query = query.or(
        `email.ilike.%${escaped}%,full_name.ilike.%${escaped}%,github_username.ilike.%${escaped}%`
      );
    }

    const { data: profiles, error, count } = await query;
    if (error) throw new ApiError("Could not load users", 500);
    const ids = (profiles ?? []).map((profile) => profile.id);
    if (ids.length === 0) {
      return NextResponse.json({ users: [], total: count ?? 0, page, perPage });
    }

    const [subscriptions, projects, builds] = await Promise.all([
      admin.from("subscriptions").select("user_id, plan, status, current_period_end").in("user_id", ids),
      admin.from("projects").select("user_id").in("user_id", ids),
      admin.from("builds").select("user_id, status").in("user_id", ids),
    ]);

    const subscriptionMap = new Map(
      (subscriptions.data ?? []).map((row) => [row.user_id, row])
    );
    const projectCounts = new Map<string, number>();
    for (const row of projects.data ?? []) {
      projectCounts.set(row.user_id, (projectCounts.get(row.user_id) ?? 0) + 1);
    }
    const buildCounts = new Map<string, { total: number; running: number; failed: number }>();
    for (const row of builds.data ?? []) {
      const current = buildCounts.get(row.user_id) ?? { total: 0, running: 0, failed: 0 };
      current.total += 1;
      if (["queued", "preparing", "building", "uploading"].includes(row.status)) current.running += 1;
      if (row.status === "failed") current.failed += 1;
      buildCounts.set(row.user_id, current);
    }

    const users = (profiles ?? []).map((profile) => ({
      ...profile,
      subscription: subscriptionMap.get(profile.id) ?? { plan: "free", status: "active" },
      project_count: projectCounts.get(profile.id) ?? 0,
      build_count: buildCounts.get(profile.id)?.total ?? 0,
      running_builds: buildCounts.get(profile.id)?.running ?? 0,
      failed_builds: buildCounts.get(profile.id)?.failed ?? 0,
    }));

    return NextResponse.json({ users, total: count ?? 0, page, perPage });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId: actorId } = await requireApiAdmin();
    const limit = await rateLimit(`admin:users:${actorId}`, 60, 60);
    if (!limit.allowed) throw new ApiError("Too many admin changes", 429);

    const input = patchSchema.parse(await readJson(request));
    if (input.userId === actorId && (input.suspended === true || input.role === "user")) {
      throw new ApiError("You cannot suspend or demote your own admin account", 422, "self_lockout");
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.role !== undefined) update.role = input.role;
    if (input.suspended !== undefined) update.suspended = input.suspended;

    if (Object.keys(update).length > 1) {
      const { error } = await admin.from("profiles").update(update).eq("id", input.userId);
      if (error) throw new ApiError("Could not update the user", 500);
    }

    if (input.plan) {
      const { error } = await admin.from("subscriptions").upsert(
        {
          user_id: input.userId,
          plan: input.plan,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw new ApiError("Could not update the subscription", 500);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", input.userId)
      .maybeSingle();
    return NextResponse.json({ user: profile });
  } catch (error) {
    return jsonError(error);
  }
}
