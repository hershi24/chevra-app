import { NextResponse, type NextRequest } from "next/server";
import { getQuickSession } from "@/lib/auth";
import { canSeeChannel } from "@/lib/channels";
import { channelReadAt, loadChannelReads } from "@/lib/chat-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Private chats return when the other person last had the room open. Shared rooms return every member's mark. */
export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId") ?? "";
  const { me, channel } = await getQuickSession(channelId);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!channel || !canSeeChannel(me, channel)) {
    return NextResponse.json(channel?.type === "group" ? { error: "not found" } : { seen: {} }, {
      status: channel?.type === "group" ? 404 : 200,
    });
  }

  if (channel.type === "dm") {
    const seen: Record<string, string> = {};
    try {
      for (const id of channel.memberIds) {
        if (id === me.id) continue;
        const at = await channelReadAt(id, channel.id);
        if (at) seen[id] = at;
      }
    } catch (error) {
      console.error("chat seen load failed", error);
    }
    return NextResponse.json({ seen });
  }

  if (channel.type !== "group") return NextResponse.json({ seen: {} });

  try {
    const reads = await loadChannelReads(channel.id);
    const allowed = new Set(channel.memberIds);
    const viewers: Record<string, string> = {};
    for (const [memberId, at] of Object.entries(reads)) {
      if (allowed.has(memberId)) viewers[memberId] = at;
    }
    return NextResponse.json({ reads: viewers });
  } catch (error) {
    console.error("chat seen load failed", error);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }
}
