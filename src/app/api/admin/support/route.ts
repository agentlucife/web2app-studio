import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson, requireApiAdmin, ApiError } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "closed"]),
});

export async function GET(request: Request) {
  try {
    const { admin } = await requireApiAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let query = admin
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);
    const { data: tickets, error } = await query;
    if (error) throw new ApiError("Could not load support tickets", 500);

    const ids = Array.from(new Set((tickets ?? []).map((ticket) => ticket.user_id)));
    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("id, email, full_name").in("id", ids)
      : { data: [] as Array<{ id: string; email: string | null; full_name: string | null }> };
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return NextResponse.json({
      tickets: (tickets ?? []).map((ticket) => ({
        ...ticket,
        user_email: profileMap.get(ticket.user_id)?.email ?? null,
        user_name: profileMap.get(ticket.user_id)?.full_name ?? null,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin } = await requireApiAdmin();
    const input = patchSchema.parse(await readJson(request));
    const { data, error } = await admin
      .from("support_tickets")
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error || !data) throw new ApiError("Could not update the ticket", 500);
    return NextResponse.json({ ticket: data });
  } catch (error) {
    return jsonError(error);
  }
}
