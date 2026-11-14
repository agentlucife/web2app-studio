import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export type SessionContext = {
  userId: string;
  email: string | null;
  profile: Profile;
};

export async function getSessionContext(): Promise<SessionContext | null> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = createAdminSupabase();
    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return null;
    return {
      userId: user.id,
      email: user.email ?? null,
      profile: profile as Profile,
    };
  } catch {
    return null;
  }
}

export async function requirePageUser(nextPath = "/dashboard"): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (context.profile.suspended) {
    redirect("/suspended");
  }
  return context;
}

export async function requirePageAdmin(nextPath = "/admin"): Promise<SessionContext> {
  const context = await requirePageUser(nextPath);
  if (context.profile.role !== "admin") {
    redirect("/dashboard?error=admin_required");
  }
  return context;
}

export async function getSubscription(userId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}
