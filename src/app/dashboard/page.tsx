"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Download,
  FolderKanban,
  Hammer,
  Loader2,
  Plus,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { Github } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
  cn,
} from "@/components/ui";
import { apiFetch, buildStatusMeta, buildTypeLabel, formatDate, relativeTime } from "@/lib/client";

type Overview = {
  stats: {
    projects: number;
    builds: number;
    running: number;
    completed: number;
    failed: number;
    downloads: number;
  };
  github: { github_username: string; avatar_url: string } | null;
  subscription: { plan: string; status: string };
  recentProjects: Array<{
    id: string;
    name: string;
    package_id: string;
    platforms: string[];
    updated_at: string;
  }>;
  recentBuilds: Array<{
    id: string;
    project_name: string;
    platform: string;
    build_type: string;
    status: string;
    created_at: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    apiFetch<Overview>("/api/overview")
      .then((response) => alive && setData(response))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load your dashboard"));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Overview" description="Your projects, builds and downloads at a glance." />
        <Alert tone="error" title="Dashboard unavailable">{error}</Alert>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description="Your projects, GitHub builds and download artifacts — all backed by real data."
        actions={
          <>
            <Link href="/dashboard/github">
              <Button variant="outline" size="md">
                <Github className="h-4 w-4" /> GitHub
              </Button>
            </Link>
            <Link href="/dashboard/builder">
              <Button size="md">
                <Plus className="h-4 w-4" /> New project
              </Button>
            </Link>
          </>
        }
      />

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          {!data.github && (
            <Alert tone="warning" title="Connect GitHub to start building" className="mb-6">
              Web2App Studio uses your own GitHub repository and Actions runners to compile APKs and IPAs.
              <Link href="/dashboard/github" className="ml-1 font-semibold text-amber-100 underline underline-offset-2">
                Connect GitHub →
              </Link>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Projects" value={data.stats.projects} hint="Website-to-app configurations" icon={FolderKanban} tone="green" />
            <StatCard label="Builds" value={data.stats.builds} hint={`${data.stats.completed} completed`} icon={Hammer} tone="blue" />
            <StatCard
              label="In progress"
              value={data.stats.running}
              hint={data.stats.running > 0 ? "GitHub Actions is working" : "No builds running"}
              icon={Loader2}
              tone={data.stats.running > 0 ? "amber" : "neutral"}
            />
            <StatCard label="Downloads" value={data.stats.downloads} hint="Verified artifacts in private storage" icon={Download} tone="green" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Recent builds"
                description="Live status from your GitHub Actions runners."
                icon={Hammer}
                action={
                  <Link href="/dashboard/builds" className="text-xs font-medium text-emerald-400 hover:text-emerald-300">
                    View all
                  </Link>
                }
              />
              <div className="divide-y divide-zinc-800/70">
                {data.recentBuilds.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      icon={Hammer}
                      title="No builds yet"
                      description="Create a project, connect a repository and start your first Android build."
                      action={
                        <Link href="/dashboard/builder">
                          <Button size="sm">
                            <Plus className="h-3.5 w-3.5" /> Create a project
                          </Button>
                        </Link>
                      }
                    />
                  </div>
                ) : (
                  data.recentBuilds.map((build) => {
                    const status = buildStatusMeta(build.status);
                    return (
                      <Link
                        key={build.id}
                        href={`/dashboard/builds/${build.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-900/60"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-800/70 text-zinc-400">
                          <Smartphone className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-200">{build.project_name}</p>
                          <p className="text-[11px] text-zinc-500">
                            {build.platform === "android" ? "Android" : "iOS"} · {buildTypeLabel(build.build_type)} ·{" "}
                            {relativeTime(build.created_at)}
                          </p>
                        </div>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <ArrowRight className="h-4 w-4 shrink-0 text-zinc-700" />
                      </Link>
                    );
                  })
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Plan" icon={TrendingUp} description="Current workspace limits." />
                <div className="p-5">
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-bold capitalize text-white">{data.subscription.plan}</p>
                    <Badge tone={data.subscription.status === "active" ? "green" : "amber"}>
                      {data.subscription.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {data.stats.projects} of your project allowance used.
                  </p>
                  <Link href="/dashboard/billing" className="mt-4 block">
                    <Button variant="outline" size="sm" className="w-full">
                      Manage plan
                    </Button>
                  </Link>
                </div>
              </Card>

              <Card>
                <CardHeader title="Recent projects" icon={FolderKanban} />
                <div className="divide-y divide-zinc-800/70">
                  {data.recentProjects.length === 0 ? (
                    <p className="px-5 py-6 text-xs text-zinc-500">No projects yet.</p>
                  ) : (
                    data.recentProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/dashboard/projects/${project.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-900/60"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                          <Smartphone className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-zinc-200">{project.name}</p>
                          <p className="truncate text-[10px] text-zinc-500">{project.package_id}</p>
                        </div>
                        <span className="text-[10px] uppercase text-zinc-600">{project.platforms.join(" · ")}</span>
                      </Link>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <QuickAction
              href="/dashboard/builder"
              icon={Plus}
              title="Create an app"
              description="Configure name, icon, splash, permissions and deep links."
            />
            <QuickAction
              href="/dashboard/github"
              icon={Github}
              title="GitHub connection"
              description={
                data.github
                  ? `Connected as ${data.github.github_username}`
                  : "Add a PAT or sign in with GitHub."
              }
            />
            <QuickAction
              href="/dashboard/downloads"
              icon={Download}
              title="Download builds"
              description={`${data.stats.completed} completed build${data.stats.completed === 1 ? "" : "s"} ready to download.`}
            />
          </div>

          {data.stats.failed > 0 && (
            <Alert tone="warning" className="mt-6" title="Some builds need attention">
              {data.stats.failed} build{data.stats.failed === 1 ? "" : "s"} failed. Open a build to read the real GitHub
              Actions logs and retry.
              <Link href="/dashboard/builds?status=failed" className="ml-1 font-semibold underline underline-offset-2">
                Review failures
              </Link>
            </Alert>
          )}

          <p className="mt-8 text-center text-[11px] text-zinc-600">
            Last refreshed {formatDate(new Date().toISOString())} · data comes from Supabase and GitHub.
          </p>
        </>
      )}
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Plus;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-emerald-500/30 hover:bg-zinc-900/70"
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="flex items-center gap-1 text-sm font-semibold text-zinc-200">
          {title}
          <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{description}</p>
      </div>
    </Link>
  );
}
