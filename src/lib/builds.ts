import JSZip from "jszip";
import crypto from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api";
import { decrypt } from "@/lib/encryption";
import { generateCapacitorProject } from "@/lib/generator";
import {
  GitHubApiError,
  cancelWorkflowRun,
  dispatchWorkflow,
  downloadArtifactZip,
  downloadRunLogs,
  findWorkflowRun,
  getRepoOrNull,
  getWorkflowRun,
  listRunArtifacts,
  pushFiles,
} from "@/lib/github";
import { appUrl } from "@/lib/env";
import { getPlatformSettings } from "@/lib/platform";
import { verifyBuildCallbackToken, createBuildCallbackToken } from "@/lib/webhook";
import { appConfigSchema, type AppConfig } from "@/lib/schemas";
import type { Build, Project } from "@/lib/types";
import {
  ARTIFACTS_BUCKET,
  sanitizeStorageFilename,
  uploadObject,
} from "@/lib/storage";
import { sleep } from "@/lib/utils";

export const ANDROID_WORKFLOW = "android.yml";
export const IOS_WORKFLOW = "ios.yml";
export const RUNNING_STATUSES = ["queued", "preparing", "building", "uploading"] as const;
export const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

export function workflowForPlatform(platform: "android" | "ios") {
  return platform === "android" ? ANDROID_WORKFLOW : IOS_WORKFLOW;
}

export function buildTypesForPlatform(platform: "android" | "ios") {
  return platform === "android"
    ? ["debug", "release-apk", "release-aab"]
    : ["ios-archive", "ios-ipa"];
}

export function parseProjectConfig(project: Project): AppConfig {
  const parsed = appConfigSchema.safeParse(project.config);
  if (!parsed.success) {
    throw new ApiError(
      "This project's configuration is invalid. Open the builder and save it again.",
      422,
      "invalid_project_config"
    );
  }
  return parsed.data;
}

export async function githubTokenForUser(userId: string) {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("github_connections")
    .select("encrypted_token, token_type, scopes")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new ApiError("Could not load your GitHub connection", 500);
  if (!data) {
    throw new ApiError(
      "Connect GitHub before building. Add a personal access token in Dashboard → GitHub.",
      400,
      "github_not_connected"
    );
  }
  try {
    const token = decrypt(data.encrypted_token);
    return { token, tokenType: data.token_type as "pat" | "oauth", scopes: data.scopes as string[] };
  } catch {
    throw new ApiError(
      "Stored GitHub credentials could not be decrypted. Reconnect GitHub.",
      400,
      "github_token_unreadable"
    );
  }
}

export async function getProjectForUser(projectId: string, userId: string) {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new ApiError("Could not load the project", 500);
  if (!data) throw new ApiError("Project not found", 404, "project_not_found");
  return data as Project;
}

