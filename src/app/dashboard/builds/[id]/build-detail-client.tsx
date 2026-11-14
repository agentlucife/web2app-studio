"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  Download,
  ExternalLink,
  FileArchive,
  Hammer,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Terminal,
} from "lucide-react";
import { Github } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  Skeleton,
  cn,
  useToast,
} from "@/components/ui";
import {
  apiFetch,
  artifactKindLabel,
  buildStatusMeta,
  buildTypeLabel,
  formatBytes,
  formatDate,
  isRunningStatus,
  relativeTime,
} from "@/lib/client";

type BuildLog = {
  id: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  created_at: string;
};

type Artifact = {
  id: string;
  name: string;
  size_bytes: number | null;
  kind: string;
  checksum: string | null;
  created_at: string;
};

type BuildData = {
  build: {
    id: string;
    project_id: string;
    platform: "android" | "ios";
    build_type: string;
    status: string;
    signing_mode: string | null;
    commit_sha: string | null;
    workflow_run_id: number | null;
    workflow_run_url: string | null;
    workflow_name: string | null;
    artifact_name: string | null;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  logs: BuildLog[];
  artifacts: Artifact[];
  project: {
    id: string;
    name: string;
    package_id: string;
    repo_full_name: string | null;
    repo_private: boolean;
  };
};

const STEPS = [
  { id: "queued", label: "Queued" },
  { id: "preparing", label: "Preparing source" },
  { id: "building", label: "Compiling" },
  { id: "uploading", label: "Verifying artifact" },
  { id: "completed", label: "Ready" },
];

export function BuildDetailClient({ buildId }: { buildId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<BuildData | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const wasRunning = useRef(false);

  const load = useCallback(
    async (silent = false) => {
      try {
        const response = await apiFetch<BuildData>(`/api/builds/${buildId}`);
        setData(response);
        setError("");
        wasRunning.current = isRunningStatus(response.build.status);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : "Could not load this build");
      }
    },
    [buildId]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const running = isRunningStatus(data.build.status);
    const interval = setInterval(() => load(true), running ? 5000 : 20000);
    return () => clearInterval(interval);
  }, [data, load]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [data?.logs.length]);

  useEffect(() => {
    if (data && wasRunning.current && data.build.status === "completed") {
      toast("Build completed. Your artifact is ready to download.", "success");
    }
  }, [data, toast]);

  async function cancel() {
    setCancelling(true);
    try {
      await apiFetch(`/api/builds/${buildId}/cancel`, { method: "POST" });
      toast("Cancellation requested. GitHub will stop the workflow.", "info");
      setCancelOpen(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not cancel the build", "error");
    } finally {
      setCancelling(false);
    }
  }

  async function retry() {
    setRetrying(true);
    try {
      const result = await apiFetch<{ build: { id: string } }>(`/api/builds/${buildId}/retry`, {
        method: "POST",
      });
      toast("Retry queued as a new build.", "success");
      router.push(`/dashboard/builds/${result.build.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not retry the build", "error");
    } finally {
      setRetrying(false);
    }
  }

  async function download(artifact: Artifact) {
    setDownloading(artifact.id);
    try {
      const result = await apiFetch<{ url: string; expiresInSeconds: number }>(
        `/api/artifacts/${artifact.id}/download`
      );
      window.open(result.url, "_blank", "noopener,noreferrer");
      toast(`Download started. The secure link expires in ${Math.round(result.expiresInSeconds / 60)} minutes.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create a download link", "error");
    } finally {
      setDownloading(null);
    }
  }

  const stepIndex = useMemo(() => {
    if (!data) return 0;
    if (data.build.status === "failed" || data.build.status === "cancelled") {
      return Math.max(0, STEPS.findIndex((step) => step.id === (data.build.status === "cancelled" ? "building" : "uploading")));
    }
    return Math.max(0, STEPS.findIndex((step) => step.id === data.build.status));
  }, [data]);

  if (error && !data) {
    return (
      <div>
        <Link href="/dashboard/builds" className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to builds
        </Link>
        <Alert tone="error" title="Build unavailable">{error}</Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { build, project, logs, artifacts } = data;
  const status = buildStatusMeta(build.status);
  const running = isRunningStatus(build.status);
  const failed = build.status === "failed" || build.status === "cancelled";
  const repoUrl = project.repo_full_name ? `https://github.com/${project.repo_full_name}` : null;
  const isIosUnsigned = build.platform === "ios" && build.signing_mode === "unsigned-or-signed-archive";

  return (
    <div>
      <Link href="/dashboard/builds" className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to builds
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 grid h-11 w-11 place-items-center rounded-xl",
              build.status === "completed"
                ? "bg-emerald-500/10 text-emerald-400"
                : build.status === "failed"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-zinc-800 text-zinc-400"
            )}
          >
            {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Hammer className="h-5 w-5" />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-white">
                {project.name} · {build.platform === "android" ? "Android" : "iOS"}
              </h1>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {buildTypeLabel(build.build_type)} · created {relativeTime(build.created_at)} · updated{" "}
              {relativeTime(build.updated_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {running && (
            <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
          {!running && (
            <Button variant="outline" size="sm" onClick={retry} loading={retrying}>
              <RotateCcw className="h-3.5 w-3.5" /> Rebuild
            </Button>
          )}
          {build.workflow_run_url && (
            <a href={build.workflow_run_url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <Github className="h-3.5 w-3.5" /> GitHub run <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
          {repoUrl && (
            <a href={repoUrl} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm">
                Repository <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {build.error_message && (
        <Alert tone={build.status === "cancelled" ? "warning" : "error"} title="Build did not complete" className="mb-5">
          {build.error_message}
        </Alert>
      )}

      {isIosUnsigned && build.status === "completed" && (
        <Alert tone="warning" title="Unsigned iOS archive" className="mb-5">
          This archive was produced without Apple signing credentials. It is useful for inspection and CI validation, but it
          cannot be installed on a device. Configure Apple signing secrets in the repository and rebuild as a signed IPA.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-300">Pipeline</p>
              <button onClick={() => load(true)} className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300">
                Refresh now
              </button>
            </div>
            <div className="flex items-center">
              {STEPS.map((step, index) => {
                const complete = index < stepIndex || build.status === "completed";
                const active = index === stepIndex && build.status !== "completed" && !failed;
                return (
                  <div key={step.id} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-full border text-[10px] font-bold transition-colors",
                          complete
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : active
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                              : failed && index === stepIndex
                                ? "border-red-500/40 bg-red-500/10 text-red-300"
                                : "border-zinc-700 bg-zinc-900 text-zinc-600"
                        )}
                      >
                        {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className="hidden whitespace-nowrap text-[10px] text-zinc-500 sm:block">{step.label}</span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={cn(
                          "mx-1.5 mb-4 h-0.5 flex-1 rounded sm:mx-2",
                          index < stepIndex || build.status === "completed" ? "bg-emerald-500/40" : "bg-zinc-800"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {failed && (
              <p className="mt-4 text-center text-[11px] text-red-400">
                {build.status === "cancelled" ? "Cancelled before completion." : "The workflow stopped with an error. Read the logs below."}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Build logs"
              description="Server events plus the tail of the real GitHub Actions job log."
              icon={Terminal}
              action={<span className="text-[10px] uppercase tracking-wide text-zinc-600">{logs.length} entries</span>}
            />
            <div
              ref={logRef}
              className="max-h-96 overflow-y-auto bg-black/60 p-4 font-mono text-[11px] leading-relaxed"
            >
              {logs.length === 0 ? (
                <p className="text-zinc-600">Waiting for the first log entry…</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-3 py-0.5">
                    <span className="shrink-0 text-zinc-700">{formatDate(log.created_at).split(", ")[1] ?? ""}</span>
                    <span
                      className={cn(
                        "shrink-0 font-semibold uppercase",
                        log.level === "error"
                          ? "text-red-400"
                          : log.level === "warn"
                            ? "text-amber-400"
                            : log.level === "success"
                              ? "text-emerald-400"
                              : "text-sky-400"
                      )}
                    >
                      {log.level}
                    </span>
                    <span className="whitespace-pre-wrap break-words text-zinc-300">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Downloads" icon={Download} description="Stored privately and served with expiring signed URLs." />
            <div className="p-5">
              {artifacts.length === 0 ? (
                <EmptyState
                  icon={FileArchive}
                  title={running ? "Artifact not ready" : "No artifacts"}
                  description={
                    running
                      ? "The server downloads and verifies the artifact after the workflow succeeds."
                      : "This build did not produce a downloadable artifact."
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {artifacts.map((artifact) => (
                    <div key={artifact.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-zinc-200">{artifact.name}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            {artifactKindLabel(artifact.kind)} · {formatBytes(artifact.size_bytes)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={downloading === artifact.id}
                          onClick={() => download(artifact)}
                        >
                          {downloading !== artifact.id && <Download className="h-3.5 w-3.5" />}
                          Download
                        </Button>
                      </div>
                      {artifact.checksum && (
                        <p className="mt-2 truncate font-mono text-[9px] text-zinc-700" title={artifact.checksum}>
                          sha256 {artifact.checksum}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Build details" icon={Smartphone} />
            <dl className="space-y-3 p-5 text-xs">
              <Detail label="Project">
                <Link href={`/dashboard/projects/${project.id}`} className="text-emerald-400 hover:text-emerald-300">
                  {project.name}
                </Link>
              </Detail>
              <Detail label="Package">
                <span className="font-mono text-[10px] text-zinc-300">{project.package_id}</span>
              </Detail>
              <Detail label="Platform">
                <span className="text-zinc-300">{build.platform === "android" ? "Android" : "iOS"}</span>
              </Detail>
              <Detail label="Output">
                <span className="text-zinc-300">{buildTypeLabel(build.build_type)}</span>
              </Detail>
              <Detail label="Signing">
                <span className={cn("text-right", isIosUnsigned ? "text-amber-400" : "text-zinc-300")}>
                  {signingLabel(build.signing_mode)}
                </span>
              </Detail>
              <Detail label="Commit">
                {build.commit_sha ? (
                  <span className="font-mono text-[10px] text-zinc-300">{build.commit_sha.slice(0, 10)}</span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </Detail>
              <Detail label="Started">
                <span className="text-zinc-300">{build.started_at ? formatDate(build.started_at) : "—"}</span>
              </Detail>
              <Detail label="Completed">
                <span className="text-zinc-300">{build.completed_at ? formatDate(build.completed_at) : "—"}</span>
              </Detail>
            </dl>
          </Card>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-[11px] leading-relaxed text-zinc-500">
            <p className="flex items-center gap-1.5 font-semibold text-zinc-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Verification
            </p>
            <p className="mt-1">
              A workflow&apos;s success message alone is not trusted. The server downloads the GitHub artifact, checks its
              contents, stores it privately, and only then marks the build completed.
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this build?"
        description="The GitHub Actions workflow will be cancelled. Partial artifacts are discarded."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Keep building
            </Button>
            <Button variant="danger" onClick={cancel} loading={cancelling}>
              <Ban className="h-4 w-4" /> Cancel build
            </Button>
          </>
        }
      />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

function signingLabel(mode: string | null) {
  switch (mode) {
    case "debug-key":
      return "Debug key";
    case "release-keystore-required":
      return "Release keystore required";
    case "apple-signing-required":
      return "Apple signing required";
    case "unsigned-or-signed-archive":
      return "Unsigned or signed archive";
    default:
      return "—";
  }
}
