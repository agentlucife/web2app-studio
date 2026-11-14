import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";
import { adminSettingsSchema } from "@/lib/schemas";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";

export type PlatformSettings = ReturnType<typeof adminSettingsSchema.parse>;

const DEFAULTS: PlatformSettings = {
  maintenanceMode: false,
  signupsEnabled: true,
  buildNotifications: true,
  supportEmail: "support@web2app.studio",
};

let cached: { value: PlatformSettings; at: number } | null = null;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  try {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("admin_settings")
      .select("value")
      .eq("key", "platform")
      .maybeSingle();
    const parsed = adminSettingsSchema.safeParse(data?.value ?? {});
    const value = parsed.success ? parsed.data : DEFAULTS;
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return DEFAULTS;
  }
}

export function clearPlatformSettingsCache() {
  cached = null;
}

export async function assertPlatformWritable(profile: Profile) {
  if (profile.role === "admin") return;
  const settings = await getPlatformSettings();
  if (settings.maintenanceMode) {
    throw new ApiError(
      "Web2App Studio is in maintenance mode. Project and build changes are temporarily disabled.",
      503,
      "maintenance_mode"
    );
  }
}

export function adminEmails() {
  return (env("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
