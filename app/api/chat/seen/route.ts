import { NextResponse } from "next/server";
import { getQuickSession } from "@/lib/auth";
import { canSeeChannel } from "@/lib/channels";
import { loadChannelReads } from "@/lib/chat-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const channelId = new URL(request.url).searchParams.get("channelId") ?? "";
  const { me, channel } = await getQuickSession(channelId);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!channel || channel.type !== "group" || !canSeeChannel(me, channel)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
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
