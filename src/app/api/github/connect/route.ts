import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getGitHubUser } from "@/lib/github";
import { encrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();
  if (!token || typeof token !== "string")
    return NextResponse.json({ error: "Token required" }, { status: 400 });

  let ghUser;
  try {
    ghUser = await getGitHubUser(token);
  } catch {
    return NextResponse.json({ error: "Invalid GitHub token" }, { status: 400 });
  }

  const encrypted = encrypt(token);

  const { error } = await supabase.from("github_connections").upsert(
    {
      user_id: user.id,
      github_user_id: ghUser.id,
      github_username: ghUser.login,
      avatar_url: ghUser.avatar_url,
      encrypted_token: encrypted,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    username: ghUser.login,
    avatar_url: ghUser.avatar_url,
  });
}

export async function DELETE() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("github_connections").delete().eq("user_id", user.id);
  return NextResponse.json({ success: true });
}
