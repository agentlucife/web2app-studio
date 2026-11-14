"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Lock,
  Mail,
  ShieldAlert,
  Trash2,
  User,
} from "lucide-react";
import { Github } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  useToast,
} from "@/components/ui";
import { apiFetch, formatDate } from "@/lib/client";

type SettingsData = {
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    github_username: string | null;
    role: "user" | "admin";
    created_at: string;
  };
  email: string | null;
  subscription: { plan: string; status: string; current_period_end: string | null } | null;
  github: { github_username: string | null; connected_at: string; token_type: string } | null;
  configuration: Array<{ name: string; configured: boolean; required: boolean }>;
};

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch<SettingsData>("/api/settings")
      .then((response) => {
        setData(response);
        setFullName(response.profile.full_name ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load settings"));
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const response = await apiFetch<{ profile: SettingsData["profile"] }>("/api/settings", {
        method: "PATCH",
        json: { fullName },
      });
      setData((current) => (current ? { ...current, profile: response.profile } : current));
      toast("Profile saved.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the profile", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await apiFetch("/api/settings", { method: "DELETE", json: { confirmation } });
      router.replace("/login?deleted=1");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the account", "error");
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Settings" />
        <Alert tone="error" title="Could not load settings">{error}</Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, plan and server configuration status."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Profile" description="Shown inside the dashboard. Your GitHub avatar comes from OAuth." icon={User} />
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-4">
                {data.profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.profile.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 rounded-full border border-zinc-700"
                  />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-full border border-zinc-700 bg-zinc-800 text-lg font-bold text-zinc-300">
                    {(fullName || data.profile.email || "U")[0]?.toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{data.profile.full_name || "No display name"}</p>
                  <p className="text-xs text-zinc-500">{data.profile.email}</p>
                  <div className="mt-1 flex gap-1.5">
                    <Badge tone={data.profile.role === "admin" ? "purple" : "neutral"}>{data.profile.role}</Badge>
                    <Badge tone="neutral">joined {formatDate(data.profile.created_at)}</Badge>
                  </div>
                </div>
              </div>

              <Field label="Display name" htmlFor="full-name" hint="Optional">
                <Input
                  id="full-name"
                  value={fullName}
                  maxLength={80}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                />
              </Field>

              <Field label="Email" htmlFor="email" hint="Managed by GitHub OAuth">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <Input id="email" value={data.email ?? ""} disabled className="pl-9" />
                </div>
              </Field>

              <Button onClick={saveProfile} loading={saving}>
                Save profile
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Integrations" icon={Github} />
            <div className="divide-y divide-zinc-800/70">
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-zinc-200">GitHub</p>
                  <p className="text-[11px] text-zinc-500">
                    {data.github
                      ? `Connected as ${data.github.github_username ?? "GitHub user"} · ${data.github.token_type === "oauth" ? "OAuth" : "PAT"}`
                      : "Not connected"}
                  </p>
                </div>
                <Link href="/dashboard/github">
                  <Button variant="outline" size="sm">
                    {data.github ? "Manage" : "Connect"}
                  </Button>
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Plan</p>
                  <p className="text-[11px] capitalize text-zinc-500">
                    {data.subscription?.plan ?? "free"} · {data.subscription?.status ?? "active"}
                  </p>
                </div>
                <Link href="/dashboard/billing">
                  <Button variant="outline" size="sm">Billing</Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card className="border-red-500/20">
            <CardHeader
              title="Danger zone"
              description="Permanent actions. These cannot be undone."
              icon={ShieldAlert}
              className="border-red-500/20"
            />
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-200">Delete account</p>
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Deletes your profile, projects, builds, artifacts, connections and support tickets. Your GitHub repository
                  is not deleted.
                </p>
              </div>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete account
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Server configuration" description="Non-secret status only." icon={Lock} />
            <div className="divide-y divide-zinc-800/70">
              {data.configuration.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <code className="truncate text-[10px] text-zinc-400">{item.name}</code>
                  {item.configured ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> set
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
                      <CircleAlert className="h-3 w-3" /> {item.required ? "required" : "optional"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-zinc-200">Need help?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              Support tickets are answered by the platform admin. Include the build ID for build-specific issues.
            </p>
            <Link href="/dashboard/support" className="mt-3 block">
              <Button variant="outline" size="sm" className="w-full">Open support</Button>
            </Link>
          </Card>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmation("");
        }}
        title="Delete your account permanently?"
        description="This removes every project, build, log and artifact owned by your account. Your GitHub repository, workflow runs and signing secrets remain on GitHub."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false);
                setConfirmation("");
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={deleteAccount}
              loading={deleting}
              disabled={confirmation !== "DELETE"}
            >
              Delete forever
            </Button>
          </>
        }
      >
        <Field label='Type DELETE to confirm' htmlFor="delete-confirmation">
          <Input
            id="delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </Field>
      </Modal>
    </div>
  );
}
