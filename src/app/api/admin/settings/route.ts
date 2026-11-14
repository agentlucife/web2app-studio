import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  requireApiAdmin,
  jsonError,
  ApiError,
  readJson,
} from "@/lib/api";
import { adminSettingsSchema } from "@/lib/schemas";
import { clearPlatformSettingsCache, getPlatformSettings } from "@/lib/platform";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiAdmin();
    const settings = await getPlatformSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiAdmin();
    const limit = await rateLimit(`admin:settings:${userId}`, 30, 60);
    if (!limit.allowed) throw new ApiError("Too many settings changes", 429);
    const body = adminSettingsSchema.partial().parse(await readJson(request));
    const current = await getPlatformSettings();
    const next = { ...current, ...body };
    const { error } = await admin.from("admin_settings").upsert(
      {
        key: "platform",
        value: next,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) throw new ApiError("Could not save platform settings", 500);
    clearPlatformSettingsCache();
    return NextResponse.json({ settings: next });
  } catch (error) {
    return jsonError(error);
  }
}
