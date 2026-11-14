"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brush,
  Check,
  Globe,
  Image as ImageIcon,
  Info,
  Layers,
  Link2,
  Loader2,
  Package,
  Paintbrush,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  Smartphone,
  Upload,
  Wand2,
} from "lucide-react";
import { Github } from "@/components/icons";
import type { AppConfig } from "@/lib/schemas";
import { apiFetch } from "@/lib/client";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  cn,
  useToast,
} from "@/components/ui";

const DEFAULT_FEATURES: AppConfig["features"] = {
  camera: false,
  gallery: false,
  fileUploads: false,
  fileDownloads: false,
  location: false,
  pushNotifications: false,
  share: false,
  deepLinks: false,
  biometric: false,
  statusBar: true,
  offlinePage: true,
};

function defaultConfig(): AppConfig {
  return {
    appName: "",
    packageId: "com.example.myapp",
    websiteUrl: "",
    description: "",
    versionName: "1.0.0",
    versionCode: 1,
    platforms: { android: true, ios: false },
    theme: "system",
    colors: {
      primary: "#10b981",
      splashBackground: "#0a0a0a",
      statusBar: "#0a0a0a",
      navigationBar: "#0a0a0a",
    },
    navigation: {
      externalLinks: "external-browser",
      allowNavigation: [],
      showLoadingIndicator: true,
    },
    features: { ...DEFAULT_FEATURES },
    deepLink: {},
    assets: {},
  };
}

function normalizeConfig(raw: unknown): AppConfig {
  const base = defaultConfig();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Record<string, unknown>;
  return {
    ...base,
    ...value,
    platforms: { ...base.platforms, ...((value.platforms as object) ?? {}) },
    colors: { ...base.colors, ...((value.colors as object) ?? {}) },
    navigation: { ...base.navigation, ...((value.navigation as object) ?? {}) },
    features: { ...base.features, ...((value.features as object) ?? {}) },
    deepLink: { ...base.deepLink, ...((value.deepLink as object) ?? {}) },
    assets: { ...base.assets, ...((value.assets as object) ?? {}) },
  } as AppConfig;
}

type Repo = {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  canPush: boolean;
};

type ProjectResponse = {
  project: {
    id: string;
    name: string;
    description: string | null;
    config: Record<string, unknown>;
    repo_full_name: string | null;
    repo_private: boolean;
    icon_preview_url: string | null;
    splash_preview_url: string | null;
  };
};

