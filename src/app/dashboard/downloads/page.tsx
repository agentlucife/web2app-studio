"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  FileArchive,
  Filter,
  Package,
  Search,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";
import {
  apiFetch,
  artifactKindLabel,
  buildTypeLabel,
  formatBytes,
  formatDate,
} from "@/lib/client";

type Artifact = {
  id: string;
  build_id: string | null;
  project_id: string | null;
  project_name: string;
  platform: string | null;
  build_type: string | null;
  name: string;
  size_bytes: number | null;
  kind: string;
  checksum: string | null;
  created_at: string;
};

const KINDS = ["", "apk", "aab", "ipa", "xcarchive", "source"];

export default function DownloadsPage() {
  const { toast } = useToast();
  const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ artifacts: Artifact[] }>("/api/artifacts")
      .then((data) => setArtifacts(data.artifacts))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load downloads"));
  }, []);

  const filtered = useMemo(() => {
    const rows = artifacts ?? [];
    const term = search.trim().toLowerCase();
    return rows.filter((artifact) => {
      if (kind && artifact.kind !== kind) return false;
      if (!term) return true;
      return [artifact.name, artifact.project_name, artifact.build_type ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [artifacts, kind, search]);

  async function download(artifact: Artifact) {
    setDownloading(artifact.id);
    try {
      const result = await apiFetch<{ url: string; expiresInSeconds: number }>(
        `/api/artifacts/${artifact.id}/download`
      );
      window.open(result.url, "_blank", "noopener,noreferrer");
      toast(`Secure download link created (${Math.round(result.expiresInSeconds / 60)} min).`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create a download link", "error");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Artifacts"
        title="Downloads"
        description="APKs, AABs, IPAs and source archives stored in a private bucket. Links are signed and expire."
      />

      {error && (
        <Alert tone="error" className="mb-5" title="Could not load downloads">
          {error}
        </Alert>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files or projects…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          <Select value={kind} onChange={(event) => setKind(event.target.value)} className="w-40">
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {value ? artifactKindLabel(value) : "All file types"}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-zinc-500 sm:ml-auto">
          {artifacts ? `${filtered.length} file${filtered.length === 1 ? "" : "s"}` : "Loading…"}
        </p>
      </div>

      {!artifacts ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : artifacts.length === 0 ? (
        <EmptyState
          icon={FileArchive}
          title="No downloads yet"
          description="Completed builds produce verified artifacts here. Start an Android or iOS build to see them."
          action={
            <Link href="/dashboard/builds">
              <Button size="sm">View builds</Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matching files" description="Change the search or file type filter." />
      ) : (
        <Card className="divide-y divide-zinc-800/70 overflow-hidden">
          {filtered.map((artifact) => (
            <div key={artifact.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-zinc-800/70 text-zinc-400">
                {artifact.kind === "source" ? <Package className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-zinc-200">{artifact.name}</p>
                  <Badge
                    tone={
                      artifact.kind === "apk" || artifact.kind === "aab" || artifact.kind === "ipa"
                        ? "green"
                        : artifact.kind === "xcarchive"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {artifactKindLabel(artifact.kind)}
                  </Badge>
                  {artifact.kind === "xcarchive" && <Badge tone="amber">Not installable</Badge>}
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {artifact.project_name}
                  {artifact.build_type ? ` · ${buildTypeLabel(artifact.build_type)}` : ""} ·{" "}
                  {formatBytes(artifact.size_bytes)} · {formatDate(artifact.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 pl-13 sm:pl-0">
                {artifact.build_id && (
                  <Link href={`/dashboard/builds/${artifact.build_id}`}>
                    <Button variant="ghost" size="sm">
                      Build <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
                <Button size="sm" variant="outline" loading={downloading === artifact.id} onClick={() => download(artifact)}>
                  {downloading !== artifact.id && <Download className="h-3.5 w-3.5" />} Download
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-[11px] leading-relaxed text-zinc-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <p>
          Artifacts are never public. Each download button asks the server for a short-lived signed URL after verifying that
          the file belongs to your account. iOS archives produced without Apple signing secrets cannot be installed on a
          device.
        </p>
      </div>
    </div>
  );
}
