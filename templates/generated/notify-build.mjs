#!/usr/bin/env node
/**
 * Notify Web2App Studio about workflow progress.
 * The callback token is scoped to a single build and expires quickly, so it
 * is safe to pass through the workflow dispatch inputs.
 */
const status = process.env.BUILD_STATUS ?? process.argv[2] ?? "building";
const message = process.env.BUILD_MESSAGE ?? process.argv[3] ?? "";
const buildId = process.env.BUILD_ID ?? "";
const callbackUrl = process.env.CALLBACK_URL ?? "";
const callbackToken = process.env.CALLBACK_TOKEN ?? "";
const runId = process.env.GITHUB_RUN_ID ?? "";

if (!buildId) {
  console.error("BUILD_ID is missing");
  process.exit(0);
}
if (!callbackUrl || !callbackToken) {
  console.log("No callback configured; skipping notification.");
  process.exit(0);
}

const payload = {
  build_id: buildId,
  status,
  message,
  workflow_run_id: runId ? Number(runId) : null,
  token: callbackToken,
};

try {
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    console.error(`Callback failed with HTTP ${response.status}`);
  } else {
    console.log(`Reported ${status} to Web2App Studio`);
  }
} catch (error) {
  console.error(`Callback failed: ${error instanceof Error ? error.message : String(error)}`);
}
// Never fail the build because a status callback failed.
process.exit(0);
