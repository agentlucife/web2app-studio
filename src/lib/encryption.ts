import crypto from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = 1;

function getKey(): Buffer {
  const raw = env("ENCRYPTION_KEY");
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not configured. Generate one with `openssl rand -hex 32`."
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).");
  }
  return Buffer.from(raw, "hex");
}

export function encryptionConfigured() {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * AES-256-GCM authenticated encryption.
 * Format: base64url(version || iv || tag || ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, encrypted]).toString("base64url");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const buffer = Buffer.from(payload, "base64url");
  if (buffer.length < 1 + IV_BYTES + 16) throw new Error("Invalid encrypted payload");
  const version = buffer[0];
  if (version !== VERSION) throw new Error(`Unsupported encrypted payload version ${version}`);
  const iv = buffer.subarray(1, 1 + IV_BYTES);
  const tag = buffer.subarray(1 + IV_BYTES, 1 + IV_BYTES + 16);
  const ciphertext = buffer.subarray(1 + IV_BYTES + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function hmacHex(secret: string, value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
