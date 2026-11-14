export class ApiClientError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, headers, ...rest } = options;
  const response = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json().catch(() => null)) as Record<string, unknown> | null)
    : null;

  if (!response.ok) {
    const message =
      (typeof payload?.error === "string" && payload.error) ||
      `Request failed (${response.status})`;
    const code = typeof payload?.code === "string" ? payload.code : undefined;
    throw new ApiClientError(message, response.status, code);
  }
  return (payload ?? {}) as T;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((then - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
  ];
  let duration = seconds;
  for (const [unit, span] of ranges) {
    if (Math.abs(duration) < span) return formatter.format(Math.round(duration), unit);
    duration /= span;
  }
  return formatter.format(Math.round(duration), "year");
}

export type StatusTone = "neutral" | "green" | "amber" | "red" | "blue";

export function buildStatusMeta(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case "queued":
      return { label: "Queued", tone: "neutral" };
    case "preparing":
      return { label: "Preparing", tone: "blue" };
    case "building":
      return { label: "Building", tone: "amber" };
    case "uploading":
      return { label: "Verifying", tone: "blue" };
    case "completed":
      return { label: "Completed", tone: "green" };
    case "failed":
      return { label: "Failed", tone: "red" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export function buildTypeLabel(type: string) {
  switch (type) {
    case "debug":
      return "Debug APK";
    case "release-apk":
      return "Signed APK";
    case "release-aab":
      return "Play Store AAB";
    case "ios-archive":
      return "iOS Archive";
    case "ios-ipa":
      return "Signed IPA";
    default:
      return type;
  }
}

export function artifactKindLabel(kind: string) {
  switch (kind) {
    case "apk":
      return "APK";
    case "aab":
      return "AAB";
    case "ipa":
      return "IPA";
    case "xcarchive":
      return "XCArchive";
    case "source":
      return "Source ZIP";
    case "log":
      return "Log";
    default:
      return kind.toUpperCase();
  }
}

export function isRunningStatus(status: string) {
  return ["queued", "preparing", "building", "uploading"].includes(status);
}
