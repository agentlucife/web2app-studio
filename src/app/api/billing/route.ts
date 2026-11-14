import { NextResponse } from "next/server";
import { jsonError, requireApiUser, ApiError } from "@/lib/api";
import { PLAN_LIMITS, planLimits } from "@/lib/schemas";
import { countMonthlyBuilds } from "@/lib/builds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { admin, userId } = await requireApiUser();
    const { data: subscription, error } = await admin
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ApiError("Could not load your subscription", 500);

    const planId = (subscription?.plan ?? "free") as keyof typeof PLAN_LIMITS;
    const limits = planLimits(planId);
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    const [{ count: projects }, monthlyBuilds, { count: iosBuilds }, { count: artifacts }] =
      await Promise.all([
        admin
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        countMonthlyBuilds(userId),
        admin
          .from("builds")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("platform", "ios")
          .gte("created_at", start.toISOString()),
        admin
          .from("artifacts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

    return NextResponse.json({
      plan: planId,
      status: subscription?.status ?? "active",
      currentPeriodEnd: subscription?.current_period_end ?? null,
      limits,
      usage: {
        projects: projects ?? 0,
        buildsThisMonth: monthlyBuilds,
        iosBuildsThisMonth: iosBuilds ?? 0,
        artifacts: artifacts ?? 0,
      },
      plans: PLAN_LIMITS,
    });
  } catch (error) {
    return jsonError(error);
  }
}
