import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("github_connections")
    .select("github_username, avatar_url, connected_at")
    .eq("user_id", user.id)
    .single();

  if (!data) return NextResponse.json({ connected: false });
  return NextResponse.json({ connected: true, ...data });
}
