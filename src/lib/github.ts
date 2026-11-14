const GITHUB_API = "https://api.github.com";

export class GitHubApiError extends Error {
  status: number;
  details?: string;
  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.details = details;
  }
}

export type GitHubUser = {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  html_url: string;
};

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  permissions?: { admin: boolean; maintain: boolean; push: boolean; pull: boolean };
  owner: { login: string; avatar_url: string };
  updated_at: string;
};

type FetchOptions = {
  method?: string;
  body?: unknown;
  accept?: string;
  allowNotFound?: boolean;
  raw?: boolean;
};

async function githubFetch<T>(
  token: string,
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: options.accept ?? "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "web2app-studio",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${GITHUB_API}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok) {
    if (options.allowNotFound && response.status === 404) {
      return null as T;
    }
    const text = await response.text().catch(() => "");
    let message = `GitHub API error (${response.status})`;
    let details = "";
    try {
      const parsed = JSON.parse(text) as { message?: string; documentation_url?: string };
      if (parsed.message) message = parsed.message;
      details = parsed.documentation_url ?? "";
    } catch {
      details = text.slice(0, 500);
    }
    if (response.status === 401) {
      throw new GitHubApiError(
        "GitHub rejected the token. It may be expired or revoked — reconnect GitHub.",
        401,
        details
      );
    }
    if (response.status === 403) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (remaining === "0") {
        throw new GitHubApiError(
          "GitHub API rate limit reached. Try again later or use a token with higher limits.",
          429,
          details
        );
      }
      throw new GitHubApiError(`GitHub denied the request: ${message}`, 403, details);
    }
    if (response.status === 404) {
      throw new GitHubApiError(
        "GitHub resource not found. Check that the token can access this repository.",
        404,
        details
      );
    }
    throw new GitHubApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  if (options.raw) return response as unknown as T;
  return (await response.json()) as T;
}

export async function getGitHubUser(
  token: string
): Promise<GitHubUser & { scopes: string[]; tokenKind: "classic" | "fine-grained" }> {
  const headersScopes: string[] = [];
  // Read scopes from a direct request because githubFetch consumes the body.
  const response = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "web2app-studio",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new GitHubApiError(
      response.status === 401
        ? "GitHub rejected the token. Check that it is valid and not expired."
        : "Could not authenticate with GitHub",
      response.status
    );
  }
  const scopesHeader = response.headers.get("x-oauth-scopes") ?? "";
  for (const scope of scopesHeader.split(",")) {
    const cleaned = scope.trim();
    if (cleaned) headersScopes.push(cleaned);
  }
  const user = (await response.json()) as GitHubUser;
  const tokenKind = headersScopes.length > 0 ? "classic" : "fine-grained";
  return { ...user, scopes: headersScopes, tokenKind };
}

export async function getRepo(token: string, fullName: string) {
  return githubFetch<GitHubRepo>(token, `/repos/${fullName}`);
}

export async function getRepoOrNull(token: string, fullName: string) {
  return githubFetch<GitHubRepo | null>(token, `/repos/${fullName}`, {
    allowNotFound: true,
  });
}

export async function listRepos(token: string, page = 1, perPage = 100) {
  const repos = await githubFetch<GitHubRepo[]>(
    token,
    `/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`
  );
  return repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    updatedAt: repo.updated_at,
    owner: repo.owner.login,
    canPush: repo.permissions?.push ?? false,
  }));
}

export async function createRepo(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean
) {
  return githubFetch<GitHubRepo>(token, "/user/repos", {
    method: "POST",
    body: {
      name,
      description,
      private: isPrivate,
      auto_init: true,
      has_issues: true,
      has_wiki: false,
      has_projects: false,
    },
  });
}

export async function checkRepoPermissions(token: string, fullName: string) {
  const repo = await getRepo(token, fullName);
  return {
    push: Boolean(repo.permissions?.push),
    admin: Boolean(repo.permissions?.admin),
    private: repo.private,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
  };
}

export type FileToPush = {
  path: string;
  content: Buffer | string;
};

async function createBlob(token: string, repo: string, file: FileToPush) {
  const content = Buffer.isBuffer(file.content)
    ? file.content.toString("base64")
    : Buffer.from(file.content, "utf8").toString("base64");
  const blob = await githubFetch<{ sha: string }>(token, `/repos/${repo}/git/blobs`, {
    method: "POST",
    body: { content, encoding: "base64" },
  });
  return blob.sha;
}

/**
 * Create one commit containing every generated file using the Git Data API.
 * This is atomic and avoids the per-file rate limits of the Contents API.
 */
