import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin-shell";
import { ToastProvider } from "@/components/ui";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  let profile: Profile | null = null;
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
    profile = (data as Profile | null) ?? null;
  } catch {
    profile = null;
  }

  if (!profile) redirect("/login?error=profile_missing");
  if (profile.suspended) redirect("/suspended");
  if (profile.role !== "admin") redirect("/dashboard?error=admin_only");

  return (
    <ToastProvider>
      <AdminShell
        profile={{
          email: profile.email ?? user.email ?? null,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
