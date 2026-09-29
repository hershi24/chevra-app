import { NextResponse } from "next/server";
import { getQuickSession } from "@/lib/auth";
import { canSeeChannel } from "@/lib/channels";
import { can } from "@/lib/permissions";
import { emitToMembers } from "@/lib/realtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { channelId?: unknown; typing?: unknown } | null;
  const channelId = typeof body?.channelId === "string" ? body.channelId : "";
  const { me, channel, state } = await getQuickSession(channelId);
  if (!me || !can(me, "chat")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!channel || !canSeeChannel(me, channel)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const viewers = state.members
    .filter((member) => member.id !== me.id && canSeeChannel(member, channel))
    .map((member) => member.id);
  emitToMembers(viewers, {
    type: "typing",
    channelId: channel.id,
    memberId: me.id,
    typing: body?.typing !== false,
  });
  return NextResponse.json({ ok: true });
}
