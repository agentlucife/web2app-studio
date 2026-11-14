import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { missingClassicScopes } from "@/lib/github";
import { encryptionConfigured } from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { admin, userId } = await requireApiUser();
    const { data } = await admin
      .from("github_connections")
      .select("github_username, avatar_url, connected_at, token_type, scopes, github_user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({
        connected: false,
        encryptionConfigured: encryptionConfigured(),
        tokenEndpointHint: "https://github.com/settings/tokens/new?scopes=repo,workflow&description=Web2App%20Studio",
      });
    }

    const scopes = (data.scopes ?? []) as string[];
    const warnings: string[] = [];
    if (data.token_type === "pat" && scopes.length > 0) {
      const missing = missingClassicScopes(scopes, true);
      if (missing.length > 0) {
        warnings.push(`Missing scopes: ${missing.join(", ")}. Release builds and workflow dispatch will fail.`);
      }
    }
    if (data.token_type === "pat" && scopes.length === 0) {
      warnings.push(
        "Fine-grained token detected. Ensure Contents: read/write, Actions: read/write and Workflows: write are granted on the repositories you build."
      );
    }

    return NextResponse.json({
      connected: true,
      github_username: data.github_username,
      avatar_url: data.avatar_url,
      connected_at: data.connected_at,
      token_type: data.token_type,
      scopes,
      warnings,
      encryptionConfigured: encryptionConfigured(),
      tokenEndpointHint: "https://github.com/settings/tokens/new?scopes=repo,workflow&description=Web2App%20Studio",
      revokeHint: "https://github.com/settings/tokens",
    });
  } catch (error) {
    return jsonError(error);
  }
}
