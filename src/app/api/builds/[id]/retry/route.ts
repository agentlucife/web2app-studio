import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, requireApiUser, ApiError } from "@/lib/api";
import {
  countMonthlyBuilds,
  countRunningBuilds,
  createBuild,
  getBuildForUser,
  getProjectForUser,
  TERMINAL_STATUSES,
} from "@/lib/builds";
import { planLimits } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { assertPlatformWritable } from "@/lib/platform";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { admin, userId, profile } = await requireApiUser();
    await assertPlatformWritable(profile);
    const { id } = await params;
    const previous = await getBuildForUser(id, userId);
    if (!(TERMINAL_STATUSES as readonly string[]).includes(previous.status)) {
      throw new ApiError("This build is still running. Cancel it first.", 409, "build_running");
    }

    const limit = await rateLimit(`builds:retry:${userId}`, 10, 60);
    if (!limit.allowed) throw new ApiError("Too many requests. Try again shortly.", 429);

    const { data: subscription } = await admin
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    const plan = planLimits(subscription?.plan);
    if ((await countMonthlyBuilds(userId)) >= plan.buildsPerMonth) {
      throw new ApiError(
        "Monthly build limit reached. Upgrade your plan to retry this build.",
        402,
        "plan_limit"
      );
    }
    if ((await countRunningBuilds(userId)) >= 2) {
      throw new ApiError("Finish or cancel a running build first.", 429, "build_concurrency");
    }

    const project = await getProjectForUser(previous.project_id, userId);
    const build = await createBuild({
      userId,
      project,
      platform: previous.platform,
      buildType: previous.build_type,
    });
    return NextResponse.json({ build }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
