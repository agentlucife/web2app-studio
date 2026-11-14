import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiUser, ApiError } from "@/lib/api";
import { createRepo, listRepos } from "@/lib/github";
import { githubTokenForUser } from "@/lib/builds";
import { repoNameSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { userId } = await requireApiUser();
    const url = new URL(request.url);
    const page = Math.max(1, Math.min(10, Number(url.searchParams.get("page") ?? "1") || 1));
    const { token } = await githubTokenForUser(userId);
    const repos = await listRepos(token, page);
    return NextResponse.json({ repos, page, hasMore: repos.length === 100 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { userId } = await requireApiUser();
    const limit = await rateLimit(`github:create-repo:${userId}`, 10, 3600);
    if (!limit.allowed) throw new ApiError("Too many repository creations. Try again later.", 429);
    const input = repoNameSchema.parse(await readJson(request));
    const { token } = await githubTokenForUser(userId);
    const repo = await createRepo(token, input.name, input.description, input.private);
    return NextResponse.json(
      {
        repo: {
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          defaultBranch: repo.default_branch,
          htmlUrl: repo.html_url,
          owner: repo.owner.login,
          canPush: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
