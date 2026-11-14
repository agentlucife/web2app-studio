import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiUser, ApiError } from "@/lib/api";
import { githubTokenSchema } from "@/lib/schemas";
import { getGitHubUser, missingClassicScopes } from "@/lib/github";
import { encrypt, encryptionConfigured } from "@/lib/encryption";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const limit = await rateLimit(`github:connect:${userId}`, 10, 600);
    if (!limit.allowed) throw new ApiError("Too many connection attempts. Try again shortly.", 429);
    if (!encryptionConfigured()) {
      throw new ApiError(
        "ENCRYPTION_KEY is not configured on the server. GitHub tokens cannot be stored securely.",
        503,
        "encryption_not_configured"
      );
    }

    const body = await readJson<{ token?: string }>(request);
    const token = githubTokenSchema.parse(body.token ?? "");

    let ghUser: Awaited<ReturnType<typeof getGitHubUser>>;
    try {
      ghUser = await getGitHubUser(token);
    } catch (error) {
      throw new ApiError(
        error instanceof Error
          ? error.message
          : "GitHub rejected this token. Check that it is valid and has not expired.",
        400,
        "invalid_github_token"
      );
    }

    const warnings: string[] = [];
    const missingPrivate = missingClassicScopes(ghUser.scopes, true);
    const missingPublic = missingClassicScopes(ghUser.scopes, false);
    if (ghUser.tokenKind === "classic" && missingPrivate.length > 0) {
      warnings.push(
        `Classic tokens need the ${missingPrivate.join(", ")} scope${missingPrivate.length > 1 ? "s" : ""} to push source and dispatch workflows.`
      );
    }
    if (ghUser.tokenKind === "fine-grained") {
      warnings.push(
        "Fine-grained tokens must grant Contents: read/write, Actions: read/write and Workflows: write on every repository you build."
      );
    }
    if (missingPublic.length > 0 && ghUser.scopes.length > 0) {
      // Public repos still need workflow scope for the generated workflow files.
      warnings.push("The workflow scope is required to commit .github/workflows files.");
    }

    const { error } = await admin.from("github_connections").upsert(
      {
        user_id: userId,
        github_user_id: ghUser.id,
        github_username: ghUser.login,
        avatar_url: ghUser.avatar_url,
        encrypted_token: encrypt(token),
        token_type: "pat",
        scopes: ghUser.scopes,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) throw new ApiError("Could not store the GitHub connection", 500);

    return NextResponse.json({
      connected: true,
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
      scopes: ghUser.scopes,
      tokenKind: ghUser.tokenKind,
      warnings,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const { error } = await admin.from("github_connections").delete().eq("user_id", userId);
    if (error) throw new ApiError("Could not disconnect GitHub", 500);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
