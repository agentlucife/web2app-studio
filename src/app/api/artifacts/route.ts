import { NextResponse } from "next/server";
import { jsonError, requireApiUser, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { admin, userId } = await requireApiUser();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const kind = url.searchParams.get("kind");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);

    let query = admin
      .from("artifacts")
      .select("id, build_id, project_id, name, size_bytes, content_type, kind, checksum, created_at, projects(name), builds(platform, build_type)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (projectId) query = query.eq("project_id", projectId);
    if (kind) query = query.eq("kind", kind);

    const { data, error } = await query;
    if (error) throw new ApiError("Could not load downloads", 500);

    const artifacts = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      project_name: (row.projects as { name?: string } | null)?.name ?? "Deleted project",
      platform: (row.builds as { platform?: string } | null)?.platform ?? null,
      build_type: (row.builds as { build_type?: string } | null)?.build_type ?? null,
      projects: undefined,
      builds: undefined,
    }));
    return NextResponse.json({ artifacts });
  } catch (error) {
    return jsonError(error);
  }
}
