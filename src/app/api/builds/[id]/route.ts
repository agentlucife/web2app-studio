import { NextResponse } from "next/server";
import { jsonError, requireApiUser, ApiError } from "@/lib/api";
import { getBuildForUser, syncBuild, TERMINAL_STATUSES } from "@/lib/builds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// A per-instance cooldown avoids hammering the GitHub API when the build
// detail page polls every few seconds. Serverless instances may have their
// own map; the worst case is a duplicate read-only GitHub call.
const lastSync = new Map<string, number>();

export async function GET(_request: Request, { params }: Params) {
  try {
    const { admin, userId } = await requireApiUser();
    const { id } = await params;
    let build = await getBuildForUser(id, userId);

    if (!(TERMINAL_STATUSES as readonly string[]).includes(build.status)) {
      const last = lastSync.get(build.id) ?? 0;
      if (Date.now() - last > 7000) {
        lastSync.set(build.id, Date.now());
        try {
          build = (await syncBuild(build.id)).build;
        } catch {
          // Keep returning the last known state; polling will retry.
        }
      }
    }

    const [{ data: logs }, { data: artifacts }, { data: project }] = await Promise.all([
      admin
        .from("build_logs")
        .select("*")
        .eq("build_id", build.id)
        .order("created_at", { ascending: true })
        .limit(300),
      admin
        .from("artifacts")
        .select("id, name, size_bytes, content_type, kind, checksum, created_at")
        .eq("build_id", build.id)
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      admin
        .from("projects")
        .select("id, name, package_id, repo_full_name, repo_private, platforms, config")
        .eq("id", build.project_id)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (!project) throw new ApiError("The project for this build no longer exists", 404);

    return NextResponse.json({
      build,
      logs: logs ?? [],
      artifacts: artifacts ?? [],
      project,
    });
  } catch (error) {
    return jsonError(error);
  }
}
