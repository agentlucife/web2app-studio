import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiUser, ApiError } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
  read: z.boolean().default(true),
});

export async function GET() {
  try {
    const { admin, userId } = await requireApiUser();
    const [{ data, error }, { count }] = await Promise.all([
      admin
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false),
    ]);
    if (error) throw new ApiError("Could not load notifications", 500);
    return NextResponse.json({ notifications: data ?? [], unread: count ?? 0 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const body = patchSchema.parse(await readJson(request));
    if (!body.all && !body.id) {
      throw new ApiError("Choose a notification or mark all as read", 422);
    }
    let query = admin.from("notifications").update({ read: body.read }).eq("user_id", userId);
    if (!body.all) query = query.eq("id", body.id!);
    const { error } = await query;
    if (error) throw new ApiError("Could not update notifications", 500);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, userId } = await requireApiUser();
    const { error } = await admin
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .eq("read", true);
    if (error) throw new ApiError("Could not clear notifications", 500);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
