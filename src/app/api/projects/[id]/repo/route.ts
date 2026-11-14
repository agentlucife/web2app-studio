import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, requireApiUser, ApiError, readJson } from "@/lib/api";
import { getProjectForUser, githubTokenForUser } from "@/lib/builds";
import { repoLinkSchema } from "@/lib/schemas";
import { getRepoOrNull } from "@/lib/github";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const { id } = await params;
    const project = await getProjectForUser(id, userId);
    const body = repoLinkSchema.parse(await readJson(request));
    const { token } = await githubTokenForUser(userId);
    const repo = await getRepoOrNull(token, body.repoFullName);
    if (!repo) {
      throw new ApiError("Repository not found or the GitHub token cannot access it.", 400);
    }
    if (repo.permissions && !repo.permissions.push) {
      throw new ApiError(
        "Your GitHub token has read-only access to this repository. Grant Contents: write.",
        403,
        "repo_no_write"
      );
    }
    const { data: updated, error } = await admin
      .from("projects")
      .update({
        repo_full_name: repo.full_name,
        repo_branch: repo.default_branch,
        repo_private: repo.private,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error || !updated) throw new ApiError("Could not link the repository", 500);
    return NextResponse.json({ project: updated });
  } catch (error) {
    return jsonError(error);
  }
}
