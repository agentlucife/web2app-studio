import { env } from "@/lib/env";
import { hmacHex, timingSafeEqual } from "@/lib/encryption";

function callbackSecret() {
  return (
    env("BUILD_CALLBACK_SECRET") ??
    env("ENCRYPTION_KEY") ??
    ""
  );
}

/**
 * Short-lived, build-scoped token embedded in the GitHub Actions workflow
 * dispatch. It is not the platform secret and cannot be used for any other
 * build. Format: <expiry-ms>.<hmac-sha256(buildId.expiry)>
 */
export function createBuildCallbackToken(buildId: string, ttlMs = 4 * 60 * 60 * 1000) {
  const secret = callbackSecret();
  if (!secret) return "";
  const exp = Date.now() + ttlMs;
  return `${exp}.${hmacHex(secret, `${buildId}.${exp}`)}`;
}

export function verifyBuildCallbackToken(buildId: string, token: string | undefined | null) {
  if (!token) return false;
  const secret = callbackSecret();
  if (!secret) return false;
  const [expRaw, signature] = token.split(".");
  if (!expRaw || !signature) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = hmacHex(secret, `${buildId}.${exp}`);
  return timingSafeEqual(expected, signature);
}

/**
 * Verify GitHub's HMAC-SHA256 webhook signature.
 */
export function verifyGitHubSignature(rawBody: string, signatureHeader: string | null) {
  const secret = env("GITHUB_WEBHOOK_SECRET");
  if (!secret || !signatureHeader) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = hmacHex(secret, rawBody);
  return timingSafeEqual(expected, signatureHeader.slice(7));
}
