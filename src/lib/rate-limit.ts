import { env } from "@/lib/env";

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

function memoryLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowSeconds * 1000 };
  }
  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

async function upstashLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number } | null> {
  const url = env("UPSTASH_REDIS_REST_URL");
  const token = env("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null;
  try {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", `w2a:${key}`],
        ["EXPIRE", `w2a:${key}`, String(windowSeconds), "NX"],
        ["TTL", `w2a:${key}`],
      ]),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Array<{ result?: number }>;
    const count = Number(data[0]?.result ?? 1);
    const ttl = Number(data[2]?.result ?? windowSeconds);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + Math.max(1, ttl) * 1000,
    };
  } catch {
    return null;
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const distributed = await upstashLimit(key, limit, windowSeconds);
  const result = distributed ?? memoryLimit(key, limit, windowSeconds);
  return { ...result, limit };
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  };
}
