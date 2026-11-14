import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, requireApiUser, ApiError, readJson } from "@/lib/api";
import { getProjectForUser, parseProjectConfig } from "@/lib/builds";
import { appConfigSchema, planLimits } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const context = await readJson<{ name?: string }>(request).catch(
      (): { name?: string } => ({})
    );
    const { admin, userId } = await requireApiUser();
    const { id } = await params;
    const source = await getProjectForUser(id, userId);
    const config = parseProjectConfig(source);

    const { data: subscription } = await admin
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    const plan = planLimits(subscription?.plan);
    const { count } = await admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= plan.projects) {
      throw new ApiError(
        `Your plan allows ${plan.projects} projects. Delete a project or upgrade to duplicate more.`,
        402,
        "plan_limit"
      );
    }

    let suffix = 2;
    let packageId = `${config.packageId}.copy`;
    // Ensure the generated package ID is valid and unique for this user.
    while (suffix < 100) {
      const { data: clash } = await admin
        .from("projects")
        .select("id")
        .eq("user_id", userId)
        .eq("package_id", packageId)
        .maybeSingle();
      if (!clash) break;
      packageId = `${config.packageId}.copy${suffix}`;
      suffix += 1;
    }
    const nextConfig = appConfigSchema.parse({
      ...config,
      packageId,
      assets: { ...config.assets },
    });
    const name = (context.name?.trim() || `${source.name} copy`).slice(0, 80);

    const { data: project, error } = await admin
      .from("projects")
      .insert({
        user_id: userId,
        name,
        description: source.description,
        website_url: nextConfig.websiteUrl,
        package_id: nextConfig.packageId,
        bundle_id: nextConfig.platforms.ios ? nextConfig.packageId : null,
        icon_url: nextConfig.assets.iconPath ?? null,
        splash_url: nextConfig.assets.splashPath ?? null,
        platforms: [
          ...(nextConfig.platforms.android ? ["android"] : []),
          ...(nextConfig.platforms.ios ? ["ios"] : []),
        ],
        repo_full_name: null,
        repo_private: true,
        config: nextConfig,
      })
      .select("*")
      .single();
    if (error || !project) throw new ApiError("Could not duplicate the project", 500);

    await admin.from("app_configurations").insert({
      project_id: project.id,
      user_id: userId,
      config: nextConfig,
      version: 1,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