export async function getBuildForUser(buildId: string, userId: string) {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("builds")
    .select("*")
    .eq("id", buildId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new ApiError("Could not load the build", 500);
  if (!data) throw new ApiError("Build not found", 404, "build_not_found");
  return data as Build;
}

export async function appendBuildLog(
  buildId: string,
  level: "info" | "warn" | "error" | "success",
  message: string
) {
  const admin = createAdminSupabase();
  const trimmed = message.slice(0, 8000);
  const { data: existing } = await admin
    .from("build_logs")
    .select("id")
    .eq("build_id", buildId)
    .eq("message", trimmed)
    .limit(1);
  if (existing && existing.length > 0) return;
  await admin.from("build_logs").insert({ build_id: buildId, level, message: trimmed });
}

async function addNotification(userId: string, title: string, body: string, buildId: string) {
  try {
    const settings = await getPlatformSettings();
    if (!settings.buildNotifications) return;
    const admin = createAdminSupabase();
    await admin.from("notifications").insert({
      user_id: userId,
      title,
      body,
      kind: "build",
      build_id: buildId,
    });
  } catch {
    /* notifications are best effort */
  }
}

export async function countMonthlyBuilds(userId: string) {
  const admin = createAdminSupabase();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("builds")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

export async function countRunningBuilds(userId: string) {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("builds")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", [...RUNNING_STATUSES]);
  return count ?? 0;
}

export function signingModeFor(platform: "android" | "ios", buildType: string) {
  if (platform === "android") return buildType === "debug" ? "debug-key" : "release-keystore-required";
  return buildType === "ios-ipa" ? "apple-signing-required" : "unsigned-or-signed-archive";
}

export async function createBuild(options: {
  userId: string;
  project: Project;
  platform: "android" | "ios";
  buildType: string;
}) {
  const { userId, project, platform, buildType } = options;
  if (!buildTypesForPlatform(platform).includes(buildType)) {
    throw new ApiError("Unsupported build type for this platform", 422, "invalid_build_type");
  }
  if (!project.repo_full_name) {
    throw new ApiError(
      "Connect a GitHub repository to this project before building.",
      400,
      "repo_not_connected"
    );
  }
  if (platform === "android" && !project.platforms.includes("android")) {
    throw new ApiError("Android is not enabled for this project", 422);
  }
  if (platform === "ios" && !project.platforms.includes("ios")) {
    throw new ApiError("iOS is not enabled for this project", 422);
  }
  if (!project.repo_private && buildType !== "debug") {
    // Public source is allowed, but warn in the UI rather than blocking.
  }

  const config = parseProjectConfig(project);
  if (!project.repo_private && config.features.pushNotifications) {
    throw new ApiError(
      "Push notification projects must use a private repository so signing/Firebase configuration is not exposed.",
      422,
      "public_repo_not_allowed"
    );
  }

  const { token } = await githubTokenForUser(userId);
  const repo = await getRepoOrNull(token, project.repo_full_name);
  if (!repo) {
    throw new ApiError(
      `GitHub repository ${project.repo_full_name} was not found or the connected token cannot access it.`,
      400,
      "repo_not_found"
    );
  }
  if (repo.permissions && !repo.permissions.push) {
    throw new ApiError(
      "The connected GitHub token has read-only access to this repository. Grant Contents: write (and Workflows: write for fine-grained tokens).",
      403,
      "repo_no_write"
    );
  }

  const admin = createAdminSupabase();
  const { data: inserted, error: insertError } = await admin
    .from("builds")
    .insert({
      project_id: project.id,
      user_id: userId,
      platform,
      build_type: buildType,
      status: "preparing",
      signing_mode: signingModeFor(platform, buildType),
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (insertError || !inserted) {
    throw new ApiError("Could not create the build record", 500, "build_insert_failed");
  }
  const build = inserted as Build;

  try {
    await appendBuildLog(build.id, "info", "Generating Capacitor project and pushing source to GitHub.");
    const generated = await generateCapacitorProject(config, {
      userId,
      buildId: build.id,
      commitMarker: build.id,
    });
    const push = await pushFiles(
      token,
      project.repo_full_name,
      generated.files,
      `Web2App Studio: build ${build.id.slice(0, 8)} (${platform}/${buildType})`
    );
    await admin
      .from("builds")
      .update({ commit_sha: push.commitSha, updated_at: new Date().toISOString() })
      .eq("id", build.id);

    const callbackToken = createBuildCallbackToken(build.id);
    const callbackUrl = `${appUrl()}/api/webhooks/build`;
    const dispatchedAt = new Date().toISOString();
    await dispatchWorkflow(token, project.repo_full_name, workflowForPlatform(platform), push.branch, {
      build_id: build.id,
      build_type: buildType,
      callback_url: callbackUrl,
      callback_token: callbackToken,
    });

    await appendBuildLog(build.id, "info", "GitHub Actions workflow dispatched. Waiting for a runner.");
    const run = await findWorkflowRun(
      token,
      project.repo_full_name,
      workflowForPlatform(platform),
      build.id,
      dispatchedAt
    );
    const patch: Record<string, unknown> = {
      status: "queued",
      updated_at: new Date().toISOString(),
    };
    if (run) {
      patch.workflow_run_id = run.id;
      patch.workflow_run_url = run.html_url;
      patch.workflow_name = `${platform} workflow`;
    }
    await admin.from("builds").update(patch).eq("id", build.id);
    return { ...build, ...patch } as Build;
  } catch (error) {
    const message =
      error instanceof GitHubApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Build preparation failed";
    const hint = /workflow/i.test(message)
      ? " The token needs the workflow scope (classic) or Workflows: write permission (fine-grained)."
      : "";
    await admin
      .from("builds")
      .update({
        status: "failed",
        error_message: (message + hint).slice(0, 2000),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", build.id);
    await appendBuildLog(build.id, "error", message + hint);
    throw new ApiError(message + hint, 502, "build_prepare_failed");
  }
}

type SyncOutcome = {
  build: Build;
  changed: boolean;
};

function mapRunStatus(runStatus: string | null, conclusion: string | null) {
  if (runStatus === "completed") {
    if (conclusion === "success") return "uploading" as const;
    if (conclusion === "cancelled") return "cancelled" as const;
    return "failed" as const;
  }
  if (runStatus === "in_progress") return "building" as const;
  if (runStatus === "queued" || runStatus === "requested" || runStatus === "waiting" || runStatus === "pending") {
    return "queued" as const;
  }
  return null;
}

async function runLogsTail(token: string, repo: string, runId: number) {
  const buffer = await downloadRunLogs(token, repo, runId);
  if (!buffer) return "";
  try {
    const zip = await JSZip.loadAsync(buffer);
    let text = "";
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const content = await entry.async("string");
      text += `\n--- ${entry.name} ---\n${content}`;
      if (text.length > 60_000) break;
    }
    return text.slice(-12_000);
  } catch {
    return "";
  }
}

export async function syncBuild(buildId: string): Promise<SyncOutcome> {
  const admin = createAdminSupabase();
  const { data: buildRow } = await admin.from("builds").select("*").eq("id", buildId).maybeSingle();
  if (!buildRow) throw new ApiError("Build not found", 404);
  let build = buildRow as Build;
  if ((TERMINAL_STATUSES as readonly string[]).includes(build.status)) {
    return { build, changed: false };
  }

  const { data: projectRow } = await admin
    .from("projects")
    .select("*")
    .eq("id", build.project_id)
    .maybeSingle();
  if (!projectRow) {
    await admin
      .from("builds")
      .update({
        status: "failed",
        error_message: "The project was deleted before the build finished.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", build.id);
    return { build: { ...build, status: "failed" }, changed: true };
  }
  const project = projectRow as Project;
  if (!project.repo_full_name) {
    await admin
      .from("builds")
      .update({
        status: "failed",
        error_message: "The project has no GitHub repository connected.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", build.id);
    return { build: { ...build, status: "failed" }, changed: true };
  }

  let token: string;
  try {
    token = (await githubTokenForUser(build.user_id)).token;
  } catch (error) {
    throw error;
  }

  let runId = build.workflow_run_id;
  let run = runId ? await getWorkflowRun(token, project.repo_full_name, runId) : null;

  if (!run) {
    const found = await findWorkflowRun(
      token,
      project.repo_full_name,
      workflowForPlatform(build.platform),
      build.id,
      build.created_at
    );
    if (!found) {
      const ageMinutes = (Date.now() - new Date(build.created_at).getTime()) / 60_000;
      if (ageMinutes > 30 && build.status !== "uploading") {
        const message =
          "No GitHub Actions run was found for this build. The workflow may have been disabled or the dispatch was rejected.";
        await admin
          .from("builds")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", build.id);
        await appendBuildLog(build.id, "error", message);
        return { build: { ...build, status: "failed" }, changed: true };
      }
      return { build, changed: false };
    }
    run = found;
    runId = found.id;
  }

  const nextStatus = mapRunStatus(run.status, run.conclusion);
  const patch: Record<string, unknown> = {
    workflow_run_id: run.id,
    workflow_run_url: run.html_url,
    updated_at: new Date().toISOString(),
  };
  if (run.head_sha) patch.commit_sha = run.head_sha;
  if (nextStatus && ["queued", "building"].includes(nextStatus)) {
    patch.status = nextStatus;
    if (nextStatus === "building" && !build.started_at) patch.started_at = new Date().toISOString();
  }
  if (nextStatus === "failed" || nextStatus === "cancelled") {
    patch.status = nextStatus;
    patch.completed_at = new Date().toISOString();
    patch.error_message =
      nextStatus === "cancelled"
        ? "The workflow was cancelled."
        : `GitHub Actions concluded with "${run.conclusion ?? "failure"}".`;
    await admin.from("builds").update(patch).eq("id", build.id);
    const tail = await runLogsTail(token, project.repo_full_name, run.id);
    await appendBuildLog(
      build.id,
      nextStatus === "cancelled" ? "warn" : "error",
      tail || String(patch.error_message ?? "Build failed")
    );
    await addNotification(
      build.user_id,
      nextStatus === "cancelled" ? "Build cancelled" : "Build failed",
      `${project.name} — ${build.platform} ${build.build_type}`,
      build.id
    );
    return { build: { ...build, ...patch } as Build, changed: true };
  }

  if (run.status === "completed" && run.conclusion === "success") {
    patch.status = "uploading";
    await admin.from("builds").update(patch).eq("id", build.id);
    build = { ...build, ...patch } as Build;
    await appendBuildLog(build.id, "info", "Workflow succeeded. Downloading and verifying artifacts.");

    const artifacts = (await listRunArtifacts(token, project.repo_full_name, run.id)).filter(
      (artifact) => !artifact.expired
    );
    if (artifacts.length === 0) {
      const completedAt = new Date(run.updated_at).getTime();
      if (Date.now() - completedAt < 5 * 60_000) {
        return { build, changed: true };
      }
      const message = "The workflow finished but no artifact was uploaded.";
      await admin
        .from("builds")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", build.id);
      await appendBuildLog(build.id, "error", message);
      return { build: { ...build, status: "failed" }, changed: true };
    }

    let uploaded = 0;
    let firstName: string | null = null;
    try {
    for (const artifact of artifacts) {
      const { data: existing } = await admin
        .from("artifacts")
        .select("id")
        .eq("build_id", build.id)
        .eq("name", artifact.name)
        .maybeSingle();
      if (existing) continue;
      const zipBuffer = await downloadArtifactZip(token, project.repo_full_name, artifact.id);
      const zip = await JSZip.loadAsync(zipBuffer);
      const allEntries = Object.keys(zip.files);
      await appendBuildLog(
        build.id,
        "info",
        `Artifact zip contains ${allEntries.length} entries: ${allEntries.slice(0, 10).join(", ")}${allEntries.length > 10 ? "..." : ""}`
      );
      const candidates = Object.values(zip.files).filter(
        (entry) =>
          !entry.dir &&
          /\.(apk|aab|ipa)$/i.test(entry.name)
      );
      const entries =
        candidates.length > 0
          ? candidates
          : Object.values(zip.files).filter(
              (entry) => !entry.dir && /\.(zip|xcarchive)$/i.test(entry.name)
            );

      if (entries.length === 0) {
        const isIos = build.platform === "ios";
        if (!isIos) {
          throw new Error(
            `The workflow artifact "${artifact.name}" does not contain an APK/AAB/IPA file. ` +
              `Entries found: ${allEntries.slice(0, 5).join(", ")}`
          );
        }
        await storeArtifact({
          build,
          userId: build.user_id,
          projectId: project.id,
          name: `${artifact.name}.zip`,
          content: zipBuffer,
          kind: "xcarchive",
          contentType: "application/zip",
        });
        uploaded += 1;
        firstName ??= `${artifact.name}.zip`;
        continue;
      }

      for (const entry of entries) {
        const content = await entry.async("nodebuffer");
        const ext = entry.name.split(".").pop()?.toLowerCase() ?? "zip";
        const kind = (
          ext === "apk" || ext === "aab" || ext === "ipa" || ext === "xcarchive" ? ext : "source"
        ) as "apk" | "aab" | "ipa" | "xcarchive" | "source";
        const name = sanitizeStorageFilename(entry.name.split("/").pop() || `artifact.${ext}`);
        await storeArtifact({
          build,
          userId: build.user_id,
          projectId: project.id,
          name,
          content,
          kind,
          contentType: kind === "apk" ? "application/vnd.android.package-archive" : "application/octet-stream",
        });
        uploaded += 1;
        firstName ??= name;
      }
    }

    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not download or store the build artifact";
      await admin
        .from("builds")
        .update({
          status: "failed",
          error_message: message.slice(0, 2000),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", build.id);
      await appendBuildLog(build.id, "error", `Artifact verification failed: ${message}`);
      return { build: { ...build, status: "failed" }, changed: true };
    }
    if (uploaded === 0) {
      const message =
        "No new artifact could be stored. It may already have been imported by an earlier sync.";
      await admin
        .from("builds")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          artifact_name: firstName,
        })
        .eq("id", build.id);
      await appendBuildLog(build.id, "warn", message);
      return { build: { ...build, status: "completed" }, changed: true };
    }

    await admin
      .from("builds")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        artifact_name: firstName,
        error_message: null,
      })
      .eq("id", build.id);
    await appendBuildLog(
      build.id,
      "success",
      `Build completed. ${uploaded} artifact${uploaded === 1 ? "" : "s"} stored in private object storage.`
    );
    await addNotification(
      build.user_id,
      "Build completed",
      `${project.name} — ${build.platform} ${build.build_type} is ready to download.`,
      build.id
    );
    return { build: { ...build, status: "completed" }, changed: true };
  }

  await admin.from("builds").update(patch).eq("id", build.id);
  return { build: { ...build, ...patch } as Build, changed: true };
}

async function storeArtifact(options: {
  build: Build;
  userId: string;
  projectId: string;
  name: string;
  content: Buffer;
  kind: "apk" | "aab" | "ipa" | "xcarchive" | "source";
  contentType: string;
}) {
  const admin = createAdminSupabase();
  const safeName = sanitizeStorageFilename(options.name);
  const storagePath = `${options.userId}/${options.build.id}/${safeName}`;
  await uploadObject(ARTIFACTS_BUCKET, storagePath, options.content, options.contentType);
  const checksum = crypto.createHash("sha256").update(options.content).digest("hex");
  const { error } = await admin.from("artifacts").insert({
    build_id: options.build.id,
    project_id: options.projectId,
    user_id: options.userId,
    name: safeName,
    storage_path: storagePath,
    size_bytes: options.content.length,
    content_type: options.contentType,
    kind: options.kind,
    checksum,
  });
  if (error && !/duplicate/i.test(error.message)) {
    throw new ApiError(`Could not record the artifact: ${error.message}`, 500);
  }
}

export async function applyBuildCallback(payload: {
  buildId: string;
  status: string;
  message?: string;
  workflowRunId?: number | null;
}) {
  const admin = createAdminSupabase();
  const { data } = await admin.from("builds").select("*").eq("id", payload.buildId).maybeSingle();
  if (!data) throw new ApiError("Build not found", 404);
  const build = data as Build;
  const allowed = ["building", "uploading", "failed", "cancelled"];
  if (!allowed.includes(payload.status)) {
    throw new ApiError("Unsupported callback status", 422);
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.workflowRunId) patch.workflow_run_id = payload.workflowRunId;
  if (payload.status === "building") patch.status = "building";
  if (payload.status === "uploading") patch.status = "uploading";
  if (payload.status === "failed") {
    patch.status = "failed";
    patch.error_message = (payload.message || "The build workflow failed.").slice(0, 2000);
    patch.completed_at = new Date().toISOString();
  }
  if (payload.status === "cancelled") {
    patch.status = "cancelled";
    patch.completed_at = new Date().toISOString();
  }
  await admin.from("builds").update(patch).eq("id", payload.buildId);
  if (payload.message) {
    await appendBuildLog(
      payload.buildId,
      payload.status === "failed" ? "error" : payload.status === "cancelled" ? "warn" : "info",
      payload.message
    );
  }
  // The server never trusts a workflow's success claim: it downloads and
  // verifies the artifact itself before marking a build completed.
  if (payload.status === "uploading") {
    try {
      await sleep(4000);
      return await syncBuild(payload.buildId);
    } catch {
      return { build: { ...build, ...patch } as Build, changed: true };
    }
  }
  return { build: { ...build, ...patch } as Build, changed: true };
}

export async function cancelBuild(buildId: string, userId: string) {
  const build = await getBuildForUser(buildId, userId);
  if ((TERMINAL_STATUSES as readonly string[]).includes(build.status)) {
    throw new ApiError("This build already finished", 409, "build_finished");
  }
  const admin = createAdminSupabase();
  if (build.workflow_run_id) {
    const project = await getProjectForUser(build.project_id, userId);
    if (project.repo_full_name) {
      const { token } = await githubTokenForUser(userId);
      try {
        await cancelWorkflowRun(token, project.repo_full_name, build.workflow_run_id);
      } catch {
        /* The run may have just finished; reflect that in the next sync. */
      }
    }
  }
  await admin
    .from("builds")
    .update({ status: "cancelled", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", build.id);
  await appendBuildLog(build.id, "warn", "Build cancelled by the user.");
  return { ...build, status: "cancelled" as const };
}

export function verifyCallbackToken(buildId: string, token: string | undefined | null) {
  return verifyBuildCallbackToken(buildId, token);
}
