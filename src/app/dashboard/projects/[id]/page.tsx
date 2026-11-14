"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Archive,
  Copy,
  ExternalLink,
  Hammer,
  Package,
  RefreshCw,
  Settings2,
  Smartphone,
  Trash2,
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
  PageHeader,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";
import { apiFetch, buildStatusMeta, buildTypeLabel, formatDate, relativeTime } from "@/lib/client";

type Project = {
  id: string;
  name: string;
  description: string | null;
  website_url: string;
  package_id: string;
  platforms: string[];
  repo_full_name: string | null;
  repo_branch: string;
  repo_private: boolean;
  icon_preview_url: string | null;
  splash_preview_url: string | null;
  updated_at: string;
  config: Record<string, unknown>;
};

type Build = {
  id: string;
  platform: string;
  build_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
};

// (helpers live in @/lib/client)

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { toast } = useToast();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [error, setError] = useState("");
  const [platform, setPlatform] = useState<"android" | "ios">("android");
  const [buildType, setBuildType] = useState("debug");
  const [building, setBuilding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    params.then((value) => setProjectId(value.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await apiFetch<{ project: Project; builds: Build[] }>(`/api/projects/${projectId}`);
      setProject(data.project);
      setBuilds(data.builds);
      setPlatform(data.project.platforms.includes("ios") && !data.project.platforms.includes("android") ? "ios" : "android");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the project");
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const types = platform === "android" ? ["debug", "release-apk", "release-aab"] : ["ios-archive", "ios-ipa"];
  useEffect(() => {
    if (!types.includes(buildType)) setBuildType(platform === "android" ? "debug" : "ios-archive");
  }, [platform]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startBuild() {
    if (!project) return;
    setBuilding(true);
    try {
      const data = await apiFetch<{ build: { id: string } }>("/api/builds", {
        method: "POST",
        json: { projectId: project.id, platform, buildType },
      });
      toast("Build queued. GitHub Actions will start shortly.", "success");
      router.push(`/dashboard/builds/${data.build.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not start the build", "error");
    } finally {
      setBuilding(false);
    }
  }

  async function syncSource() {
    if (!project) return;
    setSyncing(true);
    try {
      const data = await apiFetch<{ commitUrl: string; files: number }>(`/api/projects/${project.id}/sync`, {
        method: "POST",
      });
      toast(`Pushed ${data.files} generated files to GitHub.`, "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not sync source", "error");
    } finally {
      setSyncing(false);
    }
  }

  async function downloadSource() {
    if (!project) return;
    setDownloading(true);
    try {
      const data = await apiFetch<{ url: string }>(`/api/projects/${project.id}/source`);
      window.open(data.url, "_blank", "noopener,noreferrer");
      toast("Source archive generated. The download link expires in 10 minutes.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not generate the source archive", "error");
    } finally {
      setDownloading(false);
    }
  }

  async function deleteProject() {
    if (!project) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: "DELETE" });
      toast("Project deleted.", "success");
      router.push("/dashboard/projects");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the project", "error");
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div>
        <Link href="/dashboard/projects" className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
        </Link>
        <Alert tone="error" title="Project unavailable">{error}</Alert>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const repoUrl = project.repo_full_name ? `https://github.com/${project.repo_full_name}` : null;

  return (
    <div>
      <Link href="/dashboard/projects" className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
      </Link>

      <PageHeader
        title={project.name}
        description={project.description || project.website_url}
        actions={
          <>
            <Link href={`/dashboard/builder?project=${project.id}`}>
              <Button variant="outline">
                <Settings2 className="h-4 w-4" /> Edit config
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Build an app"
              description="Builds run on GitHub Actions in your repository. No local SDK required."
              icon={Hammer}
            />
            <div className="space-y-4 p-5">
              {!project.repo_full_name && (
                <Alert tone="warning" title="This project has no repository">
                  Connect a repository in the builder before starting a build.
                </Alert>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-300">Platform</p>
                  <Select value={platform} onChange={(event) => setPlatform(event.target.value as "android" | "ios")}>
                    {project.platforms.includes("android") && <option value="android">Android</option>}
                    {project.platforms.includes("ios") && <option value="ios">iOS</option>}
                  </Select>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-300">Output</p>
                  <Select value={buildType} onChange={(event) => setBuildType(event.target.value)}>
                    {types.map((type) => (
                      <option key={type} value={type}>
                        {buildTypeLabel(type)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              {(buildType === "release-apk" || buildType === "release-aab") && (
                <Alert tone="info">
                  Signed release builds require Android keystore secrets in the repository. Without them the workflow fails
                  with a clear error instead of producing an unsigned release.
                </Alert>
              )}
              {platform === "ios" && buildType === "ios-ipa" && (
                <Alert tone="info">
                  An installable IPA requires Apple signing secrets. Without them the workflow produces an unsigned archive
                  that cannot be installed on a device.
                </Alert>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={startBuild} loading={building} disabled={!project.repo_full_name}>
                  <Hammer className="h-4 w-4" /> Start build
                </Button>
                <Button variant="outline" onClick={syncSource} loading={syncing} disabled={!project.repo_full_name}>
                  <RefreshCw className="h-4 w-4" /> Push source
                </Button>
                <Button variant="outline" onClick={downloadSource} loading={downloading}>
                  <Archive className="h-4 w-4" /> Download source
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Build history"
              description="Newest first. Open a build for logs, artifacts and cancellation."
              icon={Hammer}
            />
            {builds.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Hammer} title="No builds yet" description="Choose an output above and start your first build." />
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {builds.map((build) => {
                  const status = buildStatusMeta(build.status);
                  return (
                    <Link
                      key={build.id}
                      href={`/dashboard/builds/${build.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-900/60"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-800/60 text-zinc-400">
                        <Smartphone className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200">
                          {build.platform === "android" ? "Android" : "iOS"} · {buildTypeLabel(build.build_type)}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {relativeTime(build.created_at)}
                          {build.completed_at ? ` · finished ${relativeTime(build.completed_at)}` : ""}
                        </p>
                        {build.error_message && <p className="mt-0.5 truncate text-[11px] text-red-400">{build.error_message}</p>}
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              {project.icon_preview_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.icon_preview_url}
                  alt="App icon"
                  className="h-14 w-14 rounded-xl border border-zinc-700 object-cover"
                />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                  <Package className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{project.name}</p>
                <p className="truncate text-[11px] text-zinc-500">{project.package_id}</p>
              </div>
            </div>
            {project.splash_preview_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.splash_preview_url}
                alt="Splash screen"
                className="mt-4 h-28 w-full rounded-lg border border-zinc-800 object-cover"
              />
            )}
            <dl className="mt-4 space-y-2.5 text-xs">
              <Row label="Website">
                <a href={project.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300">
                  {new URL(project.website_url).hostname} <ExternalLink className="h-3 w-3" />
                </a>
              </Row>
              <Row label="Platforms">
                <span className="text-zinc-300">{project.platforms.join(", ")}</span>
              </Row>
              <Row label="Repository">
                {repoUrl ? (
                  <a href={repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300">
                    <Github className="h-3 w-3" /> {project.repo_full_name}
                    {project.repo_private ? " (private)" : ""}
                  </a>
                ) : (
                  <span className="text-amber-400">Not connected</span>
                )}
              </Row>
              <Row label="Branch">
                <span className="text-zinc-300">{project.repo_branch}</span>
              </Row>
              <Row label="Updated">
                <span className="text-zinc-300">{formatDate(project.updated_at)}</span>
              </Row>
            </dl>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold text-zinc-300">Need a copy?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              Duplicating creates a new project with the same configuration and a unique package ID. Repository links are not
              copied.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={async () => {
                try {
                  const data = await apiFetch<{ project: Project }>(`/api/projects/${project.id}/duplicate`, {
                    method: "POST",
                    json: {},
                  });
                  toast("Project duplicated.", "success");
                  router.push(`/dashboard/projects/${data.project.id}`);
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Could not duplicate", "error");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate project
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete "${project.name}"?`}
        description="All builds, logs and downloaded artifacts for this project will be permanently deleted."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteProject} loading={deleting}>
              Delete project
            </Button>
          </>
        }
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}
