import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiUser, ApiError } from "@/lib/api";
import { repoLinkSchema } from "@/lib/schemas";
import { githubTokenForUser } from "@/lib/builds";
import { getRepoOrNull, listWorkflowRuns } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { userId } = await requireApiUser();
    const input = repoLinkSchema.parse(await readJson(request));
    const { token } = await githubTokenForUser(userId);
    const repo = await getRepoOrNull(token, input.repoFullName);
    if (!repo) {
      throw new ApiError(
        "Repository not found. Check the name and that the connected token can access it.",
        404,
        "repo_not_found"
      );
    }
    let actions = true;
    try {
      await listWorkflowRuns(token, repo.full_name, 1);
    } catch {
      actions = false;
    }
    return NextResponse.json({
      repo: {
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        htmlUrl: repo.html_url,
      },
      permissions: {
        push: Boolean(repo.permissions?.push),
        admin: Boolean(repo.permissions?.admin),
        actions,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
