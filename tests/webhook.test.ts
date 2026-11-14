import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createBuildCallbackToken,
  verifyBuildCallbackToken,
  verifyGitHubSignature,
} from "@/lib/webhook";

test.before(() => {
  process.env.BUILD_CALLBACK_SECRET = "callback-secret-for-tests";
  process.env.GITHUB_WEBHOOK_SECRET = "github-webhook-secret-for-tests";
});

test("build callback tokens are build-scoped and expire", () => {
  const token = createBuildCallbackToken("build-123", 60_000);
  assert.ok(token);
  assert.equal(verifyBuildCallbackToken("build-123", token), true);
  assert.equal(verifyBuildCallbackToken("build-456", token), false);
  assert.equal(verifyBuildCallbackToken("build-123", "nonsense"), false);
  assert.equal(verifyBuildCallbackToken("build-123", undefined), false);
});

test("expired build callback tokens are rejected", () => {
  const expired = createBuildCallbackToken("build-123", -1_000);
  assert.equal(verifyBuildCallbackToken("build-123", expired), false);
});

test("GitHub webhook signatures are verified with HMAC-SHA256", () => {
  const body = JSON.stringify({ action: "completed" });
  const signature =
    "sha256=" + crypto.createHmac("sha256", "github-webhook-secret-for-tests").update(body).digest("hex");

  assert.equal(verifyGitHubSignature(body, signature), true);
  assert.equal(verifyGitHubSignature(body + " ", signature), false);
  assert.equal(verifyGitHubSignature(body, "sha1=" + signature.slice(7)), false);
  assert.equal(verifyGitHubSignature(body, null), false);
});
