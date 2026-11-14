import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { RUNNING_STATUSES } from "@/lib/builds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { admin, userId } = await requireApiUser();
    const [
      projects,
      builds,
      running,
      completed,
      failed,
      artifacts,
      unread,
      github,
      subscription,
      recentProjects,
      recentBuilds,
    ] = await Promise.all([
      admin.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("builds").select("id", { count: "exact", head: true }).eq("user_id", userId),
      admin
        .from("builds")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", [...RUNNING_STATUSES]),
      admin
        .from("builds")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed"),
      admin
        .from("builds")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "failed"),
      admin.from("artifacts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false),
      admin
        .from("github_connections")
        .select("github_username, avatar_url")
        .eq("user_id", userId)
        .maybeSingle(),
      admin.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle(),
      admin
        .from("projects")
        .select("id, name, package_id, website_url, platforms, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5),
      admin
        .from("builds")
        .select("id, platform, build_type, status, created_at, projects(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    return NextResponse.json({
      stats: {
        projects: projects.count ?? 0,
        builds: builds.count ?? 0,
        running: running.count ?? 0,
        completed: completed.count ?? 0,
        failed: failed.count ?? 0,
        downloads: artifacts.count ?? 0,
        unread: unread.count ?? 0,
      },
      github: github.data ?? null,
      subscription: subscription.data ?? { plan: "free", status: "active" },
      recentProjects: recentProjects.data ?? [],
      recentBuilds: (recentBuilds.data ?? []).map((row) => ({
        ...row,
        project_name: (row.projects as { name?: string } | null)?.name ?? "Deleted project",
        projects: undefined,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
