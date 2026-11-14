import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiUser, ApiError } from "@/lib/api";
import { projectInputSchema, planLimits } from "@/lib/schemas";
import { assertSafePublicUrl, UnsafeUrlError } from "@/lib/ssrf";
import { assertPlatformWritable, getPlatformSettings } from "@/lib/platform";
import { rateLimit } from "@/lib/rate-limit";
import { githubTokenForUser, getProjectForUser } from "@/lib/builds";
import { getRepoOrNull } from "@/lib/github";

export const dynamic = "force-dynamic";

async function validateRepo(userId: string, repoFullName: string | undefined) {
  if (!repoFullName) return null;
  const { token } = await githubTokenForUser(userId);
  const repo = await getRepoOrNull(token, repoFullName);
  if (!repo) {
    throw new ApiError(
      `Repository ${repoFullName} was not found or your GitHub token cannot access it.`,
      400,
      "repo_not_found"
    );
  }
  if (repo.permissions && !repo.permissions.push) {
    throw new ApiError(
      "Your GitHub token has read-only access to this repository. Grant Contents: write.",
      403,
      "repo_no_write"
    );
  }
  return repo;
}

async function assertPackageAvailable(userId: string, packageId: string, excludeId?: string) {
  const { admin } = await requireApiUser();
  let query = admin
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("package_id", packageId);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.limit(1);
  if (data && data.length > 0) {
    throw new ApiError(
      "You already have a project with this package ID. Use a different application ID.",
      409,
      "package_id_taken"
    );
  }
}

export async function GET() {
  try {
    const { admin, userId } = await requireApiUser();
    const { data, error } = await admin
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new ApiError("Could not load projects", 500);
    return NextResponse.json({ projects: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId, profile } = await requireApiUser();
    const limit = await rateLimit(`projects:create:${userId}`, 30, 3600);
    if (!limit.allowed) throw new ApiError("Too many project changes. Try again later.", 429);
    await assertPlatformWritable(profile);
    const settings = await getPlatformSettings();
    if (settings.maintenanceMode && profile.role !== "admin") {
      throw new ApiError("The platform is in maintenance mode", 503, "maintenance_mode");
    }

    const input = projectInputSchema.parse(await readJson(request));
    try {
      await assertSafePublicUrl(input.config.websiteUrl);
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw new ApiError(error.message, 422, "unsafe_url");
      throw error;
    }

    const subscription = await admin
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    const plan = planLimits(subscription.data?.plan);
    const { count } = await admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= plan.projects) {
      throw new ApiError(
        `Your plan allows ${plan.projects} projects. Delete a project or upgrade to add more.`,
        402,
        "plan_limit"
      );
    }

    await assertPackageAvailable(userId, input.config.packageId);
    const repo = await validateRepo(userId, input.repoFullName);

    const { data: project, error } = await admin
      .from("projects")
      .insert({
        user_id: userId,
        name: input.name,
        description: input.description,
        website_url: input.config.websiteUrl,
        package_id: input.config.packageId,
        bundle_id: input.config.platforms.ios ? input.config.packageId : null,
        icon_url: input.config.assets.iconPath ?? null,
        splash_url: input.config.assets.splashPath ?? null,
        platforms: [
          ...(input.config.platforms.android ? ["android"] : []),
          ...(input.config.platforms.ios ? ["ios"] : []),
        ],
        repo_full_name: input.repoFullName ?? null,
        repo_private: repo ? repo.private : input.repoPrivate,
        config: input.config,
      })
      .select("*")
      .single();
    if (error || !project) {
      throw new ApiError(error?.message ?? "Could not create the project", 500);
    }

    await admin.from("app_configurations").upsert(
      {
        project_id: project.id,
        user_id: userId,
        config: input.config,
        version: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    );

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId, profile } = await requireApiUser();
    const body = (await readJson(request)) as Record<string, unknown>;
    const projectId = typeof body.id === "string" ? body.id : null;
    if (!projectId) throw new ApiError("Project id is required", 400);
    await getProjectForUser(projectId, userId);
    await assertPlatformWritable(profile);

    const patch = projectInputSchema.partial().parse(body);
    if (!patch.config && !patch.name && patch.description === undefined && !patch.repoFullName) {
      throw new ApiError("Nothing to update", 422);
    }
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.description !== undefined) update.description = patch.description;

    if (patch.config) {
      try {
        await assertSafePublicUrl(patch.config.websiteUrl);
      } catch (error) {
        if (error instanceof UnsafeUrlError) throw new ApiError(error.message, 422, "unsafe_url");
        throw error;
      }
      await assertPackageAvailable(userId, patch.config.packageId, projectId);
      update.website_url = patch.config.websiteUrl;
      update.package_id = patch.config.packageId;
      update.bundle_id = patch.config.platforms.ios ? patch.config.packageId : null;
      update.icon_url = patch.config.assets.iconPath ?? null;
      update.splash_url = patch.config.assets.splashPath ?? null;
      update.platforms = [
        ...(patch.config.platforms.android ? ["android"] : []),
        ...(patch.config.platforms.ios ? ["ios"] : []),
      ];
      update.config = patch.config;
    }
    if (patch.repoFullName !== undefined) {
      const repo = await validateRepo(userId, patch.repoFullName);
      update.repo_full_name = patch.repoFullName || null;
      if (repo) {
        update.repo_private = repo.private;
        update.repo_branch = repo.default_branch;
      }
    }

    const { data: project, error } = await admin
      .from("projects")
      .update(update)
      .eq("id", projectId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error || !project) throw new ApiError("Could not update the project", 500);

    if (patch.config) {
      const { data: existing } = await admin
        .from("app_configurations")
        .select("version")
        .eq("project_id", projectId)
        .maybeSingle();
      await admin.from("app_configurations").upsert(
        {
          project_id: projectId,
          user_id: userId,
          config: patch.config,
          version: (existing?.version ?? 0) + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id" }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error);
  }
}
