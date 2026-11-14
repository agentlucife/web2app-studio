import { NextResponse } from "next/server";
import { configurationStatus } from "@/lib/env";
import { adminConfigured, createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {};
  for (const item of configurationStatus()) checks[item.name] = item.configured;

  let database: "ok" | "unavailable" | "not_configured" = "not_configured";
  if (adminConfigured()) {
    try {
      const admin = createAdminSupabase();
      const { error } = await admin.from("admin_settings").select("key").limit(1);
      database = error ? "unavailable" : "ok";
    } catch {
      database = "unavailable";
    }
  }

  return NextResponse.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      database,
      configuration: checks,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
