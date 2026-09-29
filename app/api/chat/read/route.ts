import { NextResponse } from "next/server";
import { getQuickSession, getSessionUser } from "@/lib/auth";
import { canSeeChannel } from "@/lib/channels";
import { loadChatReads, markChannelRead } from "@/lib/chat-reads";
import { emitToMembers } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ reads: await loadChatReads(me.id) });
  } catch (error) {
    console.error("chat reads load failed", error);
    return NextResponse.json({ reads: {} });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { channelId?: unknown; lastMessageId?: unknown }
    | null;
  const channelId = typeof body?.channelId === "string" ? body.channelId : "";
  const { me, channel } = await getQuickSession(channelId);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!channel || !canSeeChannel(me, channel)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const now = new Date().toISOString();
  if (channel.type === "dm") {
    emitToMembers(
      channel.memberIds.filter((id) => id !== me.id),
      {
        type: "seen",
        channelId: channel.id,
        memberId: me.id,
        at: now,
        messageId: typeof body?.lastMessageId === "string" ? body.lastMessageId : undefined,
      }
    );
  }
  try {
    const at = await markChannelRead(me.id, channel.id, now);
    return NextResponse.json({ channelId: channel.id, at });
  } catch (error) {
    console.error("chat read save failed", error);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
