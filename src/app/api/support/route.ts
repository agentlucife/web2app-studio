import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiUser, ApiError } from "@/lib/api";
import { supportTicketSchema } from "@/lib/schemas";
import { getPlatformSettings } from "@/lib/platform";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { admin, userId } = await requireApiUser();
    const { data, error } = await admin
      .from("support_tickets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new ApiError("Could not load support tickets", 500);
    const settings = await getPlatformSettings();
    return NextResponse.json({ tickets: data ?? [], supportEmail: settings.supportEmail });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const limit = await rateLimit(`support:create:${userId}`, 5, 3600);
    if (!limit.allowed) {
      throw new ApiError("You have opened several tickets recently. Please wait before adding another.", 429);
    }
    const input = supportTicketSchema.parse(await readJson(request));
    const { data, error } = await admin
      .from("support_tickets")
      .insert({
        user_id: userId,
        subject: input.subject,
        message: input.message,
        status: "open",
      })
      .select("*")
      .single();
    if (error || !data) throw new ApiError("Could not create the support ticket", 500);
    return NextResponse.json({ ticket: data }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
