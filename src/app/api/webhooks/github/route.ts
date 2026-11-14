import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifyGitHubSignature } from "@/lib/webhook";
import { syncBuild } from "@/lib/builds";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { jsonError, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type WorkflowRunPayload = {
  action?: string;
  repository?: { full_name?: string };
  workflow_run?: {
    id?: number;
    name?: string | null;
    display_title?: string | null;
    status?: string | null;
    conclusion?: string | null;
    html_url?: string | null;
    head_sha?: string | null;
  };
};

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limit = await rateLimit(`webhook:github:${ip}`, 120, 60);
    if (!limit.allowed) throw new ApiError("Too many webhook deliveries", 429);

    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) throw new ApiError("Missing webhook signature", 401, "missing_signature");
    if (!verifyGitHubSignature(rawBody, signature)) {
      throw new ApiError("Invalid webhook signature", 401, "invalid_signature");
    }

    const event = request.headers.get("x-github-event") ?? "";
    // Valid signature: always acknowledge with 2xx so GitHub does not retry
    // forever. Processing failures are logged below.
    if (event === "ping") return NextResponse.json({ ok: true, pong: true });
    if (event !== "workflow_run") return NextResponse.json({ ok: true, ignored: event });

    let payload: WorkflowRunPayload;
    try {
      payload = JSON.parse(rawBody) as WorkflowRunPayload;
    } catch {
      return NextResponse.json({ ok: true, ignored: "invalid_json" });
    }

    const run = payload.workflow_run;
    const repoFullName = payload.repository?.full_name;
    if (!run || !repoFullName) return NextResponse.json({ ok: true, ignored: "no_run" });

    const buildId = `${run.name ?? ""} ${run.display_title ?? ""}`.match(UUID_RE)?.[0];
    if (!buildId) return NextResponse.json({ ok: true, ignored: "no_build_id" });

    const admin = createAdminSupabase();
    const { data: build } = await admin
      .from("builds")
      .select("id, project_id")
      .eq("id", buildId)
      .maybeSingle();
    if (!build) return NextResponse.json({ ok: true, ignored: "unknown_build" });

    const { data: project } = await admin
      .from("projects")
      .select("repo_full_name")
      .eq("id", build.project_id)
      .maybeSingle();
    if (!project || project.repo_full_name?.toLowerCase() !== repoFullName.toLowerCase()) {
      return NextResponse.json({ ok: true, ignored: "repo_mismatch" });
    }

    try {
      await syncBuild(build.id);
    } catch (error) {
      console.error(
        "[github-webhook] sync failed",
        error instanceof Error ? error.message : "unknown error"
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
