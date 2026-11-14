"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Filter,
  Hammer,
  Loader2,
  RefreshCw,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  cn,
} from "@/components/ui";
import { apiFetch, buildStatusMeta, buildTypeLabel, isRunningStatus, relativeTime } from "@/lib/client";

type Build = {
  id: string;
  project_id: string;
  project_name: string;
  platform: string;
  build_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  workflow_run_url: string | null;
  artifact_name: string | null;
};

const FILTERS = [
  { id: "", label: "All" },
  { id: "running", label: "Running" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export function BuildsClient({
  initialStatus,
  projectId,
}: {
  initialStatus: string;
  projectId: string;
}) {
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(initialStatus || "");
  const [refreshing, setRefreshing] = useState(false);

  async function load(showSpinner = false) {
    if (showSpinner) setRefreshing(true);
    try {
      const query = projectId ? `?projectId=${projectId}` : "";
      const data = await apiFetch<{ builds: Build[] }>(`/api/builds${query}`);
      setBuilds(data.builds);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load builds");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), 12_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const filtered = useMemo(() => {
    if (!builds) return [];
    if (!filter) return builds;
    if (filter === "running") return builds.filter((build) => isRunningStatus(build.status));
    return builds.filter((build) => build.status === filter);
  }, [builds, filter]);

  const counts = useMemo(() => {
    const rows = builds ?? [];
    return {
      all: rows.length,
      running: rows.filter((build) => isRunningStatus(build.status)).length,
      completed: rows.filter((build) => build.status === "completed").length,
      failed: rows.filter((build) => build.status === "failed").length,
      cancelled: rows.filter((build) => build.status === "cancelled").length,
    };
  }, [builds]);

  return (
    <div>
      <PageHeader
        eyebrow="Build pipeline"
        title="Builds"
        description="Every build runs on GitHub Actions. Statuses are synchronised from the real workflow run."
        actions={
          <>
            <Button variant="outline" onClick={() => load(true)} loading={refreshing}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Link href="/dashboard/builder">
              <Button>
                <Hammer className="h-4 w-4" /> New build
              </Button>
            </Link>
          </>
        }
      />

      {error && (
        <Alert tone="error" className="mb-5" title="Could not load builds">
          {error}
        </Alert>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-zinc-500" />
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === item.id
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            )}
          >
            {item.label}
            <span className={cn("rounded-full px-1.5 text-[10px]", filter === item.id ? "bg-emerald-500/20" : "bg-zinc-800")}>
              {counts[item.id as keyof typeof counts] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {!builds ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Hammer}
          title={builds.length === 0 ? "No builds yet" : "No builds match this filter"}
          description={
            builds.length === 0
              ? "Open a project and start an Android or iOS build. Real logs and artifacts will appear here."
              : "Try another status or clear the filter."
          }
          action={
            builds.length === 0 ? (
              <Link href="/dashboard/projects">
                <Button size="sm">Open projects</Button>
              </Link>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setFilter("")}>
                Clear filter
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-zinc-800/70">
            {filtered.map((build) => {
              const status = buildStatusMeta(build.status);
              return (
                <Link
                  key={build.id}
                  href={`/dashboard/builds/${build.id}`}
                  className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-zinc-900/60 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <StatusIcon status={build.status} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-zinc-200">{build.project_name}</p>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {build.platform === "android" ? "Android" : "iOS"} · {buildTypeLabel(build.build_type)} · started{" "}
                        {relativeTime(build.created_at)}
                        {build.completed_at ? ` · finished ${relativeTime(build.completed_at)}` : ""}
                      </p>
                      {build.error_message && (
                        <p className="mt-1 line-clamp-1 text-[11px] text-red-400">{build.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-11 sm:pl-0">
                    {build.workflow_run_url && (
                      <span className="hidden text-[10px] font-medium uppercase tracking-wide text-zinc-600 md:block">
                        GitHub run
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-zinc-700 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const base = "grid h-9 w-9 shrink-0 place-items-center rounded-lg";
  if (status === "completed") {
    return (
      <span className={cn(base, "bg-emerald-500/10 text-emerald-400")}>
        <CheckCircle2 className="h-4 w-4" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={cn(base, "bg-red-500/10 text-red-400")}>
        <TriangleAlert className="h-4 w-4" />
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className={cn(base, "bg-zinc-800 text-zinc-500")}>
        <Ban className="h-4 w-4" />
      </span>
    );
  }
  if (isRunningStatus(status)) {
    return (
      <span className={cn(base, "bg-amber-500/10 text-amber-400")}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-zinc-800 text-zinc-500")}>
      <Smartphone className="h-4 w-4" />
    </span>
  );
}
