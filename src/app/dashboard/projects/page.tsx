"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  FolderKanban,
  MoreHorizontal,
  Plus,
  Search,
  Smartphone,
  Trash2,
  Wand2,
} from "lucide-react";
import { Github } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  useToast,
} from "@/components/ui";
import { apiFetch, relativeTime } from "@/lib/client";

type Project = {
  id: string;
  name: string;
  description: string | null;
  website_url: string;
  package_id: string;
  platforms: string[];
  repo_full_name: string | null;
  repo_private: boolean;
  updated_at: string;
  created_at: string;
};

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<{ projects: Project[] }>("/api/projects");
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load projects");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) =>
      [project.name, project.package_id, project.website_url, project.repo_full_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [projects, search]);

  async function removeProject() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${deleting.id}`, { method: "DELETE" });
      setProjects((rows) => (rows ?? []).filter((row) => row.id !== deleting.id));
      toast(`"${deleting.name}" was deleted.`, "success");
      setDeleting(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the project", "error");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(project: Project) {
    setDuplicating(project.id);
    setMenu(null);
    try {
      const data = await apiFetch<{ project: Project }>(`/api/projects/${project.id}/duplicate`, {
        method: "POST",
        json: {},
      });
      setProjects((rows) => [data.project, ...(rows ?? [])]);
      toast(`Duplicated as "${data.project.name}".`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not duplicate the project", "error");
    } finally {
      setDuplicating(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Every website-to-app configuration you own. Build, edit or duplicate them any time."
        actions={
          <Link href="/dashboard/builder">
            <Button>
              <Plus className="h-4 w-4" /> New project
            </Button>
          </Link>
        }
      />

      {error && (
        <Alert tone="error" className="mb-5" title="Could not load projects">
          {error}
        </Alert>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects…"
            className="pl-9"
          />
        </div>
        <p className="text-xs text-zinc-500">
          {projects ? `${filtered.length} of ${projects.length} project${projects.length === 1 ? "" : "s"}` : "Loading…"}
        </p>
      </div>

      {!projects ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-48" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Turn a website into an Android or iOS app in a few minutes. You can edit everything later."
          action={
            <Link href="/dashboard/builder">
              <Button>
                <Wand2 className="h-4 w-4" /> Create your first app
              </Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matching projects" description="Try a different name, package ID or repository." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <Card key={project.id} className="group relative flex flex-col p-5 transition-colors hover:border-zinc-700">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/dashboard/projects/${project.id}`} className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400 ring-1 ring-emerald-500/20">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100 group-hover:text-white">{project.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">{project.package_id}</p>
                  </div>
                </Link>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    aria-label="Project actions"
                    onClick={() => setMenu(menu === project.id ? null : project.id)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {menu === project.id && (
                    <>
                      <button
                        className="fixed inset-0 z-10 cursor-default"
                        aria-label="Close menu"
                        onClick={() => setMenu(null)}
                      />
                      <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
                        <Link
                          href={`/dashboard/builder?project=${project.id}`}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                          onClick={() => setMenu(null)}
                        >
                          <Wand2 className="h-3.5 w-3.5" /> Edit configuration
                        </Link>
                        <button
                          onClick={() => duplicate(project)}
                          disabled={duplicating === project.id}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {duplicating === project.id ? "Duplicating…" : "Duplicate"}
                        </button>
                        <button
                          onClick={() => {
                            setMenu(null);
                            setDeleting(project);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete project
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <p className="mt-3 line-clamp-2 min-h-8 text-xs leading-relaxed text-zinc-500">
                {project.description || project.website_url}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {project.platforms.includes("android") && <Badge tone="green">Android</Badge>}
                {project.platforms.includes("ios") && <Badge tone="blue">iOS</Badge>}
                {project.repo_full_name ? (
                  <Badge tone="neutral">
                    <Github className="h-3 w-3" /> {project.repo_private ? "Private repo" : "Public repo"}
                  </Badge>
                ) : (
                  <Badge tone="amber">No repository</Badge>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-800/70 pt-3 text-[11px] text-zinc-600">
                <span>Updated {relativeTime(project.updated_at)}</span>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/projects/${project.id}`} className="font-medium text-emerald-400 hover:text-emerald-300">
                    Open
                  </Link>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this project?"
        description={`"${deleting?.name}" and all its builds and downloads will be permanently deleted. This cannot be undone.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={removeProject} loading={busy}>
              Delete project
            </Button>
          </>
        }
      />
    </div>
  );
}
