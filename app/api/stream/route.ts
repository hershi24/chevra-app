import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { onlineMemberIds, subscribe } from "@/lib/realtime";
import { readState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(data));
      };
      cleanup = subscribe({ send, memberId: me.id });
      ping = setInterval(() => {
        try {
          send(`: ping\n\n`);
        } catch {
          clearInterval(ping);
          cleanup?.();
        }
      }, 25_000);
      const state = await readState();
      send(
        `data: ${JSON.stringify({
          type: "hello",
          revision: state.revision,
          ids: onlineMemberIds(),
        })}\n\n`
      );
    },
    cancel() {
      clearInterval(ping);
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
