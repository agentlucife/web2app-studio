import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { assertSameOrigin, jsonError, requireApiUser, ApiError } from "@/lib/api";
import { getProjectForUser, parseProjectConfig } from "@/lib/builds";
import { generateCapacitorProject } from "@/lib/generator";
import { ARTIFACTS_BUCKET, createSignedUrl, uploadObject } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const { id } = await params;
    const limit = await rateLimit(`source:download:${userId}`, 12, 3600);
    if (!limit.allowed) throw new ApiError("Too many source downloads. Try again later.", 429);

    const project = await getProjectForUser(id, userId);
    const config = parseProjectConfig(project);
    const generated = await generateCapacitorProject(config, { userId });
    const name = `${project.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60) || "project"}-source.zip`;
    const storagePath = `${userId}/source/${project.id}/${Date.now()}-${name}`;
    await uploadObject(ARTIFACTS_BUCKET, storagePath, generated.zip, "application/zip");

    const checksum = crypto.createHash("sha256").update(generated.zip).digest("hex");
    const { data: artifact, error } = await admin
      .from("artifacts")
      .insert({
        build_id: null,
        project_id: project.id,
        user_id: userId,
        name,
        storage_path: storagePath,
        size_bytes: generated.zip.length,
        content_type: "application/zip",
        kind: "source",
        checksum,
      })
      .select("id, name, size_bytes, created_at")
      .single();
    if (error) throw new ApiError("The source archive was stored but could not be recorded", 500);

    const url = await createSignedUrl(ARTIFACTS_BUCKET, storagePath, 600);
    return NextResponse.json({ artifact, url, expiresInSeconds: 600 });
  } catch (error) {
    return jsonError(error);
  }
}
