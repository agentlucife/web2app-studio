import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
  "169.254.169.254",
]);

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".localdomain",
  ".home.arpa",
  ".in-addr.arpa",
  ".ip6.arpa",
];

function ipv4ToNumber(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const value = ipv4ToNumber(ip);
    const ranges: Array<[string, number]> = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    return ranges.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToNumber(base) & mask);
    });
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice(7);
      if (net.isIP(mapped) === 4) return isPrivateIp(mapped);
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
        normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    if (normalized.startsWith("ff")) return true;
    if (normalized.startsWith("2001:db8")) return true;
    return false;
  }
  return true;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export type SafeUrlResult = {
  url: URL;
  addresses: string[];
};

/**
 * Validate a URL that the platform (or a generated app) will load.
 * Blocks non-HTTP schemes, credentials, localhost, private/reserved IP
 * ranges, cloud metadata hosts and DNS names that resolve to private IPs.
 */
export async function assertSafePublicUrl(raw: string): Promise<SafeUrlResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Enter a valid absolute URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Only http:// and https:// URLs are allowed");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs containing credentials are not allowed");
  }
  if (!url.hostname) throw new UnsafeUrlError("URL must include a hostname");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeUrlError("Local and cloud metadata addresses are not allowed");
  }
  if (BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new UnsafeUrlError("Private network hostnames are not allowed");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeUrlError("Private, loopback and link-local IP addresses are not allowed");
    }
    return { url, addresses: [hostname] };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("The hostname could not be resolved");
  }
  if (records.length === 0) {
    throw new UnsafeUrlError("The hostname could not be resolved");
  }
  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new UnsafeUrlError(
        "This hostname resolves to a private or reserved network address"
      );
    }
  }
  return { url, addresses: records.map((record) => record.address) };
}

export function isSafeRedirectTarget(from: string, to: string) {
  try {
    const fromUrl = new URL(from);
    const toUrl = new URL(to, fromUrl);
    return (
      (toUrl.protocol === "http:" || toUrl.protocol === "https:") &&
      !toUrl.username &&
      !toUrl.password
    );
  } catch {
    return false;
  }
}
