import test from "node:test";
import assert from "node:assert/strict";
import {
  decrypt,
  encrypt,
  encryptionConfigured,
  hmacHex,
  timingSafeEqual,
} from "@/lib/encryption";

const ORIGINAL = process.env.ENCRYPTION_KEY;

test.before(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

test.after(() => {
  if (ORIGINAL === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = ORIGINAL;
});

test("encrypt/decrypt round-trips and never returns plaintext", () => {
  const token = "ghp_example_token_value_1234567890";
  const encrypted = encrypt(token);
  assert.notEqual(encrypted, token);
  assert.equal(encrypted.includes(token), false);
  assert.equal(decrypt(encrypted), token);
});

test("encryption is randomised per call", () => {
  assert.notEqual(encrypt("same-value"), encrypt("same-value"));
});

test("tampered ciphertext fails authentication", () => {
  const encrypted = encrypt("secret");
  const buffer = Buffer.from(encrypted, "base64url");
  buffer[buffer.length - 1] ^= 0xff;
  assert.throws(() => decrypt(buffer.toString("base64url")));
});

test("missing or malformed keys are reported as not configured", () => {
  process.env.ENCRYPTION_KEY = "too-short";
  assert.equal(encryptionConfigured(), false);
  assert.throws(() => encrypt("value"), /64 hexadecimal/);
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  assert.equal(encryptionConfigured(), true);
});

test("HMAC and constant-time comparison work", () => {
  const signature = hmacHex("secret", "payload");
  assert.equal(signature, hmacHex("secret", "payload"));
  assert.notEqual(signature, hmacHex("other", "payload"));
  assert.equal(timingSafeEqual(signature, signature), true);
  assert.equal(timingSafeEqual(signature, signature.slice(0, -1)), false);
});
