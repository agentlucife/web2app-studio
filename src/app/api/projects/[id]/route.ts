import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, requireApiUser, ApiError } from "@/lib/api";
import { getProjectForUser } from "@/lib/builds";
import { createSignedUrl, removeObject, ARTIFACTS_BUCKET, UPLOADS_BUCKET } from "@/lib/storage";
import { appConfigSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function withSignedAssets(project: Record<string, unknown>) {
  const config = appConfigSchema.safeParse(project.config);
  let iconUrl: string | null = null;
  let splashUrl: string | null = null;
  if (config.success) {
    if (config.data.assets.iconPath) {
      try {
        iconUrl = await createSignedUrl(UPLOADS_BUCKET, config.data.assets.iconPath, 600);
      } catch {
        iconUrl = null;
      }
    }
    if (config.data.assets.splashPath) {
      try {
        splashUrl = await createSignedUrl(UPLOADS_BUCKET, config.data.assets.splashPath, 600);
      } catch {
        splashUrl = null;
      }
    }
  }
  return { ...project, icon_preview_url: iconUrl, splash_preview_url: splashUrl };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { userId } = await requireApiUser();
    const { id } = await params;
    const project = await getProjectForUser(id, userId);
    const { admin } = await requireApiUser();
    const { data: builds } = await admin
      .from("builds")
      .select("*")
      .eq("project_id", id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return NextResponse.json({ project: await withSignedAssets(project), builds: builds ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const { id } = await params;
    const project = await getProjectForUser(id, userId);

    // Best-effort cleanup of private objects before the database cascades.
    const { data: artifacts } = await admin
      .from("artifacts")
      .select("storage_path")
      .eq("project_id", id)
      .eq("user_id", userId);
    for (const artifact of artifacts ?? []) {
      if (artifact.storage_path) {
        await removeObject(ARTIFACTS_BUCKET, artifact.storage_path).catch(() => {});
      }
    }
    const config = appConfigSchema.safeParse(project.config);
    if (config.success) {
      for (const path of [config.data.assets.iconPath, config.data.assets.splashPath]) {
        if (path) await removeObject(UPLOADS_BUCKET, path).catch(() => {});
      }
    }

    const { error } = await admin
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new ApiError("Could not delete the project", 500);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
