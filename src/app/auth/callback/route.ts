import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { encryptionConfigured, encrypt } from "@/lib/encryption";
import { getGitHubUser } from "@/lib/github";
import { getPlatformSettings, isBootstrapAdminEmail } from "@/lib/platform";
import { safeNextPath } from "@/lib/utils";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorDescription = url.searchParams.get("error_description");
  const next = safeNextPath(url.searchParams.get("next"));

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription)}`, url.origin)
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=Missing%20OAuth%20code", url.origin)
    );
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error?.message ?? "Could not complete GitHub sign-in")}`,
        url.origin
      )
    );
  }

  const admin = createAdminSupabase();
  const user = data.user;
  const metadata = user.user_metadata ?? {};

  try {
    const isBootstrapAdmin = isBootstrapAdminEmail(user.email);
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      // New accounts are gated by the platform signup switch. Existing users
      // must always be able to sign back in, even while signups are closed.
      const settings = await getPlatformSettings();
      if (!settings.signupsEnabled && !isBootstrapAdmin) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL(
            "/login?error=" +
              encodeURIComponent("New signups are currently closed. Please contact support."),
            url.origin
          )
        );
      }

      await admin.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: metadata.full_name ?? metadata.name ?? null,
        avatar_url: metadata.avatar_url ?? null,
        github_username: metadata.user_name ?? metadata.preferred_username ?? null,
        role: isBootstrapAdmin ? "admin" : "user",
      });
    } else {
      const patch: Record<string, unknown> = {
        email: user.email ?? null,
        full_name: metadata.full_name ?? metadata.name ?? null,
        avatar_url: metadata.avatar_url ?? null,
        github_username: metadata.user_name ?? metadata.preferred_username ?? null,
        updated_at: new Date().toISOString(),
      };
      if (isBootstrapAdmin && existingProfile.role !== "admin") patch.role = "admin";
      await admin.from("profiles").update(patch).eq("id", user.id);
    }

    await admin.from("subscriptions").upsert(
      { user_id: user.id, plan: "free", status: "active" },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

    // Persist the GitHub OAuth provider token (server-side, encrypted) so the
    // dashboard can use the GitHub API without asking for a PAT. A PAT that the
    // user explicitly connected is never overwritten by an OAuth login.
    const providerToken = data.session.provider_token;
    if (providerToken && encryptionConfigured()) {
      const { data: existingConnection } = await admin
        .from("github_connections")
        .select("token_type")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existingConnection || existingConnection.token_type !== "pat") {
        let scopes: string[] = [];
        let githubUserId: number | null = null;
        let username = metadata.user_name ?? metadata.preferred_username ?? null;
        let avatar = metadata.avatar_url ?? null;
        try {
          const ghUser = await getGitHubUser(providerToken);
          scopes = ghUser.scopes;
          githubUserId = ghUser.id;
          username = ghUser.login;
          avatar = ghUser.avatar_url;
        } catch {
          /* The login still succeeds; PAT can be connected later. */
        }
        await admin.from("github_connections").upsert(
          {
            user_id: user.id,
            github_user_id: githubUserId,
            github_username: username,
            avatar_url: avatar,
            encrypted_token: encrypt(providerToken),
            token_type: "oauth",
            scopes,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }
    }
  } catch (error) {
    console.error(
      "[auth/callback] profile provisioning failed:",
      error instanceof Error ? error.message : "unknown"
    );
    return NextResponse.redirect(
      new URL(
        "/login?error=" +
          encodeURIComponent(
            "Signed in, but your profile could not be created. Apply the database migrations and try again."
          ),
        url.origin
      )
    );
  }

  const target = next === "/dashboard" && env("ADMIN_EMAILS") && isBootstrapAdminEmail(user.email)
    ? "/admin"
    : next;
  return NextResponse.redirect(new URL(target, url.origin));
}
