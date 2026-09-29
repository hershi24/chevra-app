import { NextResponse, type NextRequest } from "next/server";
import { getQuickSession } from "@/lib/auth";
import { canSeeChannel } from "@/lib/channels";
import { channelReadAt } from "@/lib/chat-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** When the other side of a private chat last had it open. */
export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId") ?? "";
  const { me, channel } = await getQuickSession(channelId);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!channel || channel.type !== "dm" || !canSeeChannel(me, channel)) {
    return NextResponse.json({ seen: {} });
  }
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
