import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canSeeChannel } from "@/lib/channels";
import { loadChatReads, markChannelRead } from "@/lib/chat-reads";
import { readState } from "@/lib/store";

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
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { channelId?: unknown } | null;
  const channelId = typeof body?.channelId === "string" ? body.channelId : "";
  const state = await readState();
  const channel = state.channels.find((item) => item.id === channelId);
  if (!channel || !canSeeChannel(me, channel)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const at = await markChannelRead(me.id, channel.id);
    return NextResponse.json({ channelId: channel.id, at });
  } catch (error) {
    console.error("chat read save failed", error);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