export async function pushFiles(
  token: string,
  repoFullName: string,
  files: FileToPush[],
  message: string
): Promise<{ commitSha: string; branch: string; url: string }> {
  const repo = await getRepo(token, repoFullName);
  const branch = repo.default_branch || "main";

  const existingRef = await githubFetch<{ object: { sha: string } } | null>(
    token,
    `/repos/${repoFullName}/git/ref/heads/${branch}`,
    { allowNotFound: true }
  );

  const parentSha = existingRef?.object.sha;
  const baseTreeSha = parentSha
    ? (
        await githubFetch<{ tree: { sha: string } }>(
          token,
          `/repos/${repoFullName}/git/commits/${parentSha}`
        )
      ).tree.sha
    : null;

  if (files.length === 0) {
    throw new GitHubApiError("No files to push", 400);
  }

  const blobShas = new Map<string, string>();
  const concurrency = 4;
  const queue = [...files];
  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;
      const sha = await createBlob(token, repoFullName, file);
      blobShas.set(file.path, sha);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));

  const tree = files.map((file) => ({
    path: file.path,
    mode: "100644" as const,
    type: "blob" as const,
    sha: blobShas.get(file.path)!,
  }));

  const newTree = await githubFetch<{ sha: string }>(
    token,
    `/repos/${repoFullName}/git/trees`,
    {
      method: "POST",
      body: baseTreeSha ? { tree, base_tree: baseTreeSha } : { tree },
    }
  );

  const commit = await githubFetch<{ sha: string; html_url: string }>(
    token,
    `/repos/${repoFullName}/git/commits`,
    {
      method: "POST",
      body: {
        message,
        tree: newTree.sha,
        parents: parentSha ? [parentSha] : [],
      },
    }
  );

  if (existingRef) {
    await githubFetch(token, `/repos/${repoFullName}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: { sha: commit.sha, force: false },
    });
  } else {
    await githubFetch(token, `/repos/${repoFullName}/git/refs`, {
      method: "POST",
      body: { ref: `refs/heads/${branch}`, sha: commit.sha },
    });
  }

  return { commitSha: commit.sha, branch, url: commit.html_url };
}

export async function dispatchWorkflow(
  token: string,
  repo: string,
  workflowFile: string,
  ref: string,
  inputs: Record<string, string>
) {
  let lastError: unknown;
  // Workflows pushed in the same request can take a few seconds to register.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await githubFetch(token, `/repos/${repo}/actions/workflows/${workflowFile}/dispatches`, {
        method: "POST",
        body: { ref, inputs },
      });
      return;
    } catch (error) {
      lastError = error;
      const status = error instanceof GitHubApiError ? error.status : 0;
      if (status !== 404 && status !== 409 && status !== 422) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }
  throw lastError;
}

export type WorkflowRun = {
  id: number;
  status: string | null;
  conclusion: string | null;
  html_url: string;
  display_title: string;
  head_sha: string;
  created_at: string;
  updated_at: string;
  event: string;
  workflow_id: number;
};

export async function findWorkflowRun(
  token: string,
  repo: string,
  workflowFile: string,
  marker: string,
  sinceIso: string
) {
  const since = new Date(sinceIso).getTime() - 30_000;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const data = await githubFetch<{ workflow_runs: WorkflowRun[] }>(
      token,
      `/repos/${repo}/actions/workflows/${workflowFile}/runs?event=workflow_dispatch&per_page=20`
    );
    const match = data.workflow_runs.find((run) => {
      const created = new Date(run.created_at).getTime();
      return (
        created >= since &&
        (run.display_title?.includes(marker) || run.display_title?.includes("Web2App"))
      );
    });
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return null;
}

export async function getWorkflowRun(token: string, repo: string, runId: number) {
  return githubFetch<WorkflowRun>(token, `/repos/${repo}/actions/runs/${runId}`);
}

export async function listRunArtifacts(token: string, repo: string, runId: number) {
  const data = await githubFetch<{
    artifacts: Array<{
      id: number;
      name: string;
      size_in_bytes: number;
      expired: boolean;
      archive_download_url: string;
      created_at: string;
    }>;
  }>(token, `/repos/${repo}/actions/runs/${runId}/artifacts`);
  return data.artifacts;
}

export async function downloadArtifactZip(
  token: string,
  repo: string,
  artifactId: number
): Promise<Buffer> {
  const response = await fetch(
    `${GITHUB_API}/repos/${repo}/actions/artifacts/${artifactId}/zip`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "web2app-studio",
      },
      cache: "no-store",
      redirect: "follow",
    }
  );
  if (!response.ok) {
    throw new GitHubApiError(
      `Could not download the build artifact (${response.status})`,
      response.status
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function downloadRunLogs(
  token: string,
  repo: string,
  runId: number
): Promise<Buffer | null> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}/logs`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "web2app-studio",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function cancelWorkflowRun(token: string, repo: string, runId: number) {
  await githubFetch(token, `/repos/${repo}/actions/runs/${runId}/cancel`, {
    method: "POST",
  });
}

export async function listWorkflowRuns(token: string, repo: string, perPage = 20) {
  const data = await githubFetch<{ workflow_runs: WorkflowRun[] }>(
    token,
    `/repos/${repo}/actions/runs?per_page=${perPage}`
  );
  return data.workflow_runs;
}

export function missingClassicScopes(scopes: string[], needsPrivateRepo: boolean) {
  if (scopes.length === 0) return []; // fine-grained token
  const missing: string[] = [];
  if (needsPrivateRepo) {
    if (!scopes.includes("repo")) missing.push("repo");
    if (!scopes.includes("workflow")) missing.push("workflow");
  } else {
    if (!scopes.includes("repo") && !scopes.includes("public_repo")) missing.push("public_repo");
    if (!scopes.includes("workflow")) missing.push("workflow");
  }
  return missing;
}
