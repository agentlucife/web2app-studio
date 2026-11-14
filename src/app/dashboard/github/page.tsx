"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { Github } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
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

type Connection = {
  connected: boolean;
  github_username?: string;
  avatar_url?: string;
  connected_at?: string;
  token_type?: "pat" | "oauth";
  scopes?: string[];
  warnings?: string[];
  encryptionConfigured?: boolean;
  tokenEndpointHint?: string;
  revokeHint?: string;
};

type Repo = {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  canPush: boolean;
  updatedAt: string;
};

export default function GitHubPage() {
  const { toast } = useToast();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [reposError, setReposError] = useState("");
  const [repoFilter, setRepoFilter] = useState("");

  async function load() {
    try {
      const data = await apiFetch<Connection>("/api/github/user");
      setConnection(data);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load GitHub status", "error");
      setConnection({ connected: false });
    }
  }

  async function loadRepos() {
    setReposError("");
    try {
      const data = await apiFetch<{ repos: Repo[] }>("/api/github/repos");
      setRepos(data.repos);
    } catch (error) {
      setReposError(error instanceof Error ? error.message : "Could not load repositories");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connection?.connected && repos === null && !reposError) loadRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.connected]);

  async function oauth() {
    setOauthLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/github`,
          scopes: "repo workflow read:user user:email",
        },
      });
      if (error) throw error;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not start GitHub sign-in", "error");
      setOauthLoading(false);
    }
  }

  async function connectPAT() {
    setConnecting(true);
    try {
      const data = await apiFetch<{ username: string; warnings: string[] }>("/api/github/connect", {
        method: "POST",
        json: { token },
      });
      toast(`Connected to GitHub as ${data.username}.`, "success");
      data.warnings.forEach((warning) => toast(warning, "info"));
      setToken("");
      setRepos(null);
      setReposError("");
      load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "GitHub rejected this token", "error");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await apiFetch("/api/github/connect", { method: "DELETE" });
      setConnection({ connected: false });
      setRepos(null);
      setDisconnectOpen(false);
      toast("GitHub disconnected. Existing repositories are untouched.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not disconnect GitHub", "error");
    } finally {
      setDisconnecting(false);
    }
  }

  const filteredRepos = (repos ?? []).filter((repo) =>
    repo.fullName.toLowerCase().includes(repoFilter.trim().toLowerCase())
  );

  return (
    <div>
      <PageHeader
        eyebrow="Integrations"
        title="GitHub"
        description="Builds use your own GitHub repository and Actions minutes. Tokens are encrypted server-side and never sent to the browser."
        actions={
          <Button variant="outline" onClick={() => {
            setRepos(null);
            setReposError("");
            load();
            loadRepos();
          }}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {!connection ? (
        <Skeleton className="h-52" />
      ) : connection.connected ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader
                title="Connection"
                description="Used for repository access, source pushes and workflow dispatch."
                icon={Github}
                action={<Badge tone="green">Connected</Badge>}
              />
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-4">
                  {connection.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={connection.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-full border border-zinc-700"
                    />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-zinc-800 text-zinc-300">
                      <Github className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{connection.github_username}</p>
                    <p className="text-[11px] text-zinc-500">
                      {connection.token_type === "oauth" ? "GitHub OAuth" : "Personal access token"} · connected{" "}
                      {formatDate(connection.connected_at)}
                    </p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => setDisconnectOpen(true)}>
                    <Unplug className="h-3.5 w-3.5" /> Disconnect
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(connection.scopes ?? []).length === 0 ? (
                    <Badge tone="neutral">Fine-grained token</Badge>
                  ) : (
                    connection.scopes?.map((scope) => (
                      <Badge key={scope} tone={scope === "repo" || scope === "workflow" ? "green" : "neutral"}>
                        {scope}
                      </Badge>
                    ))
                  )}
                </div>

                {(connection.warnings ?? []).map((warning) => (
                  <Alert key={warning} tone="warning" className="mt-4">
                    {warning}
                  </Alert>
                ))}

                <Alert tone="info" className="mt-4" title="Required permissions">
                  Classic token: <code className="rounded bg-black/30 px-1">repo</code> +{" "}
                  <code className="rounded bg-black/30 px-1">workflow</code>. Fine-grained: Contents read/write, Actions
                  read/write, Workflows write, plus Metadata read. Missing permissions cause a real, visible error when you
                  build.
                </Alert>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Your repositories"
                description="Repositories the connected token can push to."
                icon={Lock}
                action={
                  <Input
                    value={repoFilter}
                    onChange={(event) => setRepoFilter(event.target.value)}
                    placeholder="Filter…"
                    className="h-8 w-40 text-xs"
                  />
                }
              />
              <div className="max-h-96 divide-y divide-zinc-800/70 overflow-y-auto">
                {reposError ? (
                  <div className="p-5">
                    <Alert tone="warning">{reposError}</Alert>
                  </div>
                ) : repos === null ? (
                  <div className="flex items-center gap-2 p-5 text-xs text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> Loading repositories…
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <p className="p-5 text-xs text-zinc-500">No repositories match.</p>
                ) : (
                  filteredRepos.map((repo) => (
                    <a
                      key={repo.fullName}
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-900/60"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-800/70 text-zinc-400">
                        <Github className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-200">{repo.fullName}</p>
                        <p className="text-[10px] text-zinc-500">
                          {repo.defaultBranch} · updated {formatDate(repo.updatedAt)}
                        </p>
                      </div>
                      {repo.private ? <Badge tone="neutral">Private</Badge> : <Badge tone="amber">Public</Badge>}
                      {!repo.canPush && <Badge tone="red">read-only</Badge>}
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-600" />
                    </a>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Token safety
              </p>
              <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-zinc-500">
                <li>• Encrypted with AES-256-GCM before it reaches the database.</li>
                <li>• Never returned by an API route or rendered in the browser.</li>
                <li>• Decrypted only inside server routes that call GitHub.</li>
                <li>• A database trigger revokes browser column access.</li>
              </ul>
              <div className="mt-4 flex flex-col gap-2">
                {connection.revokeHint && (
                  <a href={connection.revokeHint} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="w-full">
                      Manage tokens on GitHub <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-sm font-semibold text-zinc-200">iOS & Android signing</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Signing secrets are repository secrets, never platform secrets. Add them in GitHub → Settings → Secrets and
                variables → Actions:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-black/50 p-3 text-[10px] leading-relaxed text-zinc-400">
{`ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
IOS_BUILD_CERTIFICATE_BASE64
IOS_BUILD_CERTIFICATE_PASSWORD
IOS_PROVISIONING_PROFILE_BASE64
IOS_TEAM_ID`}
              </pre>
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                Without Android secrets, release builds fail clearly. Without Apple secrets, the iOS workflow produces an
                unsigned archive that is not installable.
              </p>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Sign in with GitHub" description="Fastest option. Grants repository and workflow access through Supabase OAuth." icon={Github} />
            <div className="space-y-4 p-5">
              <p className="text-xs leading-relaxed text-zinc-400">
                Re-authenticating with GitHub stores the provider token encrypted on the server. You stay signed in to
                Web2App Studio and can immediately create repositories.
              </p>
              <Button onClick={oauth} loading={oauthLoading} className="w-full">
                {!oauthLoading && <Github className="h-4 w-4" />} Continue with GitHub
              </Button>
              <Alert tone="info">
                If OAuth is not configured in Supabase, use a personal access token below.
              </Alert>
            </div>
          </Card>

          <Card>
            <CardHeader title="Connect a personal access token" description="Works without configuring an OAuth app." icon={KeyRound} />
            <div className="space-y-4 p-5">
              <Field
                label="Fine-grained or classic token"
                htmlFor="pat"
                hint={connection.encryptionConfigured === false ? "Server encryption is not configured" : "Encrypted at rest"}
              >
                <Input
                  id="pat"
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="github_pat_… or ghp_…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-[11px] leading-relaxed text-zinc-500">
                Required scopes:
                <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                  <li>Classic: <code className="text-zinc-300">repo</code>, <code className="text-zinc-300">workflow</code></li>
                  <li>Fine-grained: Contents, Actions and Workflows read/write</li>
                </ul>
              </div>
              {connection.tokenEndpointHint && (
                <a href={connection.tokenEndpointHint} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300">
                  Create a token on GitHub <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <Button onClick={connectPAT} loading={connecting} disabled={!token.trim()} className="w-full">
                <Lock className="h-4 w-4" /> Connect token
              </Button>
              {connection.encryptionConfigured === false && (
                <Alert tone="error" title="ENCRYPTION_KEY missing">
                  The server cannot store tokens securely until ENCRYPTION_KEY is configured. Add a 64-character hex key and
                  redeploy.
                </Alert>
              )}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="How builds use GitHub" icon={CheckCircle2} />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              {[
                {
                  title: "1 · Generate",
                  body: "The server writes a real Capacitor project with your icon, splash, colours and native permissions.",
                },
                {
                  title: "2 · Push",
                  body: "Source is committed atomically to your repository using the GitHub Git Data API.",
                },
                {
                  title: "3 · Compile",
                  body: "GitHub Actions runs Gradle or Xcode. The server verifies and stores the resulting artifact privately.",
                },
              ].map((step) => (
                <div key={step.title} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                  <p className="text-xs font-semibold text-emerald-300">{step.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{step.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        title="Disconnect GitHub?"
        description="Builds and source pushes will stop working until you reconnect. Existing repositories and workflow runs are not affected."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisconnectOpen(false)} disabled={disconnecting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={disconnect} loading={disconnecting}>
              <AlertTriangle className="h-4 w-4" /> Disconnect
            </Button>
          </>
        }
      />
    </div>
  );
}
