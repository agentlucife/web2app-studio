import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiUser, ApiError } from "@/lib/api";
import { buildInputSchema, planLimits } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { assertPlatformWritable, getPlatformSettings } from "@/lib/platform";
import {
  countMonthlyBuilds,
  countRunningBuilds,
  createBuild,
  getProjectForUser,
} from "@/lib/builds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { admin, userId } = await requireApiUser();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);

    let query = admin
      .from("builds")
      .select("*, projects(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (projectId) query = query.eq("project_id", projectId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new ApiError("Could not load builds", 500);

    const builds = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      project_name:
        (row.projects as { name?: string } | null)?.name ?? "Deleted project",
      projects: undefined,
    }));
    return NextResponse.json({ builds });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { userId, profile } = await requireApiUser();
    await assertPlatformWritable(profile);
    const settings = await getPlatformSettings();
    if (settings.maintenanceMode && profile.role !== "admin") {
      throw new ApiError("The platform is in maintenance mode", 503, "maintenance_mode");
    }

    const limit = await rateLimit(`builds:create:${userId}`, 10, 60);
    if (!limit.allowed) {
      throw new ApiError("Too many build requests. Wait a minute and try again.", 429, "rate_limited");
    }

    const input = buildInputSchema.parse(await readJson(request));
    const project = await getProjectForUser(input.projectId, userId);

    const { admin } = await requireApiUser();
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    const plan = planLimits(subscription?.plan);

    const monthly = await countMonthlyBuilds(userId);
    if (monthly >= plan.buildsPerMonth) {
      throw new ApiError(
        `Your ${subscription?.plan ?? "free"} plan allows ${plan.buildsPerMonth} builds per month. Upgrade for more.`,
        402,
        "plan_limit"
      );
    }
    const running = await countRunningBuilds(userId);
    if (running >= 2) {
      throw new ApiError(
        "You already have two builds in progress. Wait for one to finish before starting another.",
        429,
        "build_concurrency"
      );
    }

    if (input.platform === "ios") {
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      const { count } = await admin
        .from("builds")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("platform", "ios")
        .gte("created_at", start.toISOString());
      if ((count ?? 0) >= plan.maxIos) {
        throw new ApiError(
          `Your plan allows ${plan.maxIos} iOS builds per month. Upgrade to continue.`,
          402,
          "plan_limit"
        );
      }
    }

    const build = await createBuild({
      userId,
      project,
      platform: input.platform,
      buildType: input.buildType,
    });
    return NextResponse.json({ build }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
