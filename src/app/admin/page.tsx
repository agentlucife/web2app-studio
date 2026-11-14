"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FolderKanban,
  HardDrive,
  LifeBuoy,
  Shield,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  Skeleton,
  StatCard,
  cn,
} from "@/components/ui";
import { apiFetch, buildStatusMeta, buildTypeLabel, formatBytes, relativeTime } from "@/lib/client";

type AdminStats = {
  stats: {
    users: number;
    suspended: number;
    newUsersThisWeek: number;
    projects: number;
    builds: number;
    running: number;
    completed: number;
    failed: number;
    artifactCount: number;
    artifactBytes: number;
    openTickets: number;
  };
  recentBuilds: Array<{
    id: string;
    status: string;
    platform: string;
    build_type: string;
    project_name: string;
    created_at: string;
  }>;
  recentUsers: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    suspended: boolean;
    created_at: string;
  }>;
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<AdminStats>("/api/admin/stats")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load admin stats"));
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Real counts from Supabase. No synthetic metrics."
        actions={
          <>
            <Link href="/admin/users"><Button variant="outline"><Users className="h-4 w-4" /> Users</Button></Link>
            <Link href="/admin/support"><Button><LifeBuoy className="h-4 w-4" /> Support</Button></Link>
          </>
        }
      />

      {error && <Alert tone="error" className="mb-5" title="Could not load stats">{error}</Alert>}

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Users" value={data.stats.users} hint={`${data.stats.newUsersThisWeek} new this week`} icon={Users} tone="green" />
            <StatCard label="Projects" value={data.stats.projects} hint="Across all users" icon={FolderKanban} tone="blue" />
            <StatCard label="Builds" value={data.stats.builds} hint={`${data.stats.running} running`} icon={Shield} tone="amber" />
            <StatCard label="Stored artifacts" value={data.stats.artifactCount} hint={formatBytes(data.stats.artifactBytes)} icon={HardDrive} tone="neutral" />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Completed" value={data.stats.completed} icon={CheckCircle2} tone="green" />
            <StatCard label="Failed" value={data.stats.failed} icon={TriangleAlert} tone="red" />
            <StatCard label="Suspended" value={data.stats.suspended} hint="Accounts blocked from the API" icon={UserPlus} tone="neutral" />
            <StatCard label="Open tickets" value={data.stats.openTickets} icon={LifeBuoy} tone="amber" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Recent builds"
                description="Newest across the entire platform."
                icon={Shield}
                action={<Link href="/admin/users" className="text-xs font-medium text-violet-300 hover:text-violet-200">Manage users</Link>}
              />
              <div className="divide-y divide-zinc-800/70">
                {data.recentBuilds.length === 0 ? (
                  <p className="p-5 text-xs text-zinc-500">No builds yet.</p>
                ) : (
                  data.recentBuilds.map((build) => {
                    const status = buildStatusMeta(build.status);
                    return (
                      <Link key={build.id} href={`/dashboard/builds/${build.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/60">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-zinc-200">{build.project_name}</span>
                          <span className="block text-[10px] text-zinc-500">
                            {build.platform} · {buildTypeLabel(build.build_type)} · {relativeTime(build.created_at)}
                          </span>
                        </span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-700" />
                      </Link>
                    );
                  })
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Newest users" icon={Users} />
              <div className="divide-y divide-zinc-800/70">
                {data.recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400">
                      {(user.full_name ?? user.email ?? "U")[0]?.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-zinc-200">{user.full_name || user.email}</p>
                      <p className="truncate text-[10px] text-zinc-500">{user.email}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                        user.role === "admin"
                          ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                          : "border-zinc-700 bg-zinc-800 text-zinc-400"
                      )}
                    >
                      {user.suspended ? "suspended" : user.role}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-800 p-4">
                <Link href="/admin/users"><Button variant="outline" size="sm" className="w-full">Open user management</Button></Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
