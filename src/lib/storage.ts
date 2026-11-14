import { createAdminSupabase } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api";

export const UPLOADS_BUCKET = "uploads";
export const ARTIFACTS_BUCKET = "artifacts";
const MAX_SIGNED_URL_SECONDS = 60 * 60;

const ensured: Record<string, boolean> = {};

export async function ensureBucket(bucket: string) {
  if (ensured[bucket]) return;
  const admin = createAdminSupabase();
  const fileSizeLimit = bucket === UPLOADS_BUCKET ? 50 * 1024 * 1024 : 512 * 1024 * 1024;
  const { error } = await admin.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit,
  });
  if (error && /already exists|duplicate/i.test(error.message)) {
    // The bucket may have been created by an older migration with a smaller
    // limit. Raise it so uploads are not rejected by Supabase Storage.
    const { error: updateError } = await admin.storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit,
    });
    if (updateError) {
      throw new ApiError(
        `Storage bucket "${bucket}" is unavailable: ${updateError.message}`,
        503,
        "storage_error"
      );
    }
  } else if (error) {
    throw new ApiError(`Storage bucket "${bucket}" is unavailable: ${error.message}`, 503, "storage_error");
  }
  ensured[bucket] = true;
}

export async function uploadObject(
  bucket: string,
  path: string,
  data: Buffer,
  contentType: string
) {
  await ensureBucket(bucket);
  const admin = createAdminSupabase();
  const { error } = await admin.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new ApiError(`Could not store the file: ${error.message}`, 502, "storage_upload_failed");
  }
  return path;
}

export async function createSignedUrl(bucket: string, path: string, seconds = 300) {
  const safeSeconds = Math.min(Math.max(30, seconds), MAX_SIGNED_URL_SECONDS);
  const admin = createAdminSupabase();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, safeSeconds);
  if (error || !data?.signedUrl) {
    throw new ApiError("Could not create a download link for this file", 500, "signed_url_failed");
  }
  return data.signedUrl;
}

export async function downloadObject(bucket: string, path: string): Promise<Buffer> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) {
    throw new ApiError("The stored file could not be read", 404, "storage_not_found");
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function removeObject(bucket: string, path: string) {
  const admin = createAdminSupabase();
  await admin.storage.from(bucket).remove([path]);
}

export function assertOwnedUploadPath(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`)) {
    throw new ApiError("That upload does not belong to you", 403, "forbidden");
  }
  if (path.includes("..") || path.includes("\\")) {
    throw new ApiError("Invalid upload path", 400, "invalid_path");
  }
  return path;
}

export function sanitizeStorageFilename(name: string) {
  const cleaned = name
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return cleaned || "file";
}
