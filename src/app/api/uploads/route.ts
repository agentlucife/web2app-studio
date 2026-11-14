import { NextResponse } from "next/server";
import crypto from "node:crypto";
import sharp from "sharp";
import { assertSameOrigin, jsonError, requireApiUser, ApiError } from "@/lib/api";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_ICON_BYTES,
  MAX_SPLASH_BYTES,
  uploadKinds,
  type UploadKind,
} from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { UPLOADS_BUCKET, createSignedUrl, removeObject, uploadObject } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SIZES: Record<UploadKind, number> = { icon: 1024, splash: 2732 };

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    assertSameOrigin(request);
    const { userId } = await requireApiUser();
    const limit = await rateLimit(`uploads:create:${userId}`, 20, 600);
    if (!limit.allowed) {
      throw new ApiError("Too many uploads. Wait a few minutes and try again.", 429);
    }

    const form = await request.formData().catch(() => null);
    if (!form) throw new ApiError("Expected a multipart form upload", 415, "unsupported_media_type");

    const kindRaw = String(form.get("kind") ?? "");
    if (!uploadKinds.includes(kindRaw as UploadKind)) {
      throw new ApiError("Upload kind must be icon or splash", 422);
    }
    const kind = kindRaw as UploadKind;
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("Choose an image file to upload", 422);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      throw new ApiError("Use a PNG, JPEG or WebP image", 415, "unsupported_image_type");
    }
    const maxBytes = kind === "icon" ? MAX_ICON_BYTES : MAX_SPLASH_BYTES;
    if (file.size === 0) throw new ApiError("The selected file is empty", 422);
    if (file.size > maxBytes) {
      throw new ApiError(
        `That image is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
        413,
        "file_too_large"
      );
    }

    const input = Buffer.from(await file.arrayBuffer());
    let metadata: { format?: string; width?: number; height?: number };
    try {
      metadata = await sharp(input).metadata();
    } catch {
      throw new ApiError("That file is not a readable image", 422, "invalid_image");
    }
    if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format)) {
      throw new ApiError("Use a PNG, JPEG or WebP image", 415, "unsupported_image_type");
    }
    if (!metadata.width || !metadata.height) {
      throw new ApiError("The image has no readable dimensions", 422, "invalid_image");
    }

    const size = SIZES[kind];
    const pipeline = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
      .rotate()
      .resize(size, size, {
        fit: kind === "icon" ? "cover" : "contain",
        position: "centre",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false,
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true });
    const output = await pipeline.toBuffer();

    const filename = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.png`;
    const path = `${userId}/${kind}/${filename}`;
    await uploadObject(UPLOADS_BUCKET, path, output, "image/png");
    uploadedPath = path;

    const url = await createSignedUrl(UPLOADS_BUCKET, path, 600);
    return NextResponse.json(
      {
        path,
        url,
        kind,
        width: size,
        height: size,
        sizeBytes: output.length,
        expiresInSeconds: 600,
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedPath) {
      await removeObject(UPLOADS_BUCKET, uploadedPath).catch(() => {});
    }
    return jsonError(error);
  }
}
