import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiUser, ApiError } from "@/lib/api";
import { profileUpdateSchema } from "@/lib/schemas";
import { configurationStatus } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { ARTIFACTS_BUCKET, UPLOADS_BUCKET, removeObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { admin, userId, profile, email } = await requireApiUser();
    const [subscription, connections] = await Promise.all([
      admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
      admin
        .from("github_connections")
        .select("github_username, connected_at, token_type")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    return NextResponse.json({
      profile,
      email,
      subscription: subscription.data ?? null,
      github: connections.data ?? null,
      configuration: configurationStatus().map((item) => ({
        name: item.name,
        configured: item.configured,
        required: item.required,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const input = profileUpdateSchema.parse(await readJson(request));
    const { data, error } = await admin
      .from("profiles")
      .update({ full_name: input.fullName || null, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("*")
      .single();
    if (error || !data) throw new ApiError("Could not save your profile", 500);
    return NextResponse.json({ profile: data });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Permanently delete the signed-in account. Supabase auth deletion cascades to
 * profiles, projects, builds, artifacts and every other owned row. Stored
 * objects are removed first on a best-effort basis.
 */
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const limit = await rateLimit(`account:delete:${userId}`, 3, 3600);
    if (!limit.allowed) throw new ApiError("Too many attempts. Try again later.", 429);

    const body = await readJson<{ confirmation?: string }>(request);
    if (body.confirmation !== "DELETE") {
      throw new ApiError('Type DELETE exactly to confirm account deletion', 422, "confirmation_required");
    }

    const { data: artifacts } = await admin
      .from("artifacts")
      .select("storage_path")
      .eq("user_id", userId);
    for (const artifact of artifacts ?? []) {
      if (artifact.storage_path) {
        await removeObject(ARTIFACTS_BUCKET, artifact.storage_path).catch(() => {});
      }
    }

    // Remove common upload folders. Older/unexpected paths may remain but are
    // inaccessible because the owning auth user no longer exists.
    for (const folder of ["icon", "splash"]) {
      const { data: files } = await admin.storage.from(UPLOADS_BUCKET).list(`${userId}/${folder}`, {
        limit: 1000,
      });
      const paths = (files ?? []).map((file) => `${userId}/${folder}/${file.name}`);
      if (paths.length > 0) {
        await admin.storage.from(UPLOADS_BUCKET).remove(paths).catch(() => {});
      }
    }

    await admin.from("support_tickets").delete().eq("user_id", userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      throw new ApiError(
        `Your account could not be deleted: ${error.message}`,
        500,
        "account_delete_failed"
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
