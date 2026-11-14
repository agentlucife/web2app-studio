import { NextResponse } from "next/server";
import { jsonError, requireApiAdmin, ApiError } from "@/lib/api";
import { RUNNING_STATUSES } from "@/lib/builds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { admin } = await requireApiAdmin();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      users,
      suspended,
      newUsers,
      projects,
      builds,
      running,
      completed,
      failed,
      openTickets,
      artifacts,
      recentBuilds,
      recentUsers,
    ] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("suspended", true),
      admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      admin.from("projects").select("id", { count: "exact", head: true }),
      admin.from("builds").select("id", { count: "exact", head: true }),
      admin.from("builds").select("id", { count: "exact", head: true }).in("status", [...RUNNING_STATUSES]),
      admin.from("builds").select("id", { count: "exact", head: true }).eq("status", "completed"),
      admin.from("builds").select("id", { count: "exact", head: true }).eq("status", "failed"),
      admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      admin.from("artifacts").select("size_bytes").limit(5000),
      admin
        .from("builds")
        .select("id, status, platform, build_type, created_at, projects(name), user_id")
        .order("created_at", { ascending: false })
        .limit(12),
      admin
        .from("profiles")
        .select("id, email, full_name, role, suspended, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const artifactBytes = (artifacts.data ?? []).reduce(
      (total, row) => total + Number(row.size_bytes ?? 0),
      0
    );

    return NextResponse.json({
      stats: {
        users: users.count ?? 0,
        suspended: suspended.count ?? 0,
        newUsersThisWeek: newUsers.count ?? 0,
        projects: projects.count ?? 0,
        builds: builds.count ?? 0,
        running: running.count ?? 0,
        completed: completed.count ?? 0,
        failed: failed.count ?? 0,
        artifactCount: (artifacts.data ?? []).length,
        artifactBytes,
        openTickets: openTickets.count ?? 0,
      },
      recentBuilds: (recentBuilds.data ?? []).map((row) => ({
        ...row,
        project_name: (row.projects as { name?: string } | null)?.name ?? "Deleted project",
        projects: undefined,
      })),
      recentUsers: recentUsers.data ?? [],
    });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error);
    return jsonError(error);
  }
}
