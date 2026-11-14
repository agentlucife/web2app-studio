import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, requireApiUser } from "@/lib/api";
import { cancelBuild } from "@/lib/builds";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { userId } = await requireApiUser();
    const { id } = await params;
    const build = await cancelBuild(id, userId);
    return NextResponse.json({ build });
  } catch (error) {
    return jsonError(error);
  }
}
