import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, requireApiUser, ApiError } from "@/lib/api";
import {
  getProjectForUser,
  githubTokenForUser,
  parseProjectConfig,
} from "@/lib/builds";
import { generateCapacitorProject } from "@/lib/generator";
import { getRepoOrNull, pushFiles } from "@/lib/github";
import { assertSafePublicUrl, UnsafeUrlError } from "@/lib/ssrf";
import { rateLimit } from "@/lib/rate-limit";
import { assertPlatformWritable } from "@/lib/platform";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { userId, profile } = await requireApiUser();
    await assertPlatformWritable(profile);
    const { id } = await params;
    const project = await getProjectForUser(id, userId);
    if (!project.repo_full_name) {
      throw new ApiError("Connect a GitHub repository before syncing source.", 400, "repo_not_connected");
    }
    const limit = await rateLimit(`source:sync:${userId}`, 20, 3600);
    if (!limit.allowed) throw new ApiError("Too many sync requests. Try again shortly.", 429);

    const config = parseProjectConfig(project);
    try {
      await assertSafePublicUrl(config.websiteUrl);
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw new ApiError(error.message, 422, "unsafe_url");
      throw error;
    }

    const { token } = await githubTokenForUser(userId);
    const repo = await getRepoOrNull(token, project.repo_full_name);
    if (!repo) throw new ApiError("The linked GitHub repository is not accessible.", 400);
    const generated = await generateCapacitorProject(config, {
      userId,
      commitMarker: `sync-${Date.now()}`,
    });
    const push = await pushFiles(
      token,
      project.repo_full_name,
      generated.files,
      "Web2App Studio: sync project source"
    );
    const { admin } = await requireApiUser();
    await admin
      .from("projects")
      .update({
        repo_branch: push.branch,
        repo_private: repo.private,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    return NextResponse.json({
      success: true,
      commitSha: push.commitSha,
      branch: push.branch,
      commitUrl: push.url,
      files: generated.files.length,
    });
  } catch (error) {
    return jsonError(error);
  }
}
