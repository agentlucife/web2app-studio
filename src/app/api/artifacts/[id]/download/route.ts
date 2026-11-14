import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, requireApiUser, ApiError } from "@/lib/api";
import { ARTIFACTS_BUCKET, createSignedUrl } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import type { Artifact } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const limit = await rateLimit(`artifacts:download:${userId}`, 60, 60);
    if (!limit.allowed) throw new ApiError("Too many downloads. Try again shortly.", 429);

    const { id } = await params;
    const { data, error } = await admin
      .from("artifacts")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ApiError("Could not load the download", 500);
    if (!data) throw new ApiError("Download not found", 404, "artifact_not_found");

    const artifact = data as Artifact;
    const seconds = 300;
    const url = await createSignedUrl(ARTIFACTS_BUCKET, artifact.storage_path, seconds);
    return NextResponse.json(
      {
        url,
        name: artifact.name,
        sizeBytes: artifact.size_bytes,
        kind: artifact.kind,
        expiresInSeconds: seconds,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}
