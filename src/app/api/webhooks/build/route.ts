import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, ApiError } from "@/lib/api";
import { applyBuildCallback, verifyCallbackToken } from "@/lib/builds";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const callbackSchema = z.object({
  build_id: z.string().uuid(),
  token: z.string().min(10).max(200),
  status: z.enum(["building", "uploading", "failed", "cancelled"]),
  message: z.string().max(4000).optional(),
  workflow_run_id: z.union([z.number().int(), z.string()]).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limit = await rateLimit(`webhook:build:${ip}`, 120, 60);
    if (!limit.allowed) throw new ApiError("Too many callbacks", 429);

    const body = callbackSchema.parse(await readJson(request));
    if (!verifyCallbackToken(body.build_id, body.token)) {
      throw new ApiError("Invalid or expired build callback token", 401, "invalid_callback_token");
    }

    const runId =
      body.workflow_run_id === undefined || body.workflow_run_id === ""
        ? null
        : Number(body.workflow_run_id);
    const result = await applyBuildCallback({
      buildId: body.build_id,
      status: body.status,
      message: body.message,
      workflowRunId: Number.isFinite(runId) && runId !== null ? runId : null,
    });

    return NextResponse.json({ ok: true, build: result.build });
  } catch (error) {
    return jsonError(error);
  }
}