const TABS = [
  { id: "basics", label: "Basics", icon: Info },
  { id: "design", label: "Appearance", icon: Paintbrush },
  { id: "features", label: "Features", icon: Layers },
  { id: "repository", label: "Repository", icon: Github },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function BuilderClient() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const iconInput = useRef<HTMLInputElement>(null);
  const splashInput = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repoFullName, setRepoFullName] = useState("");
  const [repoPrivate, setRepoPrivate] = useState(true);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [splashUrl, setSplashUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("basics");
  const [loading, setLoading] = useState(Boolean(projectId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"icon" | "splash" | null>(null);
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [reposError, setReposError] = useState("");
  const [repoPrivateTouched, setRepoPrivateTouched] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    apiFetch<ProjectResponse>(`/api/projects/${projectId}`)
      .then((data) => {
        if (!alive) return;
        const project = data.project;
        setName(project.name);
        setDescription(project.description ?? "");
        setConfig(normalizeConfig(project.config));
        setRepoFullName(project.repo_full_name ?? "");
        setRepoPrivate(project.repo_private);
        setRepoPrivateTouched(true);
        setIconUrl(project.icon_preview_url);
        setSplashUrl(project.splash_preview_url);
      })
      .catch((error) => {
        toast(error instanceof Error ? error.message : "Could not load the project", "error");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [projectId, toast]);

  useEffect(() => {
    if (tab !== "repository" || repos || reposError) return;
    apiFetch<{ repos: Repo[] }>("/api/github/repos")
      .then((data) => setRepos(data.repos))
      .catch((error) => setReposError(error instanceof Error ? error.message : "GitHub is not connected"));
  }, [tab, repos, reposError]);

  function patch(update: Partial<AppConfig>) {
    setConfig((current) => ({ ...current, ...update }));
  }

  function patchFeature(key: keyof AppConfig["features"], value: boolean) {
    setConfig((current) => ({ ...current, features: { ...current.features, [key]: value } }));
  }

  function generatePackageId() {
    try {
      const hostname = new URL(config.websiteUrl).hostname.replace(/^www\./, "");
      const parts = hostname.split(".").reverse().filter(Boolean);
      const cleaned = parts
        .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
        .filter(Boolean)
        .map((part) => (/^[a-zA-Z]/.test(part) ? part : `app${part}`));
      if (cleaned.length === 0) throw new Error("invalid");
      patch({ packageId: ["com", ...cleaned].join(".").slice(0, 120) });
      toast("Package ID generated from the website domain.", "success");
    } catch {
      toast("Add a valid website URL first.", "error");
    }
  }

  async function upload(kind: "icon" | "splash", file: File | undefined) {
    if (!file) return;
    setUploading(kind);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      const data = await apiFetch<{ path: string; url: string }>("/api/uploads", {
        method: "POST",
        body: form,
      });
      if (kind === "icon") {
        setIconUrl(data.url);
        patch({ assets: { ...config.assets, iconPath: data.path } });
      } else {
        setSplashUrl(data.url);
        patch({ assets: { ...config.assets, splashPath: data.path } });
      }
      toast(`${kind === "icon" ? "App icon" : "Splash screen"} uploaded and resized.`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Upload failed", "error");
    } finally {
      setUploading(null);
    }
  }

  const hostname = useMemo(() => {
    try {
      return new URL(config.websiteUrl).hostname;
    } catch {
      return "your-website.com";
    }
  }, [config.websiteUrl]);

  async function save() {
    if (!config.appName.trim()) {
      setTab("basics");
      toast("Give your app a name.", "error");
      return;
    }
    if (!config.websiteUrl.trim()) {
      setTab("basics");
      toast("Add the website URL the app should load.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || config.appName.trim(),
        description,
        config,
        repoFullName: repoFullName.trim() || undefined,
        repoPrivate,
      };
      const data = projectId
        ? await apiFetch<{ project: { id: string } }>("/api/projects", {
            method: "PATCH",
            json: { id: projectId, ...payload },
          })
        : await apiFetch<{ project: { id: string } }>("/api/projects", {
            method: "POST",
            json: payload,
          });
      toast(projectId ? "Project configuration saved." : "Project created. You can build it now.", "success");
      router.push(`/dashboard/projects/${data.project.id}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the project", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> Loading project…
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={projectId ? "Edit project" : "New project"}
        title={projectId ? "Edit app configuration" : "Create a website app"}
        description="Everything here is written into the generated Capacitor project. You can change it later and rebuild."
        actions={
          <>
            <Link href={projectId ? `/dashboard/projects/${projectId}` : "/dashboard/projects"}>
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4" /> Cancel
              </Button>
            </Link>
            <Button onClick={save} loading={saving}>
              <Save className="h-4 w-4" /> {projectId ? "Save changes" : "Create project"}
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              tab === item.id ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {tab === "basics" && (
            <Card>
              <CardHeader title="App basics" description="The identity shown on the device and in the stores." icon={Smartphone} />
              <div className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Project name" htmlFor="project-name" hint="Internal only" required>
                    <Input
                      id="project-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="My business app"
                    />
                  </Field>
                  <Field label="App name" htmlFor="app-name" hint="Shown under the icon" required>
                    <Input
                      id="app-name"
                      value={config.appName}
                      maxLength={60}
                      onChange={(event) => patch({ appName: event.target.value })}
                      placeholder="My App"
                    />
                  </Field>
                </div>

                <Field label="Website URL" htmlFor="website-url" hint="HTTPS only" required>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      id="website-url"
                      value={config.websiteUrl}
                      onChange={(event) => patch({ websiteUrl: event.target.value })}
                      placeholder="https://example.com"
                      className="pl-9"
                      inputMode="url"
                    />
                  </div>
                </Field>

                <Field label="Application / bundle ID" htmlFor="package-id" hint="Reverse-DNS, unique per app" required>
                  <div className="flex gap-2">
                    <Input
                      id="package-id"
                      value={config.packageId}
                      onChange={(event) => patch({ packageId: event.target.value })}
                      placeholder="com.example.myapp"
                      className="font-mono text-xs"
                    />
                    <Button type="button" variant="outline" onClick={generatePackageId} className="shrink-0">
                      <Wand2 className="h-4 w-4" /> Generate
                    </Button>
                  </div>
                </Field>

                <Field label="Description" htmlFor="project-description" hint="Optional">
                  <Textarea
                    id="project-description"
                    value={description}
                    maxLength={500}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="A short description of the app."
                    className="min-h-20"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Version name" htmlFor="version-name" hint="Shown to users">
                    <Input
                      id="version-name"
                      value={config.versionName}
                      onChange={(event) => patch({ versionName: event.target.value })}
                      placeholder="1.0.0"
                    />
                  </Field>
                  <Field label="Version code" htmlFor="version-code" hint="Must increase per store upload">
                    <Input
                      id="version-code"
                      type="number"
                      min={1}
                      value={config.versionCode}
                      onChange={(event) => patch({ versionCode: Number(event.target.value) || 1 })}
                    />
                  </Field>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-300">Platforms</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Checkbox
                      label="Android"
                      description="APK for testing, signed APK/AAB for stores."
                      checked={config.platforms.android}
                      onChange={(checked) =>
                        patch({ platforms: { ...config.platforms, android: checked } })
                      }
                    />
                    <Checkbox
                      label="iOS"
                      description="Unsigned archive by default; IPA with Apple signing."
                      checked={config.platforms.ios}
                      onChange={(checked) => patch({ platforms: { ...config.platforms, ios: checked } })}
                    />
                  </div>
                  {!config.platforms.android && !config.platforms.ios && (
                    <p className="mt-2 text-xs text-red-400">Select at least one platform.</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {tab === "design" && (
            <>
              <Card>
                <CardHeader title="Icons and splash" description="Images are converted on the server to the sizes native projects expect." icon={ImageIcon} />
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
                        {iconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={iconUrl} alt="Icon preview" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-6 w-6 text-zinc-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">App icon</p>
                        <p className="text-[11px] text-zinc-500">PNG, JPEG or WebP · resized to 1024×1024</p>
                      </div>
                    </div>
                    <input
                      ref={iconInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => upload("icon", event.target.files?.[0])}
                    />
                    <div className="mt-4 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={uploading === "icon"}
                        onClick={() => iconInput.current?.click()}
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload icon
                      </Button>
                      {config.assets.iconPath && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            patch({ assets: { ...config.assets, iconPath: undefined } });
                            setIconUrl(null);
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-16 w-24 place-items-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
                        {splashUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={splashUrl} alt="Splash preview" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-zinc-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">Splash screen</p>
                        <p className="text-[11px] text-zinc-500">Square source · resized to 2732×2732</p>
                      </div>
                    </div>
                    <input
                      ref={splashInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => upload("splash", event.target.files?.[0])}
                    />
                    <div className="mt-4 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={uploading === "splash"}
                        onClick={() => splashInput.current?.click()}
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload splash
                      </Button>
                      {config.assets.splashPath && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            patch({ assets: { ...config.assets, splashPath: undefined } });
                            setSplashUrl(null);
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Theme and colours" description="Applied to the status bar, navigation bar and splash screen." icon={Brush} />
                <div className="space-y-4 p-5">
                  <Field label="Theme" htmlFor="theme" className="max-w-xs">
                    <Select id="theme" value={config.theme} onChange={(event) => patch({ theme: event.target.value as AppConfig["theme"] })}>
                      <option value="system">Follow device</option>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </Select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        ["primary", "Primary / accent"],
                        ["splashBackground", "Splash background"],
                        ["statusBar", "Status bar"],
                        ["navigationBar", "Navigation bar"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <p className="mb-1.5 text-xs font-medium text-zinc-300">{label}</p>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            aria-label={`${label} colour`}
                            value={config.colors[key]}
                            onChange={(event) =>
                              patch({ colors: { ...config.colors, [key]: event.target.value } })
                            }
                            className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 p-1"
                          />
                          <Input
                            value={config.colors[key]}
                            onChange={(event) =>
                              patch({ colors: { ...config.colors, [key]: event.target.value } })
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Navigation" description="Control how links and loading behave inside the WebView." icon={Link2} />
                <div className="space-y-4 p-5">
                  <Field label="External links" htmlFor="external-links" hint="Links outside your host">
                    <Select
                      id="external-links"
                      value={config.navigation.externalLinks}
                      onChange={(event) =>
                        patch({
                          navigation: {
                            ...config.navigation,
                            externalLinks: event.target.value as "in-app" | "external-browser",
                          },
                        })
                      }
                      className="max-w-xs"
                    >
                      <option value="external-browser">Open in the system browser</option>
                      <option value="in-app">Keep inside the app</option>
                    </Select>
                  </Field>
                  <Field
                    label="Allowed navigation hosts"
                    htmlFor="allow-navigation"
                    hint="Comma separated, optional"
                  >
                    <Input
                      id="allow-navigation"
                      value={config.navigation.allowNavigation.join(", ")}
                      onChange={(event) =>
                        patch({
                          navigation: {
                            ...config.navigation,
                            allowNavigation: event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      placeholder="accounts.example.com, checkout.example.com"
                    />
                  </Field>
                  <Checkbox
                    label="Show a loading indicator"
                    description="Display a spinner while the website loads."
                    checked={config.navigation.showLoadingIndicator}
                    onChange={(checked) =>
                      patch({ navigation: { ...config.navigation, showLoadingIndicator: checked } })
                    }
                  />
                </div>
              </Card>
            </>
          )}

          {tab === "features" && (
            <>
              <Card>
                <CardHeader title="Native features" description="Only enable what your website actually uses." icon={Layers} />
                <div className="grid gap-2.5 p-5 sm:grid-cols-2">
                  <Checkbox
                    label="Camera"
                    description="Take photos inside the WebView."
                    checked={config.features.camera}
                    onChange={(checked) => patchFeature("camera", checked)}
                  />
                  <Checkbox
                    label="Photo gallery"
                    description="Choose existing pictures."
                    checked={config.features.gallery}
                    onChange={(checked) => patchFeature("gallery", checked)}
                  />
                  <Checkbox
                    label="File uploads"
                    description="Upload documents through file inputs."
                    checked={config.features.fileUploads}
                    onChange={(checked) => patchFeature("fileUploads", checked)}
                  />
                  <Checkbox
                    label="File downloads"
                    description="Save files from the website to the device."
                    checked={config.features.fileDownloads}
                    onChange={(checked) => patchFeature("fileDownloads", checked)}
                  />
                  <Checkbox
                    label="Location"
                    description="Ask for foreground location access."
                    checked={config.features.location}
                    onChange={(checked) => patchFeature("location", checked)}
                  />
                  <Checkbox
                    label="Push notifications"
                    description="Requires a private repository and Firebase/APNs setup."
                    checked={config.features.pushNotifications}
                    onChange={(checked) => patchFeature("pushNotifications", checked)}
                  />
                  <Checkbox
                    label="Share sheet"
                    description="Share links using the native sheet."
                    checked={config.features.share}
                    onChange={(checked) => patchFeature("share", checked)}
                  />
                  <Checkbox
                    label="Biometric unlock"
                    description="Gate the app behind Face ID / fingerprint."
                    checked={config.features.biometric}
                    onChange={(checked) => patchFeature("biometric", checked)}
                  />
                  <Checkbox
                    label="Status bar control"
                    description="Match the status bar to your theme."
                    checked={config.features.statusBar}
                    onChange={(checked) => patchFeature("statusBar", checked)}
                  />
                  <Checkbox
                    label="Offline fallback page"
                    description="Show a friendly page when the device is offline."
                    checked={config.features.offlinePage}
                    onChange={(checked) => patchFeature("offlinePage", checked)}
                  />
                </div>
              </Card>

              <Card>
                <CardHeader title="Deep links" description="Open the app from a custom scheme or an https host." icon={Link2} />
                <div className="space-y-4 p-5">
                  <Checkbox
                    label="Enable deep links"
                    description="Adds intent filters / associated domains to the native project."
                    checked={config.features.deepLinks}
                    onChange={(checked) => patchFeature("deepLinks", checked)}
                  />
                  {config.features.deepLinks && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Custom scheme" htmlFor="deep-scheme" hint="e.g. myapp">
                        <Input
                          id="deep-scheme"
                          value={config.deepLink.scheme ?? ""}
                          onChange={(event) =>
                            patch({ deepLink: { ...config.deepLink, scheme: event.target.value || undefined } })
                          }
                          placeholder="myapp"
                        />
                      </Field>
                      <Field label="HTTPS host" htmlFor="deep-host" hint="e.g. app.example.com">
                        <Input
                          id="deep-host"
                          value={config.deepLink.host ?? ""}
                          onChange={(event) =>
                            patch({ deepLink: { ...config.deepLink, host: event.target.value || undefined } })
                          }
                          placeholder="app.example.com"
                        />
                      </Field>
                      <Field label="Path prefix" htmlFor="deep-path" hint="Optional">
                        <Input
                          id="deep-path"
                          value={config.deepLink.pathPrefix ?? ""}
                          onChange={(event) =>
                            patch({ deepLink: { ...config.deepLink, pathPrefix: event.target.value || undefined } })
                          }
                          placeholder="/app"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {tab === "repository" && (
            <Card>
              <CardHeader
                title="GitHub repository"
                description="Generated source is pushed here and GitHub Actions compiles the native app."
                icon={Github}
                action={
                  <Link href="/dashboard/github">
                    <Button variant="ghost" size="sm">
                      Manage GitHub
                    </Button>
                  </Link>
                }
              />

              <div className="space-y-4 p-5">
                {reposError ? (
                  <Alert tone="warning" title="GitHub is not ready">
                    {reposError}
                    <Link href="/dashboard/github" className="ml-1 font-semibold underline underline-offset-2">
                      Connect GitHub →
                    </Link>
                  </Alert>
                ) : (
                  <Field label="Choose a repository" htmlFor="repo-select" hint={repos ? `${repos.length} loaded` : "Loading…"}>
                    <Select
                      id="repo-select"
                      value={repoFullName}
                      onChange={(event) => {
                        const value = event.target.value;
                        setRepoFullName(value);
                        const found = repos?.find((repo) => repo.fullName === value);
                        if (found && !repoPrivateTouched) setRepoPrivate(found.private);
                      }}
                    >
                      <option value="">No repository yet</option>
                      {repoFullName && !repos?.some((repo) => repo.fullName === repoFullName) && (
                        <option value={repoFullName}>{repoFullName}</option>
                      )}
                      {(repos ?? []).map((repo) => (
                        <option key={repo.fullName} value={repo.fullName}>
                          {repo.fullName} {repo.private ? "· private" : "· public"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <Field label="Repository (owner/name)" htmlFor="repo-manual" hint="Paste or create one below">
                  <Input
                    id="repo-manual"
                    value={repoFullName}
                    onChange={(event) => setRepoFullName(event.target.value)}
                    placeholder="your-name/my-app"
                  />
                </Field>

                <Checkbox
                  label="Private repository"
                  description="Recommended. Push notification configuration and signing setup must not be public."
                  checked={repoPrivate}
                  onChange={(checked) => {
                    setRepoPrivate(checked);
                    setRepoPrivateTouched(true);
                  }}
                />

                <Alert tone="info" title="Token permissions">
                  Classic tokens need <code className="rounded bg-black/30 px-1">repo</code> and{" "}
                  <code className="rounded bg-black/30 px-1">workflow</code>. Fine-grained tokens need Contents read/write,
                  Actions read/write and Workflows write. The app validates this when you save or build.
                </Alert>

                <CreateRepo
                  onCreated={(repo) => {
                    setRepos((rows) => [repo, ...(rows ?? [])]);
                    setRepoFullName(repo.fullName);
                    setRepoPrivate(repo.private);
                    setRepoPrivateTouched(true);
                    toast("Repository created and selected.", "success");
                  }}
                />
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="text-xs text-zinc-500">
              <Check className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />
              Saved to Supabase, never stored in the generated app.
            </div>
            <Button onClick={save} loading={saving}>
              <Save className="h-4 w-4" /> {projectId ? "Save changes" : "Create project"}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-24 overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3">
              <p className="text-xs font-semibold text-zinc-300">Live preview</p>
              <p className="text-[10px] text-zinc-600">An approximation — the native app uses your real website.</p>
            </div>
            <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 p-5">
              <div className="mx-auto w-full max-w-[15rem] rounded-[2rem] border border-zinc-700 bg-zinc-950 p-2 shadow-2xl">
                <div className="overflow-hidden rounded-[1.5rem] border border-zinc-800">
                  <div className="h-5" style={{ backgroundColor: config.colors.statusBar }} />
                  <div
                    className="flex flex-col items-center justify-center px-4 py-8"
                    style={{ backgroundColor: config.colors.splashBackground }}
                  >
                    <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                      {iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={iconUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Smartphone className="h-7 w-7 text-zinc-500" />
                      )}
                    </div>
                    <p className="mt-3 max-w-full truncate text-center text-sm font-bold text-white">
                      {config.appName || "Your app"}
                    </p>
                    <p className="mt-0.5 max-w-full truncate text-center text-[10px] text-zinc-500">{hostname}</p>
                    <span
                      className="mt-4 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold"
                      style={{ backgroundColor: config.colors.primary, color: "#052e1c" }}
                    >
                      Open website <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="space-y-2 bg-zinc-950 px-3 pb-3 pt-4">
                    <div className="h-2 w-3/4 rounded bg-zinc-800" />
                    <div className="h-2 w-full rounded bg-zinc-800/70" />
                    <div className="h-2 w-5/6 rounded bg-zinc-800/70" />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="h-10 rounded-lg bg-zinc-900" />
                      <div className="h-10 rounded-lg bg-zinc-900" />
                    </div>
                  </div>
                  <div className="flex justify-around border-t border-zinc-800 bg-zinc-950 px-3 py-2" style={{ backgroundColor: config.colors.navigationBar }}>
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="h-1.5 w-6 rounded bg-zinc-700" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2 border-t border-zinc-800 p-4 text-[11px] text-zinc-500">
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> HTTPS enforced by the schema
              </p>
              <p className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-emerald-400" /> Source generated per build
              </p>
              <p className="flex items-center gap-1.5">
                <Rocket className="h-3.5 w-3.5 text-emerald-400" /> Compiled on GitHub Actions
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CreateRepo({ onCreated }: { onCreated: (repo: Repo) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const data = await apiFetch<{ repo: Repo }>("/api/github/repos", {
        method: "POST",
        json: { name, description, private: isPrivate },
      });
      onCreated(data.repo);
      setOpen(false);
      setName("");
      setDescription("");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not create the repository", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Create a new repository
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Repository name" htmlFor="new-repo-name">
          <Input id="new-repo-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="my-app" />
        </Field>
        <Field label="Description" htmlFor="new-repo-desc">
          <Input
            id="new-repo-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Generated by Web2App Studio"
          />
        </Field>
      </div>
      <Checkbox label="Private repository" checked={isPrivate} onChange={setIsPrivate} />
      <div className="flex gap-2">
        <Button size="sm" onClick={create} loading={busy} disabled={!name.trim()}>
          <Plus className="h-3.5 w-3.5" /> Create
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
