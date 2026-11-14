import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { listRepos } from "@/lib/github";
import { decrypt as dec } from "@/lib/encryption";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn } = await supabase
    .from("github_connections")
    .select("encrypted_token")
    .eq("user_id", user.id)
    .single();

  if (!conn) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  const token = dec(conn.encrypted_token);
  const repos = await listRepos(token);
  return NextResponse.json({ repos });
}
